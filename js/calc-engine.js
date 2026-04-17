// ═══════════════════════════════════════════════════════════
// CALC ENGINE — Hesaplama motoru
// Solar Rota v2.0
// ═══════════════════════════════════════════════════════════
import {
  PANEL_TYPES, BATTERY_MODELS, PSH_FALLBACK, CITY_SUMMER_TEMPS,
  MONTH_WEIGHTS, INVERTER_TYPES, HEAT_PUMP_DATA, HOURLY_SOLAR_PROFILE
} from './data.js';
import { calculateBomTotal, getActiveBomCategories, selectBomItems } from './bom.js';
import {
  METHODOLOGY_VERSION, PVGIS_LOSS_PARAM, buildTariffModel, calcIRR,
  calculateEVLoad, calculateHeatPumpLoad, calculateSystemLayout,
  combineHourlyLoads, computeFinancialTable, detectCalculationWarnings,
  getMonthlyLoadKwh, buildBaseHourlyLoad8760, simulateBatteryOnHourlySummary,
  simulateHourlyEnergy, resolveTaxTreatment, sumMonthlyArrays, normalizeMonthlyProductionToAnnual
} from './calc-core.js';
import { buildQuoteReadiness } from './turkey-regulation.js';
import { buildProposalGovernance } from './proposal-governance.js';
import { buildEvidenceRegistry, buildTariffSourceGovernance } from './evidence-governance.js';
import { hasCompleteHourlyProfile8760, hasMeaningfulMonthlyConsumption } from './consumption-evidence.js';
import { buildPvEngineRequest } from './pv-engine-contracts.js';
import { sourceMetaForCurrentCalculation } from './solar-engine-adapter.js';
import { scenarioSourceQualityNote } from './scenario-workflows.js';

const LOADING_MSGS = [
  "PVGIS'ten güneş ışınım verisi alınıyor...",
  "Hava durumu verileri işleniyor...",
  "Enerji üretimi hesaplanıyor...",
  "Finansal analiz yapılıyor..."
];

// FIX-2: Tilt factor lookup for PSH fallback path.
// Matches the TILT_COEFFS table in app.js and the backend simple_engine.py _tilt_factor().
// Optimum is 30–35° (coeff = 1.00); flat roof (0°) loses ~22%, vertical (90°) loses ~38%.
const _TILT_COEFFS = {0:0.78,10:0.90,15:0.94,20:0.97,25:0.99,30:1.00,33:1.00,35:1.00,40:0.99,45:0.97,50:0.94,60:0.87,75:0.75,90:0.62};
function _getTiltCoeff(deg) {
  const keys = Object.keys(_TILT_COEFFS).map(Number).sort((a, b) => a - b);
  let lo = keys[0], hi = keys[keys.length - 1];
  for (let i = 0; i < keys.length - 1; i++) {
    if (deg >= keys[i] && deg <= keys[i + 1]) { lo = keys[i]; hi = keys[i + 1]; break; }
  }
  if (lo === hi) return _TILT_COEFFS[lo];
  const t = (deg - lo) / (hi - lo);
  return _TILT_COEFFS[lo] + t * (_TILT_COEFFS[hi] - _TILT_COEFFS[lo]);
}

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

// Monthly season index: 0=Dec-Feb (winter), 1=Mar-May (spring), 2=Jun-Aug (summer), 3=Sep-Nov (autumn)
const _MONTH_SEASON = [0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 0];
const _SEASON_KEYS  = ['winter', 'spring', 'summer', 'autumn'];

// Derive daytime fraction from HOURLY_SOLAR_PROFILE for a given season.
// "Daytime" = hours where normalized solar output > 0.
function _dayRatioForSeason(season) {
  const profile = HOURLY_SOLAR_PROFILE[season] || HOURLY_SOLAR_PROFILE.spring;
  // Day hours are those with solar output; weight by output fraction (proxy for load during solar hours)
  const dayHours = profile.reduce((s, v) => s + (v > 0 ? 1 : 0), 0);
  return Math.max(0.2, Math.min(0.8, dayHours / 24));
}

export function calculateBatteryMetrics(annualEnergy, dailyConsumption, battery) {
  // Monthly production distributed by MONTH_WEIGHTS
  const usableCapacity = battery.capacity * battery.dod;
  const SOC_MIN_RESERVE = usableCapacity * 0.10; // 10% emergency reserve
  const batteryCost = modelBatteryCost(battery);

  let totalSelfConsumed = 0;
  let totalNightConsumption = 0;
  let totalNightCovered = 0;
  let totalBatteryStored = 0;

  for (let m = 0; m < 12; m++) {
    const monthlyProduction = annualEnergy * MONTH_WEIGHTS[m];
    // Approximate days per month (use 30.44 average)
    const daysInMonth = [31,28,31,30,31,30,31,31,30,31,30,31][m];
    const dailyProd = monthlyProduction / daysInMonth;

    const season = _SEASON_KEYS[_MONTH_SEASON[m]];
    const dayRatio = _dayRatioForSeason(season);
    const dayConsumption   = dailyConsumption * dayRatio;
    const nightConsumption = dailyConsumption * (1 - dayRatio);

    // Direct self-consumption during solar hours
    const directSC = Math.min(dailyProd, dayConsumption);
    const excessToBattery = Math.max(0, dailyProd - dayConsumption);

    // Battery charges during day; minimum reserve preserved
    const chargeableCapacity = usableCapacity - SOC_MIN_RESERVE;
    const batteryStored = Math.min(excessToBattery * battery.efficiency, chargeableCapacity);
    const nightCovered  = Math.min(batteryStored, nightConsumption);

    totalSelfConsumed    += (directSC + nightCovered) * daysInMonth;
    totalNightConsumption += nightConsumption * daysInMonth;
    totalNightCovered    += nightCovered * daysInMonth;
    totalBatteryStored   += batteryStored * daysInMonth;
  }

  const annualConsumption = dailyConsumption * 365;
  const gridIndependence  = Math.min(totalSelfConsumed / annualConsumption, 1.0);
  const nightCoverage     = totalNightConsumption > 0
    ? Math.min(totalNightCovered / totalNightConsumption, 1.0)
    : 0;

  return {
    gridIndependence: (gridIndependence * 100).toFixed(1),
    nightCoverage:    (nightCoverage * 100).toFixed(1),
    usableCapacity:   usableCapacity.toFixed(1),
    batteryCost,
    dailyProduction:  (annualEnergy / 365).toFixed(1),
    batteryStored:    (totalBatteryStored / 365).toFixed(1), // avg daily stored
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
    systemType: (batterySummary?.exportPolicy || hourlySummary?.exportPolicy || tariffModel?.exportCompensationPolicy)?.interval === 'hourly'
      ? 'Lisanssız Üretim — Saatlik mahsuplaşma + yıllık tüketim ihracat sınırı'
      : (batterySummary?.exportPolicy || hourlySummary?.exportPolicy || tariffModel?.exportCompensationPolicy)?.interval === 'monthly-aggregate-no-hourly-settlement'
      ? 'Lisanssız Üretim — Saatlik profil yok; ödeme hesabı ihtiyatlı olarak aylık toplama düşürüldü'
      : 'Lisanssız Üretim — Aylık mahsuplaşma + tüketim ihracat sınırı',
    settlementMode: (batterySummary?.exportPolicy || hourlySummary?.exportPolicy || tariffModel?.exportCompensationPolicy)?.interval || (hourlySummary ? 'hourly-profile' : 'annual-fallback'),
    exportPolicy: batterySummary?.exportPolicy || hourlySummary?.exportPolicy || tariffModel?.exportCompensationPolicy || null
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
  // Static efficiency kept for reference; weighted version computed per-section (Faz-3 Fix-11).

  // Faz-3 Fix-10: Bifacial gain is shading-dependent and albedo-scaled.
  // Rear-side irradiance drops when the array is shaded (less ground reflection reaches rear).
  // Standard IEC TS 60904-1-2 bifacial gain assumes albedo ≈ 0.20 (sand/grass).
  // Adjustment: gain × (1 − effectiveShading/200) × (albedo/0.20).
  // effectiveShading is not yet computed here; we use a forward reference approach:
  // shading-based correction is applied in the section loop below (per-section).
  // Albedo scaling is pre-computed once here.
  const groundAlbedo = Math.max(0.05, Math.min(0.50, Number(state.groundAlbedo) || 0.20));
  const albedoScale  = groundAlbedo / 0.20;  // normalised to IEC reference albedo
  const bifacialBaseGain = (state.panelType === 'bifacial' && panel.bifacialGain > 0)
    ? panel.bifacialGain * albedoScale
    : 0;
  // Summer-peak temperature correction (used only on fallback path, matches historical behavior).
  const tempLoss = panel.tempCoeff * (avgSummerTemp - 25);
  // Annual-weighted temperature correction for the PVGIS path.
  // Turkey annual mean air temp is ~12°C below the summer peak (IEA PVPS Turkey data).
  // Panel operating temperature adds ~25°C above ambient; STC baseline is 25°C.
  // Net correction relative to STC: tempCoeff × (annualAvg − 25).
  // Typical: 35°C summer peak → 23°C annual avg → +0.68% annual gain vs STC 25°C baseline.
  const annualAvgTemp    = avgSummerTemp - 12;
  const annualTempLoss   = panel.tempCoeff * (annualAvgTemp - 25);

  // Kablo kaybı entegrasyonu
  let cableLossFactor = 1.0;
  let cableLossPct = 0;
  if (state.cableLossEnabled && state.cableLoss) {
    cableLossPct = state.cableLoss.totalLossPct || 0;
    cableLossFactor = 1 - cableLossPct / 100;
  }
  // Faz-3 Fix-12: OSM shadow seasonal weighting.
  // OSM-derived shadowFactorPct is computed without solar geometry (no sun elevation angle).
  // In winter the sun is low (~25°) → shadows are 3-4× longer than in summer (~60°).
  // We apply monthly multipliers and weight by production share (MONTH_WEIGHTS) to get
  // an annual-production-weighted shadow factor instead of a flat year-round estimate.
  // Seasonal multipliers: winter ×2.0, spring ×1.0, summer ×0.5, autumn ×1.2.
  const _OSM_SHADOW_SEASONAL_MULT = [2.0,2.0,1.0,1.0,1.0,0.5,0.5,0.5,1.2,1.2,1.2,2.0]; // Jan–Dec
  const baseOsmFactor = state.osmShadowEnabled
    ? Math.max(0, Number(state.osmShadow?.shadowFactorPct) || 0)
    : 0;
  const osmShadowFactor = baseOsmFactor > 0
    ? Math.min(35, MONTH_WEIGHTS.reduce((sum, w, m) => sum + w * baseOsmFactor * _OSM_SHADOW_SEASONAL_MULT[m], 0))
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
      // 0.80 = conservative "pre-loss" Performance Ratio applied BEFORE the explicit loss
      // stack below (shading, soiling, inverter, cable). It captures losses the stack
      // doesn't model: module mismatch (~1%), wiring/connector tolerance (~1%),
      // module nameplate tolerance (~2%), dust on optics (~1%), and a general
      // engineering safety margin (~3%) ≈ PR 0.80 at this stage.
      // The explicit loss stack then further reduces this output by shading, soiling
      // (~3%), inverter (~3%) and cable (~2%), yielding a final effective PR ~0.70-0.74.
      // This is within IEA PVPS typical range (0.70-0.80) for Turkish climate conditions.
      rawEnergy = secPower * psh * 365 * 0.80;
      rawPoa = psh * 365;
    }

    // Kayıp sıralaması (doğru fiziksel sıra):
    // 1. Sıcaklık: fallback yolunda yaz ortalaması kullanılır; PVGIS yolunda yıllık
    //    ağırlıklı sıcaklık düzeltmesi uygulanır (PVGIS loss=0 ile STC bazlı çıktı verir,
    //    gerçek modüller 25°C'de çalışmaz → yıllık ortalama düzeltme gerekli).
    // 2. Azimut/eğim (fallback için; PVGIS kendi geometri modelini kullanıyor)
    // 3. Gölgelenme (yer-spesifik, PVGIS bilmiyor)
    // 4. Kirlenme (yer-spesifik)
    // 5. Bifaciyal kazanım (arka yüzeyden ek enerji)
    // 6. İnverter verimi (AC dönüşümü)
    // 7. Kablo kaybı (iletim)
    const effectiveShadingFactor = Math.min(80, Math.max(0, Number(sec.shadingFactor) || 0) + osmShadowFactor);
    // Faz-3 Fix-10: Bifacial gain reduced by shading (rear-side sees less ground reflection
    // when shading blocks diffuse component). Factor: (1 − shadingFactor/200) approximates
    // the partial loss of rear-irradiance at high shading levels.
    const bifacialBonus = bifacialBaseGain > 0
      ? (1 + bifacialBaseGain * (1 - effectiveShadingFactor / 200))
      : 1;
    // Faz-3 Fix-11: Weighted annual inverter efficiency based on CEC 3-point curve.
    // Early-morning / late-evening hours run at low load → lower efficiency.
    // Weights from HOURLY_SOLAR_PROFILE summer profile distribution:
    //   ~18% of energy at <30% load (eff≈94%), ~52% at 30-70% (eff≈96.5%), ~30% at >70% (eff≈97%).
    const weightedInverterEfficiency = inverterData.efficiency < 1
      ? inverterData.efficiency * (0.18 * (0.94 / 0.97) + 0.52 * (0.965 / 0.97) + 0.30 * 1.0)
      : inverterData.efficiency;
    const adjustedE = rawEnergy
      * (usedFallback ? (1 + tempLoss) : (1 + annualTempLoss))  // Faz-2 Fix-7: PVGIS yoluna yıllık sıcaklık düzeltmesi eklendi
      * (usedFallback ? sec.azimuthCoeff : 1.0)
      * (usedFallback ? _getTiltCoeff(sec.tilt) : 1.0)   // FIX-2: tilt factor was missing from fallback path
      * (1 - effectiveShadingFactor / 100)
      * (1 - state.soilingFactor / 100)
      * bifacialBonus
      * weightedInverterEfficiency  // Faz-3 Fix-11: part-load weighted (replaces static efficiency)
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

  let panelCount    = validSections.reduce((s, r) => s + r.panelCount, 0);
  let systemPower   = validSections.reduce((s, r) => s + r.systemPower, 0);
  let adjustedEnergy= validSections.reduce((s, r) => s + r.annualEnergy, 0);
  let monthlyData   = validSections.reduce((agg, r) => agg.map((v,i) => v + r.monthlyData[i]), new Array(12).fill(0));
  let usedFallback  = validSections.some(r => r.usedFallback);
  let pvgisRawEnergy= validSections.reduce((s, r) => s + r.pvgisRawEnergy, 0);
  const pvgisPoaWeighted = validSections.reduce((s, r) => s + (Number(r.pvgisPoa) || 0) * r.systemPower, 0);
  let pvgisPoa = systemPower > 0 ? pvgisPoaWeighted / systemPower : 0;
  let shadingLoss   = validSections.reduce((s, r) => s + r.shadingLoss, 0);
  let tempLossEnergy= validSections.reduce((s, r) => s + r.tempLossEnergy, 0);
  let azimuthLossEnergy   = validSections.reduce((s, r) => s + r.azimuthLossEnergy, 0);
  let bifacialGainEnergy  = validSections.reduce((s, r) => s + r.bifacialGainEnergy, 0);
  let soilingLoss         = validSections.reduce((s, r) => s + r.soilingLoss, 0);
  let totalCableLoss      = validSections.reduce((s, r) => s + (r.cableLoss || 0), 0);
  let effectiveShadingFactor = systemPower > 0
    ? validSections.reduce((s, r) => s + (Number(r.effectiveShadingFactor) || 0) * r.systemPower, 0) / systemPower
    : Number(state.shadingFactor) || 0;
  const localProductionSnapshot = {
    annualEnergy: Math.round(adjustedEnergy),
    monthlyData: normalizeMonthlyProductionToAnnual(monthlyData, adjustedEnergy),
    systemPower,
    panelCount,
    usedFallback,
    pvgisRawEnergy,
    pvgisPoa,
    source: usedFallback ? 'local-fallback' : 'browser-pvgis'
  };
  const authoritativeOverride = state.authoritativeEngineOverride;
  const authoritativeBackend = authoritativeOverride?.engineSource?.pvlibBacked && !authoritativeOverride?.fallbackUsed && !authoritativeOverride?.engineSource?.fallbackUsed
    ? authoritativeOverride
    : null;
  if (authoritativeBackend) {
    const bp = authoritativeBackend.production || {};
    const bl = authoritativeBackend.losses || {};
    adjustedEnergy = Math.round(Number(bp.annualEnergyKwh || bp.annual_kwh || adjustedEnergy));
    const backendMonthly = Array.isArray(bp.monthlyEnergyKwh) ? bp.monthlyEnergyKwh : bp.monthly_kwh;
    if (Array.isArray(backendMonthly) && backendMonthly.length === 12) monthlyData = backendMonthly.map(v => Math.round(Number(v) || 0));
    monthlyData = normalizeMonthlyProductionToAnnual(monthlyData, adjustedEnergy);
    systemPower = Number(bp.systemPowerKwp || systemPower);
    panelCount = Number(bp.panelCount || panelCount);
    usedFallback = false;
    pvgisRawEnergy = Math.round(Number(bl.dcAnnualKwh || bl.acAnnualKwh || bp.annualEnergyKwh || adjustedEnergy));
    pvgisPoa = Number(bl.poaAnnualKwhM2 || pvgisPoa || state.ghi || 0);
    shadingLoss = Math.round(pvgisRawEnergy * ((Number(bl.shadingPct ?? state.shadingFactor) || 0) / 100));
    soilingLoss = Math.round(pvgisRawEnergy * ((Number(bl.soilingPct ?? state.soilingFactor) || 0) / 100));
    tempLossEnergy = Math.max(0, Math.round((Number(bl.dcAnnualKwh || adjustedEnergy) || adjustedEnergy) - adjustedEnergy));
    azimuthLossEnergy = 0;
    bifacialGainEnergy = state.panelType === 'bifacial' ? Math.max(0, Math.round(adjustedEnergy * 0.05)) : 0;
    totalCableLoss = Math.max(0, Math.round(Number(bl.clippingKwh || 0)));
    effectiveShadingFactor = Number(bl.shadingPct ?? state.shadingFactor ?? effectiveShadingFactor);
    const banner = document.getElementById('fallback-banner');
    if (banner) banner.style.display = 'none';
  }
  monthlyData = normalizeMonthlyProductionToAnnual(monthlyData, adjustedEnergy);

  // Faz-4 Fix-15: PVGIS annual uncertainty ≈ ±7.6% at 1σ (interannual variability +
  // model uncertainty per PVGIS JRC documentation). P90 is the conservative estimate
  // that investors and banks use; P10 is the optimistic upper band.
  //   P90 = P50 × (1 − 1.28 × σ)  → energy exceeded 90% of years
  //   P10 = P50 × (1 + 1.28 × σ)  → energy exceeded only 10% of years
  const _PVGIS_SIGMA = 0.076;
  const energyP90 = Math.round(adjustedEnergy * (1 - 1.28 * _PVGIS_SIGMA));
  const energyP10 = Math.round(adjustedEnergy * (1 + 1.28 * _PVGIS_SIGMA));

  const authoritativeSourceMeta = authoritativeBackend?.engineSource || sourceMetaForCurrentCalculation({ usedFallback });
  const authoritativeProduction = {
    annualEnergyKwh: Math.round(adjustedEnergy),
    monthlyEnergyKwh: monthlyData.slice(),
    systemPowerKwp: Number(systemPower.toFixed(3)),
    panelCount,
    source: authoritativeSourceMeta.source,
    engine: authoritativeSourceMeta.engine,
    engineQuality: authoritativeSourceMeta.engineQuality,
    pvlibBacked: !!authoritativeSourceMeta.pvlibBacked
  };
  const engineParity = {
    authoritativeSource: authoritativeSourceMeta.source,
    comparisonSource: localProductionSnapshot.source,
    localAnnualEnergyKwh: localProductionSnapshot.annualEnergy,
    authoritativeAnnualEnergyKwh: authoritativeProduction.annualEnergyKwh,
    deltaKwh: authoritativeProduction.annualEnergyKwh - localProductionSnapshot.annualEnergy,
    deltaPct: localProductionSnapshot.annualEnergy > 0
      ? Number((((authoritativeProduction.annualEnergyKwh - localProductionSnapshot.annualEnergy) / localProductionSnapshot.annualEnergy) * 100).toFixed(2))
      : 0,
    intentionalDifference: !!authoritativeBackend,
    notes: authoritativeBackend
      ? [
          'Backend pvlib is authoritative for this run.',
          'Financials, proposal governance, reports, and exports use the backend annual and monthly production values.',
          'Browser PVGIS/JS production is retained only as a comparison snapshot.'
        ]
      : [
          'Browser PVGIS/JS is authoritative for this run.',
          'Backend output was unavailable, non-authoritative, or fallback-only and is not mixed into downstream financials.'
        ]
  };

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
  // FIX-6: KDV/VAT accuracy — Law 7456/2023 (July 2023) reduced KDV on solar PV
  // panels/modules to 0%. Other components (inverter, mounting, cable, labor,
  // permit) remain at the standard 20% rate. The override key 'kdvRate' now
  // sets the non-panel rate; to override the panel rate separately use
  // 'panelKdvRate'. Backend _frontend_default_capex also updated to match.
  const nonPanelKdvRate = Number.isFinite(costOverrides.kdvRate) ? costOverrides.kdvRate : 0.20;
  const panelKdvRate    = Number.isFinite(costOverrides.panelKdvRate) ? costOverrides.panelKdvRate : 0.00;

  const panelCost   = systemPower * 1000 * panelPricePerWatt;
  const inverterCost= systemPower * invUnitEffective;
  const mountingCost= systemPower * mountingPerKwp;
  const dcCableCost = systemPower * dcCablePerKwp;
  const acElecCost  = systemPower * acElecPerKwp;
  const laborCost   = systemPower * laborPerKwp;
  const subtotal    = panelCost + inverterCost + mountingCost + dcCableCost + acElecCost + laborCost + permitCost;
  const nonPanelSubtotal = subtotal - panelCost;
  const kdv         = panelCost * panelKdvRate + nonPanelSubtotal * nonPanelKdvRate;
  const kdvRate     = subtotal > 0 ? kdv / subtotal : 0; // blended rate, used downstream for display
  let solarCost     = subtotal + kdv;
  const bomTotalsForSystem = Array.isArray(state.bomItems) && state.bomItems.length
    ? calculateBomTotal(selectBomItems(state.bomItems, state.bomSelection || {}, { activeCategories: getActiveBomCategories(state) }), {
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
  let monthlyLoad = getMonthlyLoadKwh(state, extraMonthlyLoad);
  let baseMonthlyLoad = getMonthlyLoadKwh(state, 0);

  // Faz-4 Fix-16: Agricultural irrigation — override monthly load with seasonal pump model.
  // When pump kW and hours/day are provided, compute actual kWh per active month instead of
  // extrapolating daily consumption × 365. This prevents 3× system oversizing.
  if (state.scenarioKey === 'agricultural-irrigation' && state.irrigPumpKw > 0 && state.irrigHoursPerDay > 0) {
    const _IRRIG_MONTH_DAYS = [31,28,31,30,31,30,31,31,30,31,30,31];
    const startM = Math.max(1, Math.min(12, state.irrigSeasonStart || 4));
    const endM   = Math.max(1, Math.min(12, state.irrigSeasonEnd   || 9));
    const irrigMonthlyLoad = new Array(12).fill(0);
    for (let m = 1; m <= 12; m++) {
      const inSeason = endM >= startM ? (m >= startM && m <= endM) : (m >= startM || m <= endM);
      if (inSeason) {
        irrigMonthlyLoad[m - 1] = state.irrigPumpKw * state.irrigHoursPerDay * _IRRIG_MONTH_DAYS[m - 1];
      }
    }
    monthlyLoad = irrigMonthlyLoad;
    baseMonthlyLoad = irrigMonthlyLoad;
  }
  const baseHourlyLoad = hasCompleteHourlyProfile8760(state.hourlyConsumption8760)
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
    // Faz-4 Fix-14: Off-grid systems use 10% SOC reserve so the BMS always has
    // an emergency buffer; on-grid systems leave the full capacity available.
    batterySummary = simulateBatteryOnHourlySummary(hourlySummaryRaw, state.battery, {
      paidBatteryExportAllowed: false,
      exportPolicy: tariffModel.exportCompensationPolicy,
      socReservePct: state.scenarioKey === 'off-grid' ? 0.10 : 0
    });
    bessMetrics = calculateBatteryMetrics(adjustedEnergy, hourlySummaryRaw.annualLoad / 365, state.battery);
    if (batterySummary) {
      bessMetrics.gridIndependence = (batterySummary.gridIndependence * 100).toFixed(1);
      bessMetrics.nightCoverage = (Math.min(1, batterySummary.batteryDischarge / Math.max(hourlySummaryRaw.gridImport, 1)) * 100).toFixed(1);
      bessMetrics.batteryStored = batterySummary.batteryDischarge.toFixed(1);
      bessMetrics.cyclesPerYear = batterySummary.cyclesPerYear.toFixed(0);
      // Faz-4 Fix-14: Autonomy metrics for off-grid quality assessment
      bessMetrics.autonomousDaysPct = batterySummary.autonomousDaysPct;
      bessMetrics.autonomousDays = batterySummary.autonomousDays;
      bessMetrics.unmetLoadKwh = batterySummary.unmetLoadKwh;
    }
    batteryCostVal = bessMetrics.batteryCost;
  }
  const grossTotalCost = solarCost + batteryCostVal;
  const taxTreatment = resolveTaxTreatment({
    grossTotalCost,
    solarKdv: kdv,
    taxEnabled: state.taxEnabled,
    tax: state.tax
  });
  const totalCost = grossTotalCost;
  const financialCostBasis = taxTreatment.financialCostBasis;

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

  // FIX-5: Off-grid replaces generator/diesel, not grid electricity.
  // Using the grid import tariff as the "savings rate" for an off-grid system
  // would understate savings by ~2-3×. Use state.offGridCostPerKwh if the user
  // has configured it; otherwise apply a conservative 2.5× multiplier relative
  // to the grid tariff as a proxy for diesel/generator fuel cost avoidance.
  const effectiveSavingsTariff = (state.scenarioKey === 'off-grid')
    ? (Number(state.offGridCostPerKwh) > 0 ? Number(state.offGridCostPerKwh) : tariff * 2.5)
    : tariff;

  const annualSavings = nmMetrics.selfConsumedEnergy * effectiveSavingsTariff
    + (state.netMeteringEnabled ? nmMetrics.paidGridExport * exportRate : 0);
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
    totalCost: financialCostBasis,
    tariffModel,
    panel,
    annualOMCost,
    annualInsurance,
    inverterLifetime,
    inverterReplaceCost,
    netMeteringEnabled: state.netMeteringEnabled,
    exportRateOverride: exportRate,
    batteryLifetime,
    batteryReplaceCost,
    annualLoadGrowth: Number(state.annualLoadGrowth) || 0  // Faz-3 Fix-13
  });
  const yearlyTable = financial.rows;
  const paybackYear = financial.paybackYear;
  const discountedPaybackYear = financial.discountedPaybackYear;
  const totalExpenses25y = financial.totalExpenses25y;
  const npvTotal = financial.projectNPV;
  const roi = financial.roi;
  const irr = calcIRR([-financialCostBasis, ...yearlyTable.map(y => y.netCashFlow)]);

  let lcoeCostSum = financialCostBasis;
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
  // PR = E_AC / (G_POA × P_STC). pvgisPoa öncelikli; yoksa pvgisRawEnergy (kayıpsız PVGIS çıkışı)
  // kullan. state.ghi (yatay GHI) POA'dan farklı olduğu için son çare olarak kullanılır.
  const pr = (systemPower > 0 && pvgisPoa > 0)
    ? (adjustedEnergy / (systemPower * pvgisPoa))
    : pvgisRawEnergy > 0
      ? (adjustedEnergy / pvgisRawEnergy)
      : (systemPower > 0 && state.ghi > 0 ? adjustedEnergy / (systemPower * state.ghi) : 0);

  // ── Yapısal Kontrol ──────────────────────────────────────────────────────────
  let structuralCheck = null;
  if (window.calculateStructural) {
    structuralCheck = window.calculateStructural(state.cityName, state.tilt, systemPower, panelArea * panelCount);
  }

  // ── Vergi Avantajı ───────────────────────────────────────────────────────────
  let taxMetrics = null;
  if (state.taxEnabled && state.tax) {
    taxMetrics = calculateTaxBenefits(totalCost, npvTotal, state.tax, discountRate, kdv, taxTreatment);
  }
  const billAnalysis = state.billAnalysisEnabled && hasMeaningfulMonthlyConsumption(state.monthlyConsumption)
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
    energyP90, energyP10,
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
    financialCostBasis: Math.round(financialCostBasis),
    taxTreatment,
    methodologyVersion: METHODOLOGY_VERSION,
    pvgisLossParam: PVGIS_LOSS_PARAM,
    displayCurrency: state.displayCurrency || 'TRY',
    usdToTry: state.usdToTry || 38.5,
    netMeteringEnabled: !!state.netMeteringEnabled,
    calculationMode: authoritativeBackend ? 'python-pvlib-backed' : usedFallback ? 'fallback-psh' : 'pvgis-live',
    engineSource: authoritativeSourceMeta,
    engineRequest: buildPvEngineRequest(state),
    sourceQualityNote: authoritativeBackend
      ? scenarioSourceQualityNote(state.scenarioKey, 'python-backend')
      : scenarioSourceQualityNote(state.scenarioKey, usedFallback ? 'fallback-psh' : 'pvgis-live'),
    pvgisFailReason: usedFallback && !authoritativeBackend ? (window._pvgisLastError || 'unknown') : null,
    authoritativeEngineSource: authoritativeSourceMeta,
    authoritativeEngineResponse: authoritativeBackend || null,
    authoritativeEngineMode: authoritativeBackend ? 'python-pvlib-backed' : usedFallback ? 'local-fallback' : 'browser-pvgis',
    authoritativeEngineFallbackReason: authoritativeBackend ? null : state.authoritativeEngineFallbackReason || (usedFallback ? (window._pvgisLastError || 'PVGIS unavailable; local fallback used.') : null),
    authoritativeProduction,
    engineParity,
    localProductionSnapshot,
    backendEngineSource: authoritativeBackend ? null : undefined,
    backendEngineResponse: authoritativeBackend ? null : undefined,
    backendCalculationMode: authoritativeBackend ? null : undefined,
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
  if (results.proposalGovernance?.approval?.invalidatedApproval) {
    state.proposalApproval = {
      ...(state.proposalApproval || {}),
      state: 'finance-review',
      approvedAt: null,
      approvalRecord: null,
      invalidatedAt: new Date().toISOString(),
      invalidationReason: 'material-proposal-basis-changed'
    };
    results.proposalGovernance = buildProposalGovernance(state, results);
    results.quoteReadiness = buildQuoteReadiness({ state, results, tariffModel, evidenceGovernance: results.evidenceGovernance });
  }
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

  // Calculation is complete; hand the user to the results step.
  if (window.renderEngCalcPanel) window.renderEngCalcPanel();

  setTimeout(() => {
    window.goToStep(7);
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

  const _evPanel = PANEL_TYPES[window.state?.panelType || 'mono'];
  const panelArea = (_evPanel?.width || 1.134) * (_evPanel?.height || 1.762);
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
function calculateTaxBenefits(totalCost, npvBase, tax, discountRate, kdvAmount = 0, taxTreatment = null) {
  const depreciableBase = Math.max(0, Number(taxTreatment?.depreciableBase ?? totalCost) || 0);
  const annual_dep = depreciableBase / tax.amortizationYears;
  let taxShieldNPV = 0;
  for (let y = 1; y <= tax.amortizationYears; y++) {
    taxShieldNPV += (annual_dep * tax.corporateTaxRate / 100) / Math.pow(1 + discountRate, y);
  }
  const kdv_recovery = Math.max(0, Number(taxTreatment?.recoverableKdv ?? (tax.kdvRecovery ? kdvAmount : 0)) || 0);
  const incentiveRate = Math.max(0, Number(tax.investmentContribution) || 0) / 100;
  const hasIncentive = !!(tax.investmentDeduction || tax.hasIncentiveCert || incentiveRate > 0);
  const investment_deduction = hasIncentive ? depreciableBase * incentiveRate * (tax.corporateTaxRate / 100) : 0;

  const totalTaxBenefit = taxShieldNPV + kdv_recovery + investment_deduction;
  const effectiveCost = totalCost - totalTaxBenefit;
  const nonVatTaxBenefit = taxShieldNPV + investment_deduction;

  return {
    annual_dep: Math.round(annual_dep),
    depreciableBase: Math.round(depreciableBase),
    taxShieldNPV: Math.round(taxShieldNPV),
    kdv_recovery: Math.round(kdv_recovery),
    investment_deduction: Math.round(investment_deduction),
    totalTaxBenefit: Math.round(totalTaxBenefit),
    effectiveCost: Math.round(effectiveCost),
    adjustedNPV: Math.round(npvBase + nonVatTaxBenefit),
    vatTreatment: taxTreatment?.vatTreatment || 'kdv-included-in-financial-cost-basis'
  };
}

// BUG-13 fix: Do NOT expose runCalculation directly on window — app.js imports it from
// calculation-service.js which wraps this function with the Python backend adapter.
// A bare window.runCalculation would bypass the adapter, silently skipping pvlib/backend.
// Use window.runCalculationService (set in calculation-service.js) for console/debug calls.
window.calculateBatteryMetrics = calculateBatteryMetrics;
window.calculateNMMetrics = calculateNMMetrics;
