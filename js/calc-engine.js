// ═══════════════════════════════════════════════════════════
// CALC ENGINE — Hesaplama motoru
// GüneşHesap v2.0
// ═══════════════════════════════════════════════════════════
import {
  PANEL_TYPES, BATTERY_MODELS, PSH_FALLBACK, CITY_SUMMER_TEMPS,
  MONTH_WEIGHTS, INVERTER_TYPES, HEAT_PUMP_DATA
} from './data.js';
import { calculateBomTotal, selectBomItems } from './bom.js';
import {
  METHODOLOGY_VERSION, PVGIS_LOSS_PARAM, buildTariffModel, calcIRR,
  calculateEVLoad, calculateHeatPumpLoad, calculateSystemLayout,
  combineHourlyLoads, computeFinancialTable, detectCalculationWarnings,
  getMonthlyLoadKwh, buildBaseHourlyLoad8760, simulateBatteryOnHourlySummary,
  simulateHourlyEnergy, sumMonthlyArrays
} from './calc-core.js';
import { buildQuoteReadiness } from './turkey-regulation.js';
import { buildProposalGovernance } from './proposal-governance.js';
import { buildEvidenceRegistry, buildTariffSourceGovernance } from './evidence-governance.js';

const LOADING_MSGS = [
  "PVGIS'ten güneş ışınım verisi alınıyor...",
  "Hava durumu verileri işleniyor...",
  "Enerji üretimi hesaplanıyor...",
  "Finansal analiz yapılıyor..."
];

function spawnLoadingParticles() {
  const container = document.getElementById('loading-particles');
  if (!container) return;
  container.innerHTML = '';
  const colors = ['#F59E0B','#FCD34D','#06B6D4','#F97316','#34D399'];
  for (let i = 0; i < 18; i++) {
    const el = document.createElement('div');
    el.className = 'lp';
    const size = 4 + Math.random() * 7;
    el.style.cssText = `width:${size}px;height:${size}px;left:${Math.random()*100}%;bottom:0;background:${colors[Math.floor(Math.random()*colors.length)]};animation-duration:${3+Math.random()*4}s;animation-delay:${Math.random()*4}s;`;
    container.appendChild(el);
  }
}

function setLoadingProgress(pct, msgIdx) {
  const arc = document.getElementById('ring-fill-arc');
  const txt = document.getElementById('ring-pct-text');
  if (arc) arc.style.strokeDashoffset = 326.7 - (326.7 * pct / 100);
  if (txt) txt.textContent = Math.round(pct) + '%';
  for (let i = 1; i <= 4; i++) {
    const el = document.getElementById(`lstep-${i}`);
    if (!el) continue;
    const threshold = i * 25;
    el.classList.remove('active','done');
    if (pct >= threshold) el.classList.add('done');
    else if (pct >= threshold - 25) el.classList.add('active');
  }
  const msgEl = document.getElementById('loading-msg');
  if (msgEl && LOADING_MSGS[msgIdx]) msgEl.textContent = LOADING_MSGS[msgIdx];
}

function modelBatteryCost(battery) {
  const model = BATTERY_MODELS[battery?.model];
  const modelPrice = Number(model?.price_try);
  if (Number.isFinite(modelPrice) && modelPrice > 0) return Math.round(modelPrice);
  const capacity = Math.max(0, Number(battery?.capacity ?? model?.capacity) || 0);
  return Math.round(capacity * 8000);
}

function classifyOutputConfidence({ usedFallback, warnings = [], state }) {
  const blocking = [];
  if (usedFallback) blocking.push('PVGIS yerine PSH fallback kullanıldı.');
  if (!state?.roofGeometry) blocking.push('Çatı geometrisi saha keşfiyle doğrulanmadı.');
  if (state?.osmShadowEnabled && !state?.osmShadow?.buildings) blocking.push('OSM gölge analizi doğrulanmış bina verisi içermiyor.');
  if (warnings.length) blocking.push(...warnings.slice(0, 5));
  if (state?.quoteReadyApproved === true && state?.quoteInputsVerified === true && !usedFallback && blocking.length === 0) {
    return { level: 'quote-ready', label: 'quote-ready', blockers: [] };
  }
  if (!usedFallback && blocking.length <= 2) {
    return { level: 'engineering estimate', label: 'engineering estimate', blockers: blocking };
  }
  return { level: 'rough estimate', label: 'rough estimate', blockers: blocking };
}

export function calculateBatteryMetrics(annualEnergy, dailyConsumption, battery) {
  const dailyProduction = annualEnergy / 365;
  const usableCapacity  = battery.capacity * battery.dod;
  const dayRatio = 0.35;
  const dayConsumption   = dailyConsumption * dayRatio;
  const nightConsumption = dailyConsumption * (1 - dayRatio);

  const directSelfConsumption = Math.min(dailyProduction, dayConsumption);
  const excessToBattery       = Math.max(0, dailyProduction - dayConsumption);
  const batteryStored         = Math.min(excessToBattery * battery.efficiency, usableCapacity);
  const nightCovered          = Math.min(batteryStored, nightConsumption);

  const totalSelfConsumed = directSelfConsumption + nightCovered;
  const gridIndependence  = Math.min(totalSelfConsumed / dailyConsumption, 1.0);
  const nightCoverage     = nightConsumption > 0 ? Math.min(nightCovered / nightConsumption, 1.0) : 0;
  const batteryCost       = modelBatteryCost(battery);

  return {
    gridIndependence: (gridIndependence * 100).toFixed(1),
    nightCoverage:    (nightCoverage * 100).toFixed(1),
    usableCapacity:   usableCapacity.toFixed(1),
    batteryCost,
    dailyProduction:  dailyProduction.toFixed(1),
    batteryStored:    batteryStored.toFixed(1),
    modelName:        BATTERY_MODELS[battery.model]?.name || 'Batarya'
  };
}

export function calculateNMMetrics(annualEnergy, systemPower, dailyConsumption, tariffModelOrRate, annualPriceIncrease, usdToTry, hourlySummary = null, batterySummary = null) {
  const tariffModel = typeof tariffModelOrRate === 'object' ? tariffModelOrRate : null;
  const tariff = tariffModel ? tariffModel.exportRate : tariffModelOrRate;
  const annualConsumption = hourlySummary?.annualLoad ?? dailyConsumption * 365;
  const selfConsumedEnergy = batterySummary?.totalSelfConsumption ?? hourlySummary?.selfConsumption ?? Math.min(annualConsumption, annualEnergy);
  const selfConsumptionRatio = annualEnergy > 0 ? Math.min(selfConsumedEnergy / annualEnergy, 1.0) : 0;
  const annualGridExport = Math.round(batterySummary?.remainingExport ?? hourlySummary?.gridExport ?? annualEnergy * (1 - selfConsumptionRatio));
  const paidGridExport = Math.round(batterySummary?.paidGridExport ?? hourlySummary?.paidGridExport ?? annualGridExport);
  const unpaidGridExport = Math.round(batterySummary?.unpaidGridExport ?? hourlySummary?.unpaidGridExport ?? Math.max(0, annualGridExport - paidGridExport));

  const annualExportRevenue = Math.round(paidGridExport * Math.max(0, tariff));

  return {
    annualGridExport,
    paidGridExport,
    unpaidGridExport,
    annualExportRevenue,
    selfConsumptionRatio,
    annualConsumption: Math.round(annualConsumption),
    selfConsumedEnergy: Math.round(selfConsumedEnergy),
    selfConsumptionPct: (selfConsumptionRatio * 100).toFixed(1),
    isLicenseFree: true,
    systemType: tariffModel?.exportCompensationPolicy?.interval === 'hourly'
      ? 'Lisanssız Üretim — Saatlik mahsuplaşma + yıllık tüketim ihracat sınırı'
      : 'Lisanssız Üretim — Aylık mahsuplaşma + tüketim ihracat sınırı',
    settlementMode: tariffModel?.exportCompensationPolicy?.interval || (hourlySummary ? 'hourly-profile' : 'annual-fallback'),
    exportPolicy: tariffModel?.exportCompensationPolicy || null
  };
}

export async function runCalculation() {
  const state = window.state;
  const fallbackBanner = document.getElementById('fallback-banner');
  if (fallbackBanner) fallbackBanner.style.display = 'none';
  spawnLoadingParticles();
  setLoadingProgress(10, 0);

  let msgIdx = 0;
  const msgInterval = setInterval(() => {
    msgIdx = Math.min(msgIdx + 1, 3);
    setLoadingProgress(10 + msgIdx * 23, msgIdx);
  }, 1200);

  const layout = calculateSystemLayout(state);
  const panel = layout.panel;
  const panelArea = layout.panelArea;
  const allSections = layout.sections;

  const totalPCCheck = layout.panelCount;
  if (totalPCCheck === 0) {
    clearInterval(msgInterval);
    window.showToast('Panel sayısı sıfır. Lütfen çatı alanını artırın (min ~5 m² gerekli).', 'error');
    window.goToStep(3); return;
  }

  let avgSummerTemp = CITY_SUMMER_TEMPS[state.cityName] || CITY_SUMMER_TEMPS['default'];
  const currentMonth = new Date().getMonth();
  const isSummerSeason = currentMonth >= 4 && currentMonth <= 8;
  if (isSummerSeason) {
    try {
      const meteoUrl = `https://api.open-meteo.com/v1/forecast?latitude=${state.lat}&longitude=${state.lon}&daily=temperature_2m_max&timezone=Europe%2FIstanbul&past_days=92`;
      const ctrl2 = new AbortController();
      const t2 = setTimeout(() => ctrl2.abort(), 8000);
      const res2 = await fetch(meteoUrl, { signal: ctrl2.signal });
      clearTimeout(t2);
      if (res2.ok) {
        const d2 = await res2.json();
        if (d2.daily?.temperature_2m_max?.length) {
          const temps = d2.daily.temperature_2m_max.filter(t => t !== null);
          if (temps.length > 0) avgSummerTemp = temps.reduce((a,b)=>a+b,0)/temps.length;
        }
      }
    } catch(e) {
      window.showToast?.('Anlık hava verisi alınamadı, sabit ortalama kullanılıyor.', 'info');
    }
  }

  // İnverter tipi entegrasyonu
  const inverterData = INVERTER_TYPES[state.inverterType || 'string'];
  const inverterEfficiencyFactor = inverterData.efficiency;

  const bifacialBonus = (state.panelType === 'bifacial' && panel.bifacialGain > 0) ? (1 + panel.bifacialGain) : 1;
  const tempLoss = panel.tempCoeff * (avgSummerTemp - 25);

  // Kablo kaybı entegrasyonu
  let cableLossFactor = 1.0;
  let cableLossPct = 0;
  if (state.cableLossEnabled && state.cableLoss) {
    cableLossPct = state.cableLoss.totalLossPct || 0;
    cableLossFactor = 1 - cableLossPct / 100;
  }
  const osmShadowFactor = state.osmShadowEnabled
    ? Math.max(0, Number(state.osmShadow?.shadowFactorPct) || 0)
    : 0;

  const sectionResults = await Promise.all(allSections.map(async sec => {
    const secPC = Math.floor(sec.area * 0.75 / panelArea);
    const secPower = secPC * panel.wattPeak / 1000;
    if (secPower <= 0) return null;

    let rawEnergy = null, rawMonthly = null, rawPoa = null, usedFallback = false;

    async function fetchPVGIS(retries = 3) {
      const pvgisAzimut = sec.azimuth - 180;
      const baseParams = `lat=${state.lat}&lon=${state.lon}&peakpower=${secPower}&loss=${PVGIS_LOSS_PARAM}&angle=${sec.tilt}&aspect=${pvgisAzimut}&outputformat=json&pvtechchoice=crystSi&mountingplace=free`;
      const urls = [
        `https://re.jrc.ec.europa.eu/api/v5_2/PVcalc?${baseParams}`,
        `https://re.jrc.ec.europa.eu/api/v5_3/PVcalc?${baseParams}`,
        `https://re.jrc.ec.europa.eu/api/PVcalc?${baseParams}`,
      ];
      for (let attempt = 0; attempt < retries; attempt++) {
        const url = urls[Math.min(attempt, urls.length - 1)];
        try {
          const ctrl = new AbortController();
          const timeout = setTimeout(() => ctrl.abort(), 30000);
          const res = await fetch(url, { signal: ctrl.signal, credentials: 'omit', cache: 'no-store' });
          clearTimeout(timeout);
          if (res.ok) {
            const data = await res.json();
            const ey = data.outputs?.totals?.fixed?.E_y;
            if (ey && ey > 0) {
              rawEnergy = ey;
              rawPoa = data.outputs?.totals?.fixed?.['H(i)_y'] || data.outputs?.totals?.fixed?.H_i_y || null;
              if (data.outputs?.monthly?.fixed) rawMonthly = data.outputs.monthly.fixed.map(m => m.E_m);
              window._pvgisLastError = null;
              return;
            }
          } else {
            window._pvgisLastError = `HTTP ${res.status} (deneme ${attempt + 1})`;
            console.warn('[PVGIS]', window._pvgisLastError);
          }
        } catch(e) {
          window._pvgisLastError = e?.message || String(e);
          console.warn('[PVGIS] Deneme', attempt + 1, 'başarısız:', e);
        }
        if (attempt < retries - 1) await new Promise(r => setTimeout(r, 2000));
      }
    }
    await fetchPVGIS(3);

    if (!rawEnergy) {
      usedFallback = true;
      const psh = PSH_FALLBACK[state.cityName] || PSH_FALLBACK['default'];
      rawEnergy = secPower * psh * 365 * 0.80;
      rawPoa = psh * 365;
    }

    // Kayıp sıralaması (doğru fiziksel sıra):
    // 1. Sıcaklık/azimut (fallback için; PVGIS loss=0 ile zaten hesaplıyor)
    // 2. Gölgelenme (yer-spesifik, PVGIS bilmiyor)
    // 3. Kirlenme (yer-spesifik)
    // 4. Bifaciyal kazanım (arka yüzeyden ek enerji)
    // 5. İnverter verimi (AC dönüşümü)
    // 6. Kablo kaybı (iletim)
    const effectiveShadingFactor = Math.min(80, Math.max(0, Number(sec.shadingFactor) || 0) + osmShadowFactor);
    const adjustedE = rawEnergy
      * (usedFallback ? (1 + tempLoss) : 1.0)
      * (usedFallback ? sec.azimuthCoeff : 1.0)
      * (1 - effectiveShadingFactor / 100)
      * (1 - state.soilingFactor / 100)
      * bifacialBonus
      * inverterEfficiencyFactor
      * cableLossFactor;

    let monthly;
    if (!rawMonthly) {
      monthly = MONTH_WEIGHTS.map(w => Math.round(adjustedE * w));
    } else {
      const monthlySum = rawMonthly.reduce((a,b)=>a+b,0);
      const factor = monthlySum > 0 ? adjustedE / monthlySum : 0;
      monthly = monthlySum > 0 ? rawMonthly.map(v => Math.round(v * factor)) : MONTH_WEIGHTS.map(w => Math.round(adjustedE * w));
    }

    return {
      panelCount: secPC, systemPower: secPower,
      annualEnergy: adjustedE, monthlyData: monthly,
      pvgisRawEnergy: rawEnergy, pvgisPoa: rawPoa, usedFallback,
      shadingLoss:    rawEnergy * (effectiveShadingFactor / 100),
      effectiveShadingFactor,
      osmShadowFactor,
      tempLossEnergy: usedFallback ? rawEnergy * Math.abs(Math.min(tempLoss, 0)) : 0,
      azimuthLossEnergy: usedFallback ? rawEnergy * (1 - sec.azimuthCoeff) : 0,
      bifacialGainEnergy: rawEnergy * (bifacialBonus - 1),
      soilingLoss: rawEnergy * (state.soilingFactor / 100),
      cableLoss: rawEnergy * cableLossPct / 100,
      sectionArea: sec.area, sectionTilt: sec.tilt, sectionAzimuthName: sec.azimuthName
    };
  }));

  const validSections = sectionResults.filter(r => r !== null);
  if (validSections.length === 0) {
    clearInterval(msgInterval);
    window.showToast('Hesaplama başarısız. Lütfen tekrar deneyin.', 'error');
    window.goToStep(3); return;
  }

  const panelCount    = validSections.reduce((s, r) => s + r.panelCount, 0);
  const systemPower   = validSections.reduce((s, r) => s + r.systemPower, 0);
  const adjustedEnergy= validSections.reduce((s, r) => s + r.annualEnergy, 0);
  const monthlyData   = validSections.reduce((agg, r) => agg.map((v,i) => v + r.monthlyData[i]), new Array(12).fill(0));
  const usedFallback  = validSections.some(r => r.usedFallback);
  const pvgisRawEnergy= validSections.reduce((s, r) => s + r.pvgisRawEnergy, 0);
  const pvgisPoaWeighted = validSections.reduce((s, r) => s + (Number(r.pvgisPoa) || 0) * r.systemPower, 0);
  const pvgisPoa = systemPower > 0 ? pvgisPoaWeighted / systemPower : 0;
  const shadingLoss   = validSections.reduce((s, r) => s + r.shadingLoss, 0);
  const tempLossEnergy= validSections.reduce((s, r) => s + r.tempLossEnergy, 0);
  const azimuthLossEnergy   = validSections.reduce((s, r) => s + r.azimuthLossEnergy, 0);
  const bifacialGainEnergy  = validSections.reduce((s, r) => s + r.bifacialGainEnergy, 0);
  const soilingLoss         = validSections.reduce((s, r) => s + r.soilingLoss, 0);
  const totalCableLoss      = validSections.reduce((s, r) => s + (r.cableLoss || 0), 0);
  const effectiveShadingFactor = systemPower > 0
    ? validSections.reduce((s, r) => s + (Number(r.effectiveShadingFactor) || 0) * r.systemPower, 0) / systemPower
    : Number(state.shadingFactor) || 0;

  clearInterval(msgInterval);
  setLoadingProgress(100, 3);
  if (usedFallback) {
    const banner = document.getElementById('fallback-banner');
    if (banner) {
      const reason = window._pvgisLastError ? ` (${window._pvgisLastError.slice(0, 80)})` : '';
      banner.textContent = `PVGIS API'sine ulaşılamadı${reason}. Yerel güneşlenme verileriyle hesaplama yapılıyor.`;
      banner.style.display = 'block';
    }
  }

  // ── 2026 Maliyet Kırılımı ───────────────────────────────────────────────────
  // İnverter tipi maliyeti
  const invTypeKey = state.inverterType || 'string';
  const invType = INVERTER_TYPES[invTypeKey];
  const invPrices = invType.pricePerKWp;
  const invUnit = systemPower < 10 ? invPrices.lt10 : systemPower < 50 ? invPrices.lt50 : invPrices.gt50;

  const costOverrides = state.costOverridesEnabled ? (state.costOverrides || {}) : {};
  const pickOverride = (key, fallback) => Number.isFinite(Number(costOverrides[key])) ? Number(costOverrides[key]) : fallback;
  const panelPricePerWatt = pickOverride('panelPricePerWatt', panel.pricePerWatt);
  const invUnitEffective = pickOverride('inverterPerKwp', invUnit);
  const mountingPerKwp = pickOverride('mountingPerKwp', 2200);
  const dcCablePerKwp = pickOverride('dcCablePerKwp', 600);
  const acElecPerKwp = pickOverride('acElecPerKwp', 900);
  const laborPerKwp = pickOverride('laborPerKwp', 1800);
  const defaultPermit = systemPower < 5 ? 8000 : systemPower < 10 ? 6000 : systemPower < 20 ? 5000 : 4000;
  const permitCost  = pickOverride('permitFixed', defaultPermit);
  const kdvRate = Number.isFinite(costOverrides.kdvRate) ? costOverrides.kdvRate : 0.20;

  const panelCost   = systemPower * 1000 * panelPricePerWatt;
  const inverterCost= systemPower * invUnitEffective;
  const mountingCost= systemPower * mountingPerKwp;
  const dcCableCost = systemPower * dcCablePerKwp;
  const acElecCost  = systemPower * acElecPerKwp;
  const laborCost   = systemPower * laborPerKwp;
  const subtotal    = panelCost + inverterCost + mountingCost + dcCableCost + acElecCost + laborCost + permitCost;
  const kdv         = subtotal * kdvRate;
  let solarCost     = subtotal + kdv;
  const bomTotalsForSystem = Array.isArray(state.bomItems) && state.bomItems.length
    ? calculateBomTotal(selectBomItems(state.bomItems, state.bomSelection || {}), {
        wp: systemPower * 1000,
        kwp: systemPower,
        fixed: 1,
        meter: Math.max(20, systemPower * 10),
        day: Math.max(1, Math.ceil(systemPower / 5))
      })
    : null;
  if (bomTotalsForSystem) state.bomTotals = bomTotalsForSystem;

  let tariffModel = buildTariffModel(state);
  let tariff = tariffModel.importRate || 7.16;

  // ── EV / Isı pompası ek yükleri ana tüketim profiline bağlanır ──────────────
  let evMetrics = null;
  const evLoad = state.evEnabled && state.ev ? calculateEVLoad(state.ev) : { annualKwh: 0, dailyKwh: 0 };

  let heatPumpMetrics = null;
  const heatPumpLoad = state.heatPumpEnabled && state.heatPump
    ? calculateHeatPumpLoad(state.heatPump, HEAT_PUMP_DATA)
    : { annualKwh: 0, heatDemand: 0, cop: 0 };

  const extraMonthlyLoad = sumMonthlyArrays(evLoad.monthlyKwh, heatPumpLoad.monthlyKwh);
  const monthlyLoad = getMonthlyLoadKwh(state, extraMonthlyLoad);
  const baseMonthlyLoad = getMonthlyLoadKwh(state, 0);
  const baseHourlyLoad = Array.isArray(state.hourlyConsumption8760) && state.hourlyConsumption8760.length >= 8760
    ? state.hourlyConsumption8760.slice(0, 8760).map(v => Math.max(0, Number(v) || 0))
    : buildBaseHourlyLoad8760(baseMonthlyLoad, state.tariffType);
  const hourlyLoad8760 = combineHourlyLoads(baseHourlyLoad, evLoad.hourly8760, heatPumpLoad.hourly8760);

  tariffModel = buildTariffModel({
    ...state,
    annualConsumptionKwh: monthlyLoad.reduce((a, b) => a + b, 0)
  });
  tariff = tariffModel.importRate || tariffModel.pstRate || 7.16;
  const annualPriceIncrease = tariffModel.annualPriceIncrease;
  const discountRate = tariffModel.discountRate;

  if (state.evEnabled && state.ev) {
    evMetrics = calculateEVMetrics(adjustedEnergy, state.dailyConsumption, state.ev, tariff);
  }
  if (state.heatPumpEnabled && state.heatPump) {
    heatPumpMetrics = calculateHeatPumpMetrics(state.heatPump, tariff, heatPumpLoad);
  }

  const hourlySummaryRaw = simulateHourlyEnergy(monthlyData, monthlyLoad, {
    tariffType: state.tariffType,
    hourlyLoad8760,
    exportPolicy: tariffModel.exportCompensationPolicy,
    previousYearConsumptionKwh: state.previousYearConsumptionKwh,
    currentYearConsumptionKwh: state.currentYearConsumptionKwh,
    sellableExportCapKwh: state.sellableExportCapKwh,
    settlementDate: state.settlementDate
  });

  let bessMetrics = null;
  let batterySummary = null;
  let batteryCostVal = 0;
  if (state.batteryEnabled) {
    batterySummary = simulateBatteryOnHourlySummary(hourlySummaryRaw, state.battery, {
      paidBatteryExportAllowed: false,
      exportPolicy: tariffModel.exportCompensationPolicy
    });
    bessMetrics = calculateBatteryMetrics(adjustedEnergy, hourlySummaryRaw.annualLoad / 365, state.battery);
    if (batterySummary) {
      bessMetrics.gridIndependence = (batterySummary.gridIndependence * 100).toFixed(1);
      bessMetrics.nightCoverage = (Math.min(1, batterySummary.batteryDischarge / Math.max(hourlySummaryRaw.gridImport, 1)) * 100).toFixed(1);
      bessMetrics.batteryStored = batterySummary.batteryDischarge.toFixed(1);
      bessMetrics.cyclesPerYear = batterySummary.cyclesPerYear.toFixed(0);
    }
    batteryCostVal = bessMetrics.batteryCost;
  }
  const totalCost = solarCost + batteryCostVal;

  let nmMetrics = calculateNMMetrics(
    adjustedEnergy, systemPower, hourlySummaryRaw.annualLoad / 365,
    tariffModel, annualPriceIncrease, state.usdToTry, hourlySummaryRaw, batterySummary
  );
  if (!state.netMeteringEnabled) {
    nmMetrics = { ...nmMetrics, annualExportRevenue: 0, systemType: 'Şebeke satışı kapalı — fazla üretim geliri 0 TL' };
  }

  const selfConsumptionRatio = nmMetrics.selfConsumptionRatio;
  const exportRate = state.netMeteringEnabled
    ? tariffModel.exportRate
    : 0;
  const annualSavings = nmMetrics.selfConsumedEnergy * tariff + (state.netMeteringEnabled ? nmMetrics.paidGridExport * exportRate : 0);
  const co2Savings = adjustedEnergy * 0.442 / 1000;
  const trees = Math.round(co2Savings * 1000 / 21);

  const annualOMCost = state.omEnabled ? Math.round(solarCost * (state.omRate / 100)) : 0;
  const annualInsurance = state.omEnabled ? Math.round(solarCost * (state.insuranceRate / 100)) : 0;
  const inverterLifetime = invType.lifetime || 12;
  const inverterReplaceCost = state.omEnabled ? Math.round(inverterCost * 1.1) : 0;
  const batteryModel = BATTERY_MODELS[state.battery?.model];
  const batteryLifetime = state.batteryEnabled ? (Number(state.battery?.warranty || batteryModel?.warranty) || 10) : 0;
  const batteryReplaceCost = state.batteryEnabled ? Math.round(batteryCostVal * 0.85) : 0;

  const lidFactor = panel.firstYearDeg || 0;
  const financial = computeFinancialTable({
    annualEnergy: adjustedEnergy,
    hourlySummary: hourlySummaryRaw,
    batterySummary,
    totalCost,
    tariffModel,
    panel,
    annualOMCost,
    annualInsurance,
    inverterLifetime,
    inverterReplaceCost,
    netMeteringEnabled: state.netMeteringEnabled,
    exportRateOverride: exportRate,
    batteryLifetime,
    batteryReplaceCost
  });
  const yearlyTable = financial.rows;
  const paybackYear = financial.paybackYear;
  const discountedPaybackYear = financial.discountedPaybackYear;
  const totalExpenses25y = financial.totalExpenses25y;
  const npvTotal = financial.projectNPV;
  const roi = financial.roi;
  const irr = calcIRR([-totalCost, ...yearlyTable.map(y => y.netCashFlow)]);

  let lcoeCostSum = totalCost;
  let lcoeEnergySum = 0;
  yearlyTable.forEach(y => {
    const df = Math.pow(1 + discountRate, y.year);
    lcoeCostSum += (y.expenses || 0) / df;
    lcoeEnergySum += y.energy / df;
  });
  const lcoe = lcoeEnergySum > 0 ? Number((lcoeCostSum / lcoeEnergySum).toFixed(2)) : null;

  const ysp  = systemPower > 0 ? (adjustedEnergy / systemPower).toFixed(0) : 0;
  const cf   = systemPower > 0 ? ((adjustedEnergy / (systemPower * 8760)) * 100).toFixed(1) : 0;
  const psh  = systemPower > 0 ? adjustedEnergy / (systemPower * 365) : 0;
  const pr = (systemPower > 0 && state.ghi > 0)
    ? (adjustedEnergy / (systemPower * (pvgisPoa || state.ghi)))
    : (adjustedEnergy / (pvgisRawEnergy || 1));

  // ── Yapısal Kontrol ──────────────────────────────────────────────────────────
  let structuralCheck = null;
  if (window.calculateStructural) {
    structuralCheck = window.calculateStructural(state.cityName, state.tilt, systemPower, panelArea * panelCount);
  }

  // ── Vergi Avantajı ───────────────────────────────────────────────────────────
  let taxMetrics = null;
  if (state.taxEnabled && state.tax) {
    taxMetrics = calculateTaxBenefits(totalCost, npvTotal, state.tax, discountRate, kdv);
  }
  const billAnalysis = state.billAnalysisEnabled && Array.isArray(state.monthlyConsumption)
    ? calculateBillAnalysis(state.monthlyConsumption, monthlyData, tariff)
    : null;

  const results = {
    panelCount, systemPower, annualEnergy: Math.round(adjustedEnergy),
    annualSavings: Math.round(annualSavings), totalCost: Math.round(totalCost),
    paybackYear, simplePaybackYear: financial.simplePaybackYear, discountedPaybackYear,
    npvTotal: Math.round(npvTotal), discountedCashFlow: Math.round(financial.discountedCashFlow), roi: roi.toFixed(1),
    co2Savings: co2Savings.toFixed(2), trees, monthlyData,
    tempLoss: (tempLoss * 100).toFixed(2), pr: (pr * 100).toFixed(1),
    psh: psh.toFixed(2), avgSummerTemp: avgSummerTemp.toFixed(1),
    usedFallback,
    pvgisRawEnergy: Math.round(pvgisRawEnergy), pvgisPoa: Math.round(pvgisPoa),
    shadingLoss: Math.round(shadingLoss),
    effectiveShadingFactor: Number(effectiveShadingFactor.toFixed(1)),
    tempLossEnergy: Math.round(tempLossEnergy),
    azimuthLossEnergy: Math.round(azimuthLossEnergy),
    bifacialGainEnergy: Math.round(bifacialGainEnergy),
    soilingLoss: Math.round(soilingLoss),
    cableLoss: Math.round(totalCableLoss),
    cableLossPct,
    osmShadowFactor,
    ysp, cf, irr, lcoe,
    tariff, annualPriceIncrease, discountRate, tariffModel,
    yearlyTable,
    annualOMCost, annualInsurance, inverterReplaceCost, inverterLifetime, batteryReplaceCost, batteryLifetime, totalExpenses25y,
    lidFactor: (lidFactor * 100).toFixed(1),
    inverterType: invTypeKey,
    inverterEfficiency: (inverterEfficiencyFactor * 100).toFixed(1),
    costBreakdown: {
      panel: Math.round(panelCost), inverter: Math.round(inverterCost),
      mounting: Math.round(mountingCost), dcCable: Math.round(dcCableCost),
      acElec: Math.round(acElecCost), labor: Math.round(laborCost),
      permits: Math.round(permitCost), subtotal: Math.round(subtotal),
      kdv: Math.round(kdv), kdvRate, total: Math.round(solarCost), invUnit: invUnitEffective,
      battery: batteryCostVal, totalWithBattery: Math.round(totalCost),
      bom: bomTotalsForSystem || state.bomTotals || null
    },
    methodologyVersion: METHODOLOGY_VERSION,
    pvgisLossParam: PVGIS_LOSS_PARAM,
    displayCurrency: state.displayCurrency || 'TRY',
    usdToTry: state.usdToTry || 38.5,
    netMeteringEnabled: !!state.netMeteringEnabled,
    calculationMode: usedFallback ? 'fallback-psh' : 'pvgis-live',
    pvgisFailReason: usedFallback ? (window._pvgisLastError || 'unknown') : null,
    hourlySummary: hourlySummaryRaw,
    batterySummary,
    monthlyLoad,
    evLoad,
    heatPumpLoad,
    bessMetrics, nmMetrics,
    evMetrics, heatPumpMetrics, structuralCheck, taxMetrics, billAnalysis,
    sectionResults: validSections.length > 1 ? validSections : null
  };
  results.calculationWarnings = detectCalculationWarnings(results);
  results.evidenceGovernance = buildEvidenceRegistry(state, results);
  results.tariffSourceGovernance = buildTariffSourceGovernance(tariffModel, results.evidenceGovernance);
  if (results.tariffSourceGovernance.warning) results.calculationWarnings.push(results.tariffSourceGovernance.warning);
  results.quoteReadiness = buildQuoteReadiness({ state, results, tariffModel, evidenceGovernance: results.evidenceGovernance });
  results.proposalGovernance = buildProposalGovernance(state, results);
  const confidence = classifyOutputConfidence({ usedFallback, warnings: results.calculationWarnings, state });
  const proposalLevel = results.proposalGovernance?.confidence?.level;
  results.confidenceLevel = results.quoteReadiness.status === 'quote-ready' && proposalLevel === 'quote-ready proposal'
    ? 'quote-ready proposal'
    : proposalLevel || confidence.level;
  results.confidence = {
    ...confidence,
    score: results.proposalGovernance?.confidence?.score,
    factors: results.proposalGovernance?.confidence?.factors || confidence.blockers || []
  };
  state.proposalRevisions = [results.proposalGovernance.revision, ...(state.proposalRevisions || [])].slice(0, 20);
  window.state.results = results;
  window.persistProposalState?.();

  // Step-4'te mühendis hesap özeti
  if (window.renderEngCalcPanel) window.renderEngCalcPanel();

  setTimeout(() => {
    window.goToStep(5);
    window.renderResults();
    window.launchConfetti();
    // Saatlik profili güncelle
    if (window.renderHourlyProfile) window.renderHourlyProfile();
    // Senaryo analizini güncelle
    if (window.renderScenarioAnalysis) window.renderScenarioAnalysis();
    // Güneş yolu diyagramını güncelle
    if (window.renderSunPath) window.renderSunPath();
  }, 500);
}

// ── EV Şarj Hesabı ─────────────────────────────────────────────────────────
function calculateEVMetrics(annualEnergy, dailyConsumption, ev, tariff) {
  const daily_kWh = ev.dailyKm * ev.consumptionPer100km / 100;
  const annual_kWh = daily_kWh * 365;
  const total_consumption = dailyConsumption + daily_kWh;

  // Gündüz şarj → self-consumption
  let solarChargeRatio = 0;
  if (ev.chargeTime === 'day' && daily_kWh > 0) {
    const dailySolarPeak = annualEnergy / 365;
    const practicalDaytimeEnergy = Math.max(0, dailySolarPeak) * 0.45;
    solarChargeRatio = Math.min(practicalDaytimeEnergy / daily_kWh, 0.8);
  }

  const solarChargeKwh = annual_kWh * solarChargeRatio;
  const gridChargeKwh = annual_kWh * (1 - solarChargeRatio);

  const fuelCostSaved = ev.dailyKm * 365 * (ev.fuelPricePerLiter || 45) * (ev.fuelConsumptionL100km || 8) / 100;
  const electricityCost = annual_kWh * tariff;
  const netSaving = fuelCostSaved - electricityCost;

  const panelArea = 1.134 * 1.762;
  const productionPerPanel = annualEnergy / Math.max(1, Math.floor(window.state.roofArea * 0.75 / panelArea));
  const additionalPanels = productionPerPanel > 0 ? Math.ceil(annual_kWh / productionPerPanel) : 0;

  return {
    daily_kWh: daily_kWh.toFixed(2),
    annual_kWh: Math.round(annual_kWh),
    solarChargeKwh: Math.round(solarChargeKwh),
    gridChargeKwh: Math.round(gridChargeKwh),
    solarChargeRatio: (solarChargeRatio * 100).toFixed(1),
    fuelCostSaved: Math.round(fuelCostSaved),
    electricityCost: Math.round(electricityCost),
    netSaving: Math.round(netSaving),
    additionalPanels
  };
}

// ── Isı Pompası Hesabı ──────────────────────────────────────────────────────
function calculateHeatPumpMetrics(hp, tariff, load = null) {
  const hpData = HEAT_PUMP_DATA;
  const insulation = hp.insulation === 'low' ? 'poor' : hp.insulation;
  const cop = load?.cop || hpData.spf_heating?.[insulation] || hpData.cop_heating?.[insulation] || 3.5;
  const annual_heat_demand = load?.heatDemand ?? (Math.max(0, Number(hp.area) || 0) * (hpData.heat_load[insulation] || 80) * 8 * hpData.heating_season_months * 30 / 1000);
  const hp_electricity = load?.annualKwh ?? annual_heat_demand / cop;
  let gas_cost = 0;
  if (hp.currentHeating === 'fueloil') gas_cost = (annual_heat_demand / hpData.fuel_oil_kwh_per_liter) * hpData.fuel_oil_price;
  else if (hp.currentHeating === 'electric') gas_cost = annual_heat_demand * tariff;
  else gas_cost = (annual_heat_demand / hpData.gas_kwh_per_m3) * hpData.gas_price;
  const electricity_cost = hp_electricity * tariff;
  const savings = gas_cost - electricity_cost;

  return {
    annual_heat_demand: Math.round(annual_heat_demand),
    hp_electricity: Math.round(hp_electricity),
    gas_cost: Math.round(gas_cost),
    electricity_cost: Math.round(electricity_cost),
    savings: Math.round(savings),
    cop: cop.toFixed(1),
    coverageRatio: 0
  };
}

function calculateBillAnalysis(monthlyConsumption, monthlyProduction, tariff) {
  const rows = monthlyProduction.map((production, i) => {
    const consumption = Math.max(0, Number(monthlyConsumption[i]) || 0);
    const selfCovered = Math.min(consumption, production);
    return {
      month: i,
      consumption: Math.round(consumption),
      production: Math.round(production),
      coveragePct: consumption > 0 ? ((selfCovered / consumption) * 100).toFixed(1) : '0.0',
      surplus: Math.round(Math.max(0, production - consumption)),
      deficit: Math.round(Math.max(0, consumption - production)),
      estimatedSaving: Math.round(selfCovered * tariff)
    };
  });
  return {
    annualConsumption: rows.reduce((s, r) => s + r.consumption, 0),
    annualProduction: rows.reduce((s, r) => s + r.production, 0),
    annualSaving: rows.reduce((s, r) => s + r.estimatedSaving, 0),
    avgCoveragePct: rows.reduce((s, r) => s + Number(r.coveragePct), 0) / 12,
    rows
  };
}

// ── Vergi Avantajı Hesabı ────────────────────────────────────────────────────
function calculateTaxBenefits(totalCost, npvBase, tax, discountRate, kdvAmount = 0) {
  const annual_dep = totalCost / tax.amortizationYears;
  let taxShieldNPV = 0;
  for (let y = 1; y <= tax.amortizationYears; y++) {
    taxShieldNPV += (annual_dep * tax.corporateTaxRate / 100) / Math.pow(1 + discountRate, y);
  }
  const kdv_recovery = tax.kdvRecovery ? kdvAmount : 0;
  const incentiveRate = Math.max(0, Number(tax.investmentContribution) || 0) / 100;
  const hasIncentive = !!(tax.investmentDeduction || tax.hasIncentiveCert || incentiveRate > 0);
  const investment_deduction = hasIncentive ? totalCost * incentiveRate * (tax.corporateTaxRate / 100) : 0;

  const totalTaxBenefit = taxShieldNPV + kdv_recovery + investment_deduction;
  const effectiveCost = totalCost - totalTaxBenefit;

  return {
    annual_dep: Math.round(annual_dep),
    taxShieldNPV: Math.round(taxShieldNPV),
    kdv_recovery: Math.round(kdv_recovery),
    investment_deduction: Math.round(investment_deduction),
    totalTaxBenefit: Math.round(totalTaxBenefit),
    effectiveCost: Math.round(effectiveCost),
    adjustedNPV: Math.round(npvBase + totalTaxBenefit)
  };
}

// window'a expose et
window.runCalculation = runCalculation;
window.calculateBatteryMetrics = calculateBatteryMetrics;
window.calculateNMMetrics = calculateNMMetrics;
