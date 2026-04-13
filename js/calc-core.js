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
export const HEAT_PUMP_HEATING_WEIGHTS = [0.18,0.16,0.12,0.06,0.02,0,0,0,0.02,0.06,0.14,0.24];
export const HEAT_PUMP_COOLING_WEIGHTS = [0,0,0,0.05,0.15,0.25,0.30,0.20,0.05,0,0,0];

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

  if (Array.isArray(extraAnnualLoad)) {
    return base.map((v, i) => v + Math.max(0, Number(extraAnnualLoad[i]) || 0));
  }

  const extra = Math.max(0, Number(extraAnnualLoad) || 0);
  return base.map((v, i) => v + extra * (MONTH_WEIGHTS[i] || 1 / 12));
}

export function calculateEVLoad(ev) {
  if (!ev) return { annualKwh: 0, dailyKwh: 0, monthlyKwh: new Array(12).fill(0), hourly8760: new Array(8760).fill(0) };
  const dailyKwh = Math.max(0, Number(ev.dailyKm) || 0) * Math.max(0, Number(ev.consumptionPer100km) || 0) / 100;
  const annualKwh = dailyKwh * 365;
  const monthDays = COMMON_YEAR_MONTH_DAYS;
  const chargeProfile = ev.chargeTime === 'night'
    ? normalizeProfile([0.16,0.16,0.16,0.14,0.12,0.10,0.06,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0.03,0.04,0.03])
    : normalizeProfile([0,0,0,0,0,0,0,0,0,0.08,0.12,0.16,0.18,0.18,0.14,0.10,0.04,0,0,0,0,0,0,0]);
  const monthlyKwh = monthDays.map(days => dailyKwh * days);
  const hourly8760 = [];
  monthDays.forEach(days => {
    for (let d = 0; d < days; d++) {
      for (let h = 0; h < 24; h++) hourly8760.push(dailyKwh * chargeProfile[h]);
    }
  });
  return { dailyKwh, annualKwh, monthlyKwh, hourly8760 };
}

export function calculateHeatPumpLoad(hp, heatPumpData) {
  if (!hp) return { annualKwh: 0, heatDemand: 0, cop: 0, monthlyKwh: new Array(12).fill(0), hourly8760: new Array(8760).fill(0) };
  const insulation = hp.insulation === 'low' ? 'poor' : hp.insulation;
  const heatLoad = heatPumpData?.heat_load?.[insulation] || 80;
  const cop = heatPumpData?.spf_heating?.[insulation] || heatPumpData?.cop_heating?.[insulation] || 3.5;
  const coolingCop = heatPumpData?.spf_cooling?.[insulation] || heatPumpData?.cop_cooling?.[insulation] || 4.0;
  const area = Math.max(0, Number(hp.area) || 0);
  const heatingMonths = Math.max(1, Number(heatPumpData?.heating_season_months) || 5);
  const coolingMonths = Math.max(1, Number(heatPumpData?.cooling_season_months) || 4);
  const heatDemand = area * heatLoad * 8 * heatingMonths * 30 / 1000;
  const coolDemand = area * heatLoad * 0.7 * 8 * coolingMonths * 30 / 1000;
  const mode = hp.heatingType || 'both';
  const doHeating = mode === 'heat' || mode === 'heating' || mode === 'both';
  const doCooling = mode === 'cool' || mode === 'cooling' || mode === 'both';
  const heatingKwh = doHeating ? heatDemand / cop : 0;
  const coolingKwh = doCooling ? coolDemand / coolingCop : 0;
  const annualKwh = heatingKwh + coolingKwh;
  const monthlyKwh = HEAT_PUMP_HEATING_WEIGHTS.map((w, i) =>
    heatingKwh * w + coolingKwh * (HEAT_PUMP_COOLING_WEIGHTS[i] || 0)
  );
  const hourly8760 = [];
  monthlyKwh.forEach((monthKwh, monthIdx) => {
    const days = COMMON_YEAR_MONTH_DAYS[monthIdx];
    const daily = days > 0 ? monthKwh / days : 0;
    const season = getSeasonForMonth(monthIdx);
    const hourlyShape = season === 'winter'
      ? normalizeProfile([0.055,0.055,0.055,0.055,0.055,0.055,0.055,0.045,0.035,0.03,0.03,0.03,0.03,0.03,0.03,0.035,0.04,0.05,0.055,0.06,0.06,0.055,0.055,0.055])
      : normalizeProfile([0.02,0.02,0.02,0.02,0.02,0.025,0.03,0.035,0.04,0.045,0.05,0.055,0.06,0.065,0.07,0.075,0.075,0.07,0.06,0.05,0.04,0.035,0.03,0.025]);
    for (let d = 0; d < days; d++) {
      for (let h = 0; h < 24; h++) hourly8760.push(daily * hourlyShape[h]);
    }
  });
  return { annualKwh, heatDemand, cop, coolingKwh, heatingKwh, monthlyKwh, hourly8760 };
}

export function sumMonthlyArrays(...arrays) {
  return new Array(12).fill(0).map((_, i) =>
    arrays.reduce((sum, arr) => sum + (Array.isArray(arr) ? Math.max(0, Number(arr[i]) || 0) : 0), 0)
  );
}

export function buildBaseHourlyLoad8760(monthlyLoad, tariffType = 'residential') {
  const loadProfile = getLoadProfile(tariffType);
  const out = [];
  COMMON_YEAR_MONTH_DAYS.forEach((days, monthIdx) => {
    const dayLoad = Math.max(0, Number(monthlyLoad[monthIdx]) || 0) / days;
    for (let d = 0; d < days; d++) {
      for (let h = 0; h < 24; h++) out.push(dayLoad * loadProfile[h]);
    }
  });
  return out;
}

export function combineHourlyLoads(...loads) {
  const out = new Array(8760).fill(0);
  loads.forEach(load => {
    if (!Array.isArray(load)) return;
    for (let i = 0; i < Math.min(8760, load.length); i++) out[i] += Math.max(0, Number(load[i]) || 0);
  });
  return out;
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
  const hourlyLoad8760 = Array.isArray(options.hourlyLoad8760) && options.hourlyLoad8760.length >= 8760
    ? options.hourlyLoad8760.slice(0, 8760).map(v => Math.max(0, Number(v) || 0))
    : null;
  let hourlyCursor = 0;
  let annualProduction = 0;
  let annualLoad = 0;
  let directSelfConsumption = 0;
  let gridExport = 0;
  let gridImport = 0;
  const hourly8760 = [];

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

    for (let d = 0; d < days; d++) {
      for (let h = 0; h < 24; h++) {
        const p = dayProduction * solarProfile[h];
        const l = hourlySlice
          ? (hourlySlice[d * 24 + h] || 0)
          : dayLoad * getLoadProfile(options.tariffType)[h];
        const self = Math.min(p, l);
        const exported = Math.max(0, p - l);
        const imported = Math.max(0, l - p);
        monthSelf += self;
        monthExport += exported;
        monthImport += imported;
        hourly8760.push({
          month: monthIdx,
          hour: h,
          production: p,
          load: l,
          selfConsumption: self,
          gridExport: exported,
          gridImport: imported,
          batteryDischarge: 0,
          batteryChargeFromPv: 0,
          batteryExport: 0
        });
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

  const capped = capPaidExportByMonth(monthly);

  return {
    annualProduction,
    annualLoad,
    selfConsumption: directSelfConsumption,
    gridExport,
    gridImport,
    paidGridExport: capped.paidGridExport,
    unpaidGridExport: capped.unpaidGridExport,
    selfConsumptionRatio: annualProduction > 0 ? Math.min(1, directSelfConsumption / annualProduction) : 0,
    hourly8760,
    monthly: monthly.map((m, i) => ({
      ...m,
      paidGridExport: capped.monthly[i].paidGridExport,
      unpaidGridExport: capped.monthly[i].unpaidGridExport
    }))
  };
}

export function capPaidExportByMonth(monthly) {
  const cappedMonthly = (Array.isArray(monthly) ? monthly : []).map(m => {
    const rawExport = Math.max(0, Number(m.gridExport) || 0);
    const load = Math.max(0, Number(m.load) || 0);
    const paidGridExport = Math.min(rawExport, load);
    return {
      paidGridExport,
      unpaidGridExport: Math.max(0, rawExport - paidGridExport)
    };
  });
  return {
    paidGridExport: cappedMonthly.reduce((s, m) => s + m.paidGridExport, 0),
    unpaidGridExport: cappedMonthly.reduce((s, m) => s + m.unpaidGridExport, 0),
    monthly: cappedMonthly
  };
}

export function simulateBatteryOnHourlySummary(hourlySummary, battery, options = {}) {
  if (!battery || !hourlySummary) return null;
  const usableCapacity = Math.max(0, Number(battery.capacity) || 0) * Math.max(0, Number(battery.dod) || 0);
  const efficiency = Math.max(0, Math.min(1, Number(battery.efficiency) || 0.9));
  const chargeEff = Math.sqrt(Math.max(efficiency, 0.01));
  const dischargeEff = chargeEff;
  const hourly = Array.isArray(hourlySummary.hourly8760) ? hourlySummary.hourly8760 : [];
  let soc = Math.max(0, Math.min(usableCapacity, Number(options.initialSocKwh) || 0));
  let batteryDischarge = 0;
  let chargedFromPv = 0;
  let remainingExport = 0;
  let remainingImport = 0;
  const monthly = new Array(12).fill(0).map(() => ({ load: 0, production: 0, selfConsumption: 0, gridExport: 0, gridImport: 0 }));
  const hourly8760 = [];

  if (usableCapacity <= 0 || hourly.length < 8760) {
    return {
      usableCapacity,
      batteryDischarge: 0,
      chargedFromPv: 0,
      remainingExport: hourlySummary.gridExport,
      remainingImport: hourlySummary.gridImport,
      totalSelfConsumption: hourlySummary.selfConsumption,
      gridIndependence: hourlySummary.annualLoad > 0 ? Math.min(1, hourlySummary.selfConsumption / hourlySummary.annualLoad) : 0,
      selfConsumptionRatio: hourlySummary.annualProduction > 0 ? Math.min(1, hourlySummary.selfConsumption / hourlySummary.annualProduction) : 0,
      cyclesPerYear: 0,
      paidGridExport: hourlySummary.paidGridExport ?? hourlySummary.gridExport,
      unpaidGridExport: hourlySummary.unpaidGridExport ?? 0,
      batteryExportPaid: 0,
      monthly: hourlySummary.monthly,
      hourly8760: hourly
    };
  }

  hourly.forEach(row => {
    const production = Math.max(0, Number(row.production) || 0);
    const load = Math.max(0, Number(row.load) || 0);
    const directSelf = Math.min(production, load);
    const pvSurplus = Math.max(0, production - directSelf);
    const deficit = Math.max(0, load - directSelf);
    const chargeFromPv = Math.min(pvSurplus, Math.max(0, usableCapacity - soc) / chargeEff);
    soc += chargeFromPv * chargeEff;
    const dischargeToLoad = Math.min(deficit, soc * dischargeEff);
    soc -= dischargeToLoad / dischargeEff;
    const exportAfterBattery = Math.max(0, pvSurplus - chargeFromPv);
    const importAfterBattery = Math.max(0, deficit - dischargeToLoad);
    const monthIdx = row.month ?? 0;

    chargedFromPv += chargeFromPv;
    batteryDischarge += dischargeToLoad;
    remainingExport += exportAfterBattery;
    remainingImport += importAfterBattery;
    monthly[monthIdx].load += load;
    monthly[monthIdx].production += production;
    monthly[monthIdx].selfConsumption += directSelf + dischargeToLoad;
    monthly[monthIdx].gridExport += exportAfterBattery;
    monthly[monthIdx].gridImport += importAfterBattery;
    hourly8760.push({
      ...row,
      selfConsumption: directSelf + dischargeToLoad,
      gridExport: exportAfterBattery,
      gridImport: importAfterBattery,
      batteryDischarge: dischargeToLoad,
      batteryChargeFromPv: chargeFromPv,
      batteryExport: 0,
      soc
    });
  });

  const totalSelf = hourlySummary.selfConsumption + batteryDischarge;
  const capped = capPaidExportByMonth(monthly);
  const cyclesPerYear = usableCapacity > 0 ? batteryDischarge / usableCapacity : 0;

  return {
    usableCapacity,
    batteryDischarge,
    chargedFromPv,
    remainingExport,
    remainingImport,
    totalSelfConsumption: totalSelf,
    gridIndependence: hourlySummary.annualLoad > 0 ? Math.min(1, totalSelf / hourlySummary.annualLoad) : 0,
    selfConsumptionRatio: hourlySummary.annualProduction > 0 ? Math.min(1, totalSelf / hourlySummary.annualProduction) : 0,
    cyclesPerYear,
    paidGridExport: capped.paidGridExport,
    unpaidGridExport: capped.unpaidGridExport,
    batteryExportPaid: 0,
    monthly: monthly.map((m, i) => ({
      production: Math.round(m.production),
      load: Math.round(m.load),
      selfConsumption: Math.round(m.selfConsumption),
      gridExport: Math.round(m.gridExport),
      gridImport: Math.round(m.gridImport),
      paidGridExport: capped.monthly[i].paidGridExport,
      unpaidGridExport: capped.monthly[i].unpaidGridExport
    })),
    hourly8760
  };
}

export function buildTariffModel(state) {
  const tariffType = state.tariffType || 'residential';
  const meta = TARIFF_META[tariffType] || TARIFF_META.residential;
  const annualConsumptionKwh = Math.max(0, Number(state.annualConsumptionKwh) || Number(state.dailyConsumption || 0) * 365);
  const skttRate = Math.max(0, Number(state.skttTariff) || Number(state.tariff) || 0);
  const contractedRate = Math.max(0, Number(state.contractedTariff) || Number(state.tariff) || 0);
  const tariffRegime = state.tariffRegime || 'auto';
  const effectiveRegime = tariffRegime === 'auto'
    ? (meta.skttLimitKwh && annualConsumptionKwh > meta.skttLimitKwh ? 'sktt' : 'pst')
    : tariffRegime;
  const importRateByRegime = effectiveRegime === 'sktt'
    ? skttRate
    : effectiveRegime === 'contract'
      ? contractedRate
      : Math.max(0, Number(state.tariff) || 0);

  return {
    type: tariffType,
    mode: state.tariffMode || tariffRegime,
    tariffRegime,
    effectiveRegime,
    annualConsumptionKwh,
    contractedPowerKw: Math.max(0, Number(state.contractedPowerKw) || 0),
    importRate: importRateByRegime,
    pstRate: Math.max(0, Number(state.tariff) || 0),
    skttRate,
    contractedRate,
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
  const annualBaseExport = batterySummary?.paidGridExport ?? hourlySummary.paidGridExport ?? batterySummary?.remainingExport ?? hourlySummary.gridExport;
  const selfRatio = annualEnergy > 0 ? annualBaseSelf / annualEnergy : 0;
  const exportRatio = annualEnergy > 0 ? annualBaseExport / annualEnergy : 0;
  const exportRate = exportRateOverride ?? tariffModel.exportRate;
  let cumulativeDiscounted = 0;
  let discountedPaybackYear = 0;

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
    cumulativeDiscounted += npv;
    if (cumulativeNet >= totalCost && paybackYear === 0) paybackYear = year;
    if (cumulativeDiscounted >= totalCost && discountedPaybackYear === 0) discountedPaybackYear = year;
    rows.push({
      year,
      energy: Math.round(degradedEnergy),
      rate: electricityPrice.toFixed(2),
      savings: Math.round(yearSavings),
      expenses: Math.round(yearExpenses),
      netCashFlow: Math.round(netCashFlow),
      cumulative: Math.round(cumulativeNet),
      npv: Math.round(npv),
      discountedCumulative: Math.round(cumulativeDiscounted)
    });
  }

  const discountedCashFlow = rows.reduce((s, row) => s + row.netCashFlow / Math.pow(1 + tariffModel.discountRate, row.year), 0);
  const projectNPV = discountedCashFlow - totalCost;
  const cumulativeSavings = rows.reduce((s, row) => s + row.savings, 0);
  const totalNetCashFlow = rows.reduce((s, row) => s + row.netCashFlow, 0);
  const roi = totalCost > 0 ? ((totalNetCashFlow - totalCost) / totalCost) * 100 : 0;

  return {
    rows,
    paybackYear,
    simplePaybackYear: paybackYear,
    discountedPaybackYear,
    totalExpenses25y,
    discountedCashFlow,
    projectNPV,
    cumulativeSavings,
    roi
  };
}

export function calcIRR(cfs) {
  const cashFlows = Array.isArray(cfs) ? cfs.map(v => Number(v) || 0) : [];
  let signChanges = 0;
  for (let i = 1; i < cashFlows.length; i++) {
    if ((cashFlows[i] >= 0) !== (cashFlows[i - 1] >= 0)) signChanges++;
  }
  if (signChanges !== 1) return 'N/A';
  const npv = rate => cashFlows.reduce((s, c, t) => s + c / Math.pow(1 + rate, t), 0);
  const min = -0.95;
  const max = 5.0;
  let lo = min;
  let hi = max;
  let fLo = npv(lo);
  let fHi = npv(hi);
  if (!isFinite(fLo) || !isFinite(fHi) || fLo * fHi > 0) return 'N/A';
  for (let i = 0; i < 160; i++) {
    const mid = (lo + hi) / 2;
    const fMid = npv(mid);
    if (!isFinite(fMid)) return 'N/A';
    if (Math.abs(fMid) < 1e-7 || Math.abs(hi - lo) < 1e-8) return (mid * 100).toFixed(1);
    if (fLo * fMid <= 0) {
      hi = mid;
      fHi = fMid;
    } else {
      lo = mid;
      fLo = fMid;
    }
  }
  const r = (lo + hi) / 2;
  return isFinite(r) ? (r * 100).toFixed(1) : 'N/A';
}

export function detectCalculationWarnings(results) {
  const warnings = [];
  if (!isFinite(results.annualEnergy) || results.annualEnergy < 0) warnings.push('Yıllık üretim geçersiz.');
  if (!isFinite(results.totalCost) || results.totalCost <= 0) warnings.push('Toplam maliyet geçersiz.');
  if (Number(results.pr) > 95) warnings.push('PR %95 üzerinde; ışınım/kayıp varsayımlarını kontrol edin.');
  if (Number(results.cf) > 30) warnings.push('Kapasite faktörü PV için olağan dışı yüksek.');
  if (Number(results.cableLossPct) > 3) warnings.push('Kablo kaybı %3 üzerinde; kesit ve mesafe kontrol edilmeli.');
  if (results.usedFallback) warnings.push('PVGIS verisi alınamadı; fallback PSH hesabı düşük güven seviyesidir.');
  if (results.nmMetrics?.unpaidGridExport > 0) warnings.push('Üretim fazlasının bir kısmı ödeme hesabına alınmadı; ihracat sınırı uygulanıyor.');
  if (results.tariffModel?.effectiveRegime === 'sktt' && !results.tariffModel?.skttRate) warnings.push('SKTT seçili ancak SKTT birim fiyatı tanımlı değil.');
  if (Number(results.tariffModel?.contractedPowerKw) > 0 && Number(results.systemPower) > Number(results.tariffModel.contractedPowerKw)) {
    warnings.push('Kurulu güç sözleşme gücünü aşıyor; bağlantı görüşü ve mahsuplaşma sınırları proje bazında kontrol edilmeli.');
  }
  return warnings;
}
