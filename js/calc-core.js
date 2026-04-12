// ═══════════════════════════════════════════════════════════
// CALC CORE — Saf hesap yardımcıları
// GüneşHesap v2.1
// ═══════════════════════════════════════════════════════════
import {
  PANEL_TYPES, HOURLY_SOLAR_PROFILE, RESIDENTIAL_LOAD, COMMERCIAL_LOAD,
  INDUSTRIAL_LOAD, MONTH_WEIGHTS, TARIFF_META
} from './data.js';

export const METHODOLOGY_VERSION = 'GH-CALC-2026.04-v2.1';
export const PVGIS_LOSS_PARAM = 0;
export const COMMON_YEAR_MONTH_DAYS = [31,28,31,30,31,30,31,31,30,31,30,31];

export function normalizeProfile(profile) {
  const values = Array.isArray(profile) && profile.length ? profile : new Array(24).fill(1);
  const sum = values.reduce((a, b) => a + (Number(b) || 0), 0);
  if (sum <= 0) return values.map(() => 1 / values.length);
  return values.map(v => (Number(v) || 0) / sum);
}

export function getLoadProfile(tariffType = 'residential') {
  if (tariffType === 'commercial') return normalizeProfile(COMMERCIAL_LOAD);
  if (tariffType === 'industrial') return normalizeProfile(INDUSTRIAL_LOAD);
  return normalizeProfile(RESIDENTIAL_LOAD);
}

export function getSeasonForMonth(monthIdx) {
  if (monthIdx === 11 || monthIdx <= 1) return 'winter';
  if (monthIdx >= 5 && monthIdx <= 7) return 'summer';
  return 'spring';
}

export function getMonthlyLoadKwh(state, extraAnnualLoad = 0) {
  const base = Array.isArray(state.monthlyConsumption) && state.monthlyConsumption.some(v => Number(v) > 0)
    ? state.monthlyConsumption.map(v => Math.max(0, Number(v) || 0))
    : new Array(12).fill(Math.max(0, Number(state.dailyConsumption) || 0) * 365 / 12);

  const extra = Math.max(0, Number(extraAnnualLoad) || 0);
  return base.map((v, i) => v + extra * (MONTH_WEIGHTS[i] || 1 / 12));
}

export function calculateEVLoad(ev) {
  if (!ev) return { annualKwh: 0, dailyKwh: 0 };
  const dailyKwh = Math.max(0, Number(ev.dailyKm) || 0) * Math.max(0, Number(ev.consumptionPer100km) || 0) / 100;
  return { dailyKwh, annualKwh: dailyKwh * 365 };
}

export function calculateHeatPumpLoad(hp, heatPumpData) {
  if (!hp) return { annualKwh: 0, heatDemand: 0, cop: 0 };
  const insulation = hp.insulation === 'low' ? 'poor' : hp.insulation;
  const heatLoad = heatPumpData?.heat_load?.[insulation] || 80;
  const cop = heatPumpData?.cop_heating?.[insulation] || 3.5;
  const heatDemand = Math.max(0, Number(hp.area) || 0) * heatLoad;
  return { annualKwh: heatDemand / cop, heatDemand, cop };
}

export function calculateSystemLayout(state, panelType = state.panelType) {
  const panel = PANEL_TYPES[panelType || 'mono'];
  const panelArea = panel.width * panel.height;
  const primarySection = {
    area: Number(state.roofArea) || 0,
    tilt: Number(state.tilt) || 0,
    azimuth: Number(state.azimuth) || 180,
    azimuthCoeff: Number(state.azimuthCoeff) || 1,
    azimuthName: state.azimuthName || 'Güney',
    shadingFactor: Number(state.shadingFactor) || 0
  };
  const sections = (state.multiRoof && Array.isArray(state.roofSections) && state.roofSections.length > 0)
    ? [primarySection, ...state.roofSections.map(sec => ({
        area: Number(sec.area) || 0,
        tilt: Number(sec.tilt) || 0,
        azimuth: Number(sec.azimuth) || 180,
        azimuthCoeff: Number(sec.azimuthCoeff) || 1,
        azimuthName: sec.azimuthName || 'Yüzey',
        shadingFactor: Number(sec.shadingFactor) || 0
      }))]
    : [primarySection];

  const sectionLayouts = sections.map(sec => {
    const panelCount = Math.floor(sec.area * 0.75 / panelArea);
    return {
      ...sec,
      panelCount,
      systemPower: panelCount * panel.wattPeak / 1000,
      panelArea
    };
  });

  return {
    panel,
    panelArea,
    sections: sectionLayouts,
    panelCount: sectionLayouts.reduce((s, sec) => s + sec.panelCount, 0),
    systemPower: sectionLayouts.reduce((s, sec) => s + sec.systemPower, 0),
    usableArea: sections.reduce((s, sec) => s + sec.area * 0.75, 0)
  };
}

export function simulateHourlyEnergy(monthlyProduction, monthlyLoad, options = {}) {
  const loadProfile = getLoadProfile(options.tariffType);
  const hourlyLoad8760 = Array.isArray(options.hourlyLoad8760) && options.hourlyLoad8760.length >= 8760
    ? options.hourlyLoad8760.slice(0, 8760).map(v => Math.max(0, Number(v) || 0))
    : null;
  let hourlyCursor = 0;
  let annualProduction = 0;
  let annualLoad = 0;
  let directSelfConsumption = 0;
  let gridExport = 0;
  let gridImport = 0;

  const monthly = monthlyProduction.map((production, monthIdx) => {
    const days = COMMON_YEAR_MONTH_DAYS[monthIdx];
    const season = getSeasonForMonth(monthIdx);
    const solarProfile = normalizeProfile(HOURLY_SOLAR_PROFILE[season]);
    const hourlySlice = hourlyLoad8760
      ? hourlyLoad8760.slice(hourlyCursor, hourlyCursor + days * 24)
      : null;
    hourlyCursor += days * 24;
    const monthLoad = hourlySlice
      ? hourlySlice.reduce((a, b) => a + b, 0)
      : Math.max(0, Number(monthlyLoad[monthIdx]) || 0);
    const dayProduction = Math.max(0, Number(production) || 0) / days;
    const dayLoad = monthLoad / days;

    let monthSelf = 0;
    let monthExport = 0;
    let monthImport = 0;

    if (hourlySlice) {
      for (let d = 0; d < days; d++) {
        for (let h = 0; h < 24; h++) {
          const p = dayProduction * solarProfile[h];
          const l = hourlySlice[d * 24 + h] || 0;
          monthSelf += Math.min(p, l);
          monthExport += Math.max(0, p - l);
          monthImport += Math.max(0, l - p);
        }
      }
    } else {
      for (let h = 0; h < 24; h++) {
        const p = dayProduction * solarProfile[h] * days;
        const l = dayLoad * loadProfile[h] * days;
        monthSelf += Math.min(p, l);
        monthExport += Math.max(0, p - l);
        monthImport += Math.max(0, l - p);
      }
    }

    annualProduction += Math.max(0, Number(production) || 0);
    annualLoad += monthLoad;
    directSelfConsumption += monthSelf;
    gridExport += monthExport;
    gridImport += monthImport;

    return {
      production: Math.round(production),
      load: Math.round(monthLoad),
      selfConsumption: Math.round(monthSelf),
      gridExport: Math.round(monthExport),
      gridImport: Math.round(monthImport)
    };
  });

  return {
    annualProduction,
    annualLoad,
    selfConsumption: directSelfConsumption,
    gridExport,
    gridImport,
    selfConsumptionRatio: annualProduction > 0 ? Math.min(1, directSelfConsumption / annualProduction) : 0,
    monthly
  };
}

export function simulateBatteryOnHourlySummary(hourlySummary, battery) {
  if (!battery || !hourlySummary) return null;
  const usableCapacity = Math.max(0, Number(battery.capacity) || 0) * Math.max(0, Number(battery.dod) || 0);
  const efficiency = Math.max(0, Math.min(1, Number(battery.efficiency) || 0.9));
  const cyclesPerYear = Math.min(365, hourlySummary.gridExport / Math.max(usableCapacity, 1));
  const batteryDischarge = Math.min(hourlySummary.gridImport, hourlySummary.gridExport * efficiency, usableCapacity * cyclesPerYear);
  const remainingExport = Math.max(0, hourlySummary.gridExport - batteryDischarge / Math.max(efficiency, 0.01));
  const remainingImport = Math.max(0, hourlySummary.gridImport - batteryDischarge);
  const totalSelf = hourlySummary.selfConsumption + batteryDischarge;

  return {
    usableCapacity,
    batteryDischarge,
    remainingExport,
    remainingImport,
    totalSelfConsumption: totalSelf,
    gridIndependence: hourlySummary.annualLoad > 0 ? Math.min(1, totalSelf / hourlySummary.annualLoad) : 0,
    selfConsumptionRatio: hourlySummary.annualProduction > 0 ? Math.min(1, totalSelf / hourlySummary.annualProduction) : 0,
    cyclesPerYear
  };
}

export function buildTariffModel(state) {
  const tariffType = state.tariffType || 'residential';
  const meta = TARIFF_META[tariffType] || TARIFF_META.residential;
  return {
    type: tariffType,
    mode: state.tariffMode || 'manual',
    importRate: Math.max(0, Number(state.tariff) || 0),
    exportRate: Math.max(0, Number(state.exportTariff) || Number(state.tariff) || 0),
    annualPriceIncrease: Math.max(-0.5, Number(state.annualPriceIncrease ?? 0.12)),
    discountRate: Math.max(0, Number(state.discountRate ?? 0.18)),
    sourceDate: state.tariffSourceDate || meta.sourceDate,
    sourceLabel: meta.sourceLabel,
    skttLimitKwh: meta.skttLimitKwh,
    includesTax: state.tariffIncludesTax ?? true
  };
}

export function computeFinancialTable({
  annualEnergy, hourlySummary, batterySummary, totalCost, tariffModel,
  panel, annualOMCost, annualInsurance, inverterLifetime, inverterReplaceCost,
  netMeteringEnabled, exportRateOverride
}) {
  const rows = [];
  let cumulativeNet = 0;
  let totalExpenses25y = 0;
  let paybackYear = 0;
  const lidFactor = panel.firstYearDeg || 0;
  const annualBaseSelf = batterySummary?.totalSelfConsumption ?? hourlySummary.selfConsumption;
  const annualBaseExport = batterySummary?.remainingExport ?? hourlySummary.gridExport;
  const selfRatio = annualEnergy > 0 ? annualBaseSelf / annualEnergy : 0;
  const exportRatio = annualEnergy > 0 ? annualBaseExport / annualEnergy : 0;
  const exportRate = exportRateOverride ?? tariffModel.exportRate;

  for (let year = 1; year <= 25; year++) {
    const degradedEnergy = annualEnergy * (1 - lidFactor) * Math.pow(1 - panel.degradation, year - 1);
    const electricityPrice = tariffModel.importRate * Math.pow(1 + tariffModel.annualPriceIncrease, year - 1);
    const escalatedExportRate = exportRate * Math.pow(1 + tariffModel.annualPriceIncrease, year - 1);
    const selfE = degradedEnergy * selfRatio;
    const exportE = degradedEnergy * exportRatio;
    const yearSavings = selfE * electricityPrice + (netMeteringEnabled ? exportE * escalatedExportRate : 0);
    let yearExpenses = annualOMCost + annualInsurance;
    if (year === inverterLifetime) yearExpenses += inverterReplaceCost;
    totalExpenses25y += yearExpenses;
    const netCashFlow = yearSavings - yearExpenses;
    const npv = netCashFlow / Math.pow(1 + tariffModel.discountRate, year);
    cumulativeNet += netCashFlow;
    if (cumulativeNet >= totalCost && paybackYear === 0) paybackYear = year;
    rows.push({
      year,
      energy: Math.round(degradedEnergy),
      rate: electricityPrice.toFixed(2),
      savings: Math.round(yearSavings),
      expenses: Math.round(yearExpenses),
      netCashFlow: Math.round(netCashFlow),
      cumulative: Math.round(cumulativeNet),
      npv: Math.round(npv)
    });
  }

  const discountedCashFlow = rows.reduce((s, row) => s + row.npv, 0);
  const projectNPV = discountedCashFlow - totalCost;
  const cumulativeSavings = rows.reduce((s, row) => s + row.savings, 0);
  const totalNetCashFlow = rows.reduce((s, row) => s + row.netCashFlow, 0);
  const roi = totalCost > 0 ? ((totalNetCashFlow - totalCost) / totalCost) * 100 : 0;

  return {
    rows,
    paybackYear,
    totalExpenses25y,
    discountedCashFlow,
    projectNPV,
    cumulativeSavings,
    roi
  };
}

export function calcIRR(cfs) {
  let signChanges = 0;
  for (let i = 1; i < cfs.length; i++) {
    if ((cfs[i] >= 0) !== (cfs[i - 1] >= 0)) signChanges++;
  }
  if (signChanges < 1) return 'N/A';
  const npv = rate => cfs.reduce((s, c, t) => s + c / Math.pow(1 + rate, t), 0);
  const dnpv = rate => cfs.reduce((s, c, t) => s - t * c / Math.pow(1 + rate, t + 1), 0);
  let r = 0.15;
  for (let i = 0; i < 150; i++) {
    const f = npv(r);
    const df = dnpv(r);
    if (Math.abs(df) < 1e-10) break;
    const nr = r - f / df;
    if (!isFinite(nr) || isNaN(nr)) break;
    const clamped = Math.max(-0.5, Math.min(5.0, nr));
    if (Math.abs(clamped - r) < 0.000001) {
      r = clamped;
      break;
    }
    r = clamped;
  }
  return isFinite(r) && !isNaN(r) ? (r * 100).toFixed(1) : 'N/A';
}

export function detectCalculationWarnings(results) {
  const warnings = [];
  if (!isFinite(results.annualEnergy) || results.annualEnergy < 0) warnings.push('Yıllık üretim geçersiz.');
  if (!isFinite(results.totalCost) || results.totalCost <= 0) warnings.push('Toplam maliyet geçersiz.');
  if (Number(results.pr) > 95) warnings.push('PR %95 üzerinde; ışınım/kayıp varsayımlarını kontrol edin.');
  if (Number(results.cf) > 30) warnings.push('Kapasite faktörü PV için olağan dışı yüksek.');
  if (Number(results.cableLossPct) > 3) warnings.push('Kablo kaybı %3 üzerinde; kesit ve mesafe kontrol edilmeli.');
  if (results.usedFallback) warnings.push('PVGIS verisi alınamadı; fallback PSH hesabı düşük güven seviyesidir.');
  return warnings;
}
