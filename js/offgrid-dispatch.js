// ═══════════════════════════════════════════════════════════
// OFFGRID DISPATCH — Solar Rota Off-Grid Level 2 Engine
// Synthetic/real-hourly dispatch, critical load priority, battery and inverter power limits
// Sadece off-grid senaryosunda çağrılır. DOM erişimi yok.
// Solar Rota v2.0 — OGD-2026.04-v1.1
// ═══════════════════════════════════════════════════════════
import { getLoadProfile } from './calc-core.js';

function getLoadSeasonForMonth(monthIdx) {
  if (monthIdx === 11 || monthIdx <= 1) return 'winter';
  if (monthIdx >= 2 && monthIdx <= 4)   return 'spring';
  if (monthIdx >= 5 && monthIdx <= 7)   return 'summer';
  return 'autumn';
}

export const OFFGRID_DISPATCH_VERSION = 'OGD-2026.04-v1.1';
export const OFFGRID_FIELD_MODEL_VERSION = 'OGD-FIELD-MODEL-2026.04-v3';
export const OFFGRID_ACCURACY_VERSION = 'OGD-ACCURACY-2026.04-v1';

const HOURS_PER_YEAR = 8760;
const MONTH_DAYS = [31,28,31,30,31,30,31,31,30,31,30,31];
const DAY_HOURS = new Set([6,7,8,9,10,11,12,13,14,15,16,17]);
const NIGHT_HOURS = new Set([0,1,2,3,4,5,18,19,20,21,22,23]);

// Kötü hava senaryosu: ardışık gün sayısı + o penceredeki PV ölçek faktörü
// Yıl içinde en düşük PV'ye sahip ardışık pencere seçilir ve orada PV düşürülür.
export const BAD_WEATHER_CONFIG = {
  light:    { days: 5,  pvFactor: 0.15 },  // 5 ardışık gün %15 PV — hafif bulutlu
  moderate: { days: 10, pvFactor: 0.05 },  // 10 ardışık gün %5 PV — ağır bulutlu
  severe:   { days: 15, pvFactor: 0.00 }   // 15 ardışık gün sıfır PV — dağ kışı / Karadeniz
};

// Geriye dönük uyumluluk — bazı testler bunu kullanabilir
export const BAD_WEATHER_PV_FACTORS = {
  light:    BAD_WEATHER_CONFIG.light.pvFactor,
  moderate: BAD_WEATHER_CONFIG.moderate.pvFactor,
  severe:   BAD_WEATHER_CONFIG.severe.pvFactor
};

export const OFFGRID_STRESS_SCENARIOS = [
  { key: 'low-pv-year', label: 'Low PV year', pvFactor: 0.90, loadFactor: 1.00, criticalLoadFactor: 1.00, batteryEol: false },
  { key: 'load-growth', label: 'Load growth', pvFactor: 1.00, loadFactor: 1.15, criticalLoadFactor: 1.15, batteryEol: false },
  { key: 'battery-eol', label: 'Battery end-of-life', pvFactor: 1.00, loadFactor: 1.00, criticalLoadFactor: 1.00, batteryEol: true },
  { key: 'combined-design-stress', label: 'Combined design stress', pvFactor: 0.85, loadFactor: 1.15, criticalLoadFactor: 1.15, batteryEol: true }
];

const DEFAULT_FIELD_MODEL_THRESHOLDS = {
  criticalCoverageMin: 0.999,
  totalCoverageMin: 0.98,
  unmetCriticalMaxKwh: 1,
  generatorCriticalPeakReservePct: 0.10
};

// Cihaz kategorisi başına 24 saatlik şablonlar (her biri normalize edilir, toplamları ≈1.0)
// Fiziksel anlam: tipik günlük kullanım ağırlığı saat başına
export const DEVICE_LOAD_TEMPLATES = {
  // Aydınlatma: gün batımı (17-22) ve sabah (6-8) ağırlıklı
  lighting:      [0.005,0.005,0.005,0.005,0.005,0.010,0.020,0.030,0.020,0.015,0.015,0.015,
                  0.015,0.015,0.015,0.020,0.030,0.060,0.080,0.085,0.085,0.075,0.060,0.025],
  // Buzdolabı: sürekli (sabit döngü)
  refrigerator:  [0.0417,0.0417,0.0417,0.0417,0.0417,0.0417,0.0417,0.0417,0.0417,0.0417,0.0417,0.0417,
                  0.0417,0.0417,0.0417,0.0417,0.0417,0.0417,0.0417,0.0417,0.0417,0.0417,0.0417,0.0413],
  // Klima / Fan: sabah-öğle-akşam ağırlıklı (08-23)
  hvac:          [0.000,0.000,0.000,0.000,0.000,0.005,0.015,0.040,0.070,0.090,0.090,0.085,
                  0.085,0.080,0.075,0.070,0.065,0.060,0.065,0.070,0.065,0.035,0.005,0.000],
  // Güvenlik: sürekli
  security:      [0.0417,0.0417,0.0417,0.0417,0.0417,0.0417,0.0417,0.0417,0.0417,0.0417,0.0417,0.0417,
                  0.0417,0.0417,0.0417,0.0417,0.0417,0.0417,0.0417,0.0417,0.0417,0.0417,0.0417,0.0413],
  // Pompa / Hidrofor: gündüz ağırlıklı (07-16)
  pump:          [0.000,0.000,0.000,0.000,0.000,0.000,0.050,0.120,0.140,0.140,0.140,0.120,
                  0.100,0.100,0.100,0.090,0.000,0.000,0.000,0.000,0.000,0.000,0.000,0.000],
  // Eğlence / Medya: akşam ağırlıklı
  entertainment: [0.005,0.005,0.005,0.005,0.005,0.005,0.010,0.020,0.030,0.030,0.030,0.030,
                  0.030,0.030,0.030,0.030,0.040,0.075,0.105,0.120,0.120,0.100,0.065,0.025],
  // Küçük mutfak: sabah (06-08) ve öğle/akşam yemek saatleri
  kitchen:       [0.000,0.000,0.000,0.000,0.000,0.010,0.080,0.120,0.080,0.050,0.030,0.030,
                  0.080,0.100,0.060,0.030,0.020,0.060,0.090,0.090,0.060,0.040,0.020,0.000],
  // Çamaşır / ütü: gündüz ağırlıklı (09-18)
  laundry:       [0.000,0.000,0.000,0.000,0.000,0.000,0.010,0.040,0.100,0.130,0.130,0.120,
                  0.110,0.110,0.100,0.090,0.060,0.000,0.000,0.000,0.000,0.000,0.000,0.000],
  // Atölye: mesai saatleri (08-17)
  workshop:      [0.000,0.000,0.000,0.000,0.000,0.000,0.000,0.010,0.120,0.140,0.140,0.140,
                  0.110,0.110,0.110,0.110,0.010,0.000,0.000,0.000,0.000,0.000,0.000,0.000],
  // Oyun / Konsol: akşam + hafta sonu (burada günlük ortalaması kullanılır)
  gaming:        [0.005,0.005,0.005,0.005,0.005,0.000,0.000,0.000,0.010,0.020,0.020,0.020,
                  0.020,0.020,0.020,0.020,0.040,0.070,0.110,0.140,0.145,0.130,0.090,0.050],
  // Genel: düz dağılım
  generic:       [0.042,0.042,0.042,0.042,0.042,0.042,0.042,0.042,0.042,0.042,0.042,0.042,
                  0.042,0.042,0.042,0.042,0.042,0.042,0.042,0.042,0.042,0.042,0.042,0.034]
};

// Mevsimsel yük çarpanları — kullanıcı girişinin yıllık toplamını koruyarak mevsimsel dağılım ekler.
// Örnek: pump kışın 0.00, yazın 1.60 → sulama; normalizasyon yıllık toplamı garantiler.
export const SEASONAL_LOAD_FACTORS = {
  lighting:      { summer: 0.65, spring: 0.85, autumn: 0.90, winter: 1.25 },
  refrigerator:  { summer: 1.15, spring: 1.00, autumn: 1.00, winter: 0.85 },
  hvac:          { summer: 2.00, spring: 0.55, autumn: 0.60, winter: 0.85 },
  security:      { summer: 1.00, spring: 1.00, autumn: 1.00, winter: 1.00 },
  pump:          { summer: 1.60, spring: 1.20, autumn: 0.40, winter: 0.00 },
  entertainment: { summer: 0.85, spring: 1.00, autumn: 1.05, winter: 1.10 },
  kitchen:       { summer: 1.00, spring: 1.00, autumn: 1.00, winter: 1.00 },
  laundry:       { summer: 1.00, spring: 1.00, autumn: 1.00, winter: 1.00 },
  workshop:      { summer: 1.00, spring: 1.05, autumn: 1.00, winter: 0.95 },
  gaming:        { summer: 0.85, spring: 1.00, autumn: 1.05, winter: 1.10 },
  generic:       { summer: 1.00, spring: 1.00, autumn: 1.00, winter: 1.00 }
};

// Mevsimsel normalizasyon faktörleri — yıllık toplam (dailyKwh × 365) sabit kalır
const SEASONAL_NORM_FACTORS = (() => {
  const result = {};
  for (const [cat, factors] of Object.entries(SEASONAL_LOAD_FACTORS)) {
    let sum = 0;
    for (let m = 0; m < 12; m++) sum += MONTH_DAYS[m] * (factors[getLoadSeasonForMonth(m)] ?? 1);
    result[cat] = sum / 365 || 1;
  }
  return result;
})();

const CATEGORY_SURGE_MULTIPLIERS = {
  lighting: 1.0,
  refrigerator: 1.5,
  hvac: 1.8,
  security: 1.0,
  pump: 2.5,
  entertainment: 1.1,
  kitchen: 1.2,
  laundry: 1.4,
  workshop: 1.5,
  gaming: 1.1,
  generic: 1.0
};

// İç yardımcı: profili normalize et ve 1.0'a topla
function norm24(arr) {
  const safe = Array.isArray(arr) && arr.length === 24 ? arr.map(v => Math.max(0, Number(v) || 0)) : new Array(24).fill(1);
  const sum = safe.reduce((a, b) => a + b, 0);
  if (sum <= 0) return safe.map(() => 1 / 24);
  return safe.map(v => v / sum);
}

function finitePositiveOr(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function finiteOrInfinity(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : Infinity;
}

function isComplete8760(arr) {
  return Array.isArray(arr)
    && arr.length >= HOURS_PER_YEAR
    && arr.slice(0, HOURS_PER_YEAR).every(v => Number.isFinite(Number(v)) && Number(v) >= 0);
}

function clone8760(arr) {
  return arr.slice(0, HOURS_PER_YEAR).map(v => Math.max(0, Number(v) || 0));
}

function sum(arr) {
  return arr.reduce((a, b) => a + Math.max(0, Number(b) || 0), 0);
}

function scale8760(arr, factor = 1) {
  const f = Math.max(0, Number(factor) || 0);
  return Array.from({ length: HOURS_PER_YEAR }, (_, i) => Math.max(0, Number(arr?.[i]) || 0) * f);
}

function scaleCritical8760(critical, load, factor = 1) {
  const f = Math.max(0, Number(factor) || 0);
  return Array.from({ length: HOURS_PER_YEAR }, (_, i) => {
    const scaledCritical = Math.max(0, Number(critical?.[i]) || 0) * f;
    const scaledLoad = Math.max(0, Number(load?.[i]) || 0);
    return Math.min(scaledLoad, scaledCritical);
  });
}

function scaleOptional8760(arr, factor = 1) {
  return isComplete8760(arr) ? scale8760(arr, factor) : null;
}

function eolBatteryConfig(battery = {}) {
  const usable = Math.max(0, Number(battery.usableCapacityKwh) || 0);
  const eolUsable = usable * 0.80;
  const reservePct = usable > 0 ? Math.max(0, Math.min(0.5, (Number(battery.socReserveKwh) || 0) / usable)) : 0;
  const initialPct = usable > 0 ? Math.max(reservePct, Math.min(1, (Number(battery.initialSocKwh) || 0) / usable)) : reservePct;
  const eff = Math.max(0.5, Math.min(1, (Number(battery.efficiency) || 0.92) - 0.03));
  const scaledPower = (value) => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n * 0.90 : value;
  };
  return {
    ...battery,
    usableCapacityKwh: eolUsable,
    efficiency: eff,
    socReserveKwh: eolUsable * reservePct,
    initialSocKwh: eolUsable * initialPct,
    maxChargePowerKw: scaledPower(battery.maxChargePowerKw ?? battery.maxChargeKw),
    maxDischargePowerKw: scaledPower(battery.maxDischargePowerKw ?? battery.maxDischargeKw)
  };
}

function dispatchSummaryForStress(key, scenario, dispatch, peakCriticalKw) {
  return {
    key,
    label: scenario.label || key,
    pvFactor: scenario.pvFactor,
    loadFactor: scenario.loadFactor,
    criticalLoadFactor: scenario.criticalLoadFactor,
    batteryEol: !!scenario.batteryEol,
    totalLoadCoverage: dispatch.totalLoadCoverage,
    criticalLoadCoverage: dispatch.criticalLoadCoverage,
    pvBatteryLoadCoverage: dispatch.solarBatteryLoadCoverage,
    pvBatteryCriticalCoverage: dispatch.solarBatteryCriticalCoverage,
    unmetLoadKwh: dispatch.unmetLoadKwh,
    unmetCriticalKwh: dispatch.unmetCriticalLoadKwh,
    generatorKwh: dispatch.generatorToLoadKwh,
    generatorRunHours: dispatch.generatorRunHours,
    minimumSocPct: dispatch.minimumSocPct,
    batteryChargeLimitedKwh: dispatch.batteryChargeLimitedKwh,
    batteryDischargeLimitedKwh: dispatch.batteryDischargeLimitedKwh,
    inverterPowerLimitedKwh: dispatch.inverterPowerLimitedLoadKwh,
    peakCriticalKw
  };
}

export function buildOffgridPvDispatchProfile(options = {}) {
  const realHourly = isComplete8760(options.realHourlyPv8760)
    ? clone8760(options.realHourlyPv8760)
    : null;
  if (realHourly) {
    return {
      pvHourly8760: realHourly,
      annualKwh: sum(realHourly),
      hasRealHourlyProduction: true,
      productionDispatchProfile: 'real-hourly-pv-8760',
      productionSeriesSource: options.source || 'user-supplied-real-hourly-pv',
      productionSourceLabel: options.sourceLabel || 'Real hourly PV 8760',
      productionFallback: false,
      fallbackUsed: false,
      resolution: 'hourly',
      missingHours: 0,
      dispatchBus: 'ac-load-bus-kwh',
      synthetic: false
    };
  }

  const fallbackHourly = Array.isArray(options.fallbackHourlyRows)
    ? options.fallbackHourlyRows.map(row => typeof row === 'number' ? row : row?.production)
    : [];
  const fallbackComplete = isComplete8760(fallbackHourly);
  const pvHourly8760 = fallbackComplete ? clone8760(fallbackHourly) : new Array(HOURS_PER_YEAR).fill(0);
  return {
    pvHourly8760,
    annualKwh: sum(pvHourly8760),
    hasRealHourlyProduction: false,
    productionDispatchProfile: fallbackComplete
      ? 'monthly-production-derived-synthetic-8760'
      : 'missing-production-zero-profile',
    productionSeriesSource: options.fallbackSource || 'monthly-production-derived-synthetic-8760',
    productionSourceLabel: options.fallbackSourceLabel || 'Monthly-derived synthetic 8760',
    productionFallback: !!options.fallbackUsed || !fallbackComplete,
    fallbackUsed: !!options.fallbackUsed || !fallbackComplete,
    resolution: 'hourly',
    missingHours: fallbackComplete ? 0 : HOURS_PER_YEAR,
    dispatchBus: 'ac-load-bus-kwh',
    synthetic: true
  };
}

export function evaluateOffgridFieldGuaranteeReadiness({
  productionProfile = {},
  loadProfile = {},
  battery = {},
  generator = {},
  dispatchOptions = {}
} = {}) {
  const blockers = [];
  const limitations = [];
  const satisfied = [];

  if (productionProfile.hasRealHourlyProduction) {
    satisfied.push('real-hourly-pv-8760');
  } else {
    blockers.push('Gerçek 8760 saatlik PV üretim serisi yok; dispatch aylık üretimden türetilmiş sentetik profil kullanıyor.');
  }

  if (loadProfile.hasRealHourlyLoad) {
    satisfied.push('real-hourly-load-8760');
  } else {
    blockers.push('Gerçek 8760 saatlik saha yük profili yok; yük cihaz kütüphanesi veya günlük tüketimden sentetik üretiliyor.');
  }

  if (loadProfile.criticalLoadBasis === 'real-hourly-critical-load') {
    satisfied.push('real-hourly-critical-load');
  } else {
    blockers.push('Kritik yük saatlik ölçülmüş/kanıtlı ayrı profil değil; kritik kapsama garanti metriği olamaz.');
  }

  if (Number.isFinite(Number(battery.maxChargePowerKw)) && Number.isFinite(Number(battery.maxDischargePowerKw))) {
    satisfied.push('battery-charge-discharge-power-limits');
  } else {
    blockers.push('Batarya şarj/deşarj güç limitleri datasheet seviyesinde tanımlı değil.');
  }

  if (Number.isFinite(Number(dispatchOptions.inverterAcLimitKw))) {
    satisfied.push('inverter-ac-limit');
  } else {
    blockers.push('İnverter AC limiti açık tanımlı değil.');
  }

  limitations.push('Batarya yaşlanması, sıcaklık derating ve ayrı charge/discharge efficiency henüz garanti dispatchine bağlanmadı.');
  if (generator?.enabled) {
    limitations.push('Jeneratör yakıt eğrisi, minimum yük oranı, start/stop ve bakım saatleri henüz datasheet bazlı modellenmedi.');
  }

  const phase1Ready = blockers.length === 0;
  return {
    version: 'OFFGRID-FIELD-GATE-2026.04-v1',
    status: phase1Ready ? 'phase-1-input-ready' : 'blocked',
    phase1Ready,
    fieldGuaranteeReady: false,
    guaranteeLevel: phase1Ready ? 'engineering-input-ready-not-field-guarantee' : 'pre-feasibility-only',
    blockers,
    limitations,
    satisfied
  };
}

function buildDeviceSummary(validDevices) {
  let criticalDeviceCount = 0;
  const deviceSummary = validDevices.map(device => {
    const category = device.category && DEVICE_LOAD_TEMPLATES[device.category] ? device.category : 'generic';
    const powerKw = Math.max(0, Number(device.powerW) || 0) / 1000;
    const hoursPerDay = Math.max(0, Math.min(24, Number(device.hoursPerDay) || 0));
    const nightHours = Math.max(0, Math.min(hoursPerDay, Number(device.nightHoursPerDay) || 0));
    const dayHours = hoursPerDay - nightHours;
    const dailyKwh = powerKw * hoursPerDay;
    const isCritical = !!device.isCritical;
    if (isCritical) criticalDeviceCount++;
    return {
      name: device.name || category,
      dailyWh: Math.round(powerKw * 1000 * hoursPerDay),
      dayWh:   Math.round(powerKw * 1000 * dayHours),
      nightWh: Math.round(powerKw * 1000 * nightHours),
      dailyKwh: Math.round(dailyKwh * 1000) / 1000,
      annualKwh: Math.round(dailyKwh * 365 * 100) / 100,
      isCritical,
      category,
      surgeMultiplier: deviceSurgeMultiplier(device, category)
    };
  });
  return { deviceSummary, criticalDeviceCount };
}

function deviceSurgeMultiplier(device, category) {
  const explicit = finitePositiveOr(device.startupFactor ?? device.surgeMultiplier, null);
  if (explicit !== null) return Math.max(1, Math.min(6, explicit));
  return CATEGORY_SURGE_MULTIPLIERS[category] || CATEGORY_SURGE_MULTIPLIERS.generic;
}

function exactMaskedTemplate(rawTemplate, hourSet) {
  const masked = rawTemplate.map((v, h) => hourSet.has(h) ? v : 0);
  const maskedSum = masked.reduce((a, b) => a + b, 0);
  if (maskedSum > 0) return masked.map(v => v / maskedSum);
  const activeHours = [...hourSet];
  return rawTemplate.map((_, h) => hourSet.has(h) ? 1 / activeHours.length : 0);
}

function blendDayNightTemplate(rawTemplate, dayHours, nightHours) {
  if (nightHours > 0 && dayHours > 0) {
    const dayTemplate = exactMaskedTemplate(rawTemplate, DAY_HOURS);
    const nightTemplate = exactMaskedTemplate(rawTemplate, NIGHT_HOURS);
    const totalHours = dayHours + nightHours;
    const dayFrac = dayHours / totalHours;
    const nightFrac = nightHours / totalHours;
    return dayTemplate.map((v, h) => v * dayFrac + nightTemplate[h] * nightFrac);
  }
  if (nightHours > 0 && dayHours <= 0) return exactMaskedTemplate(rawTemplate, NIGHT_HOURS);
  return norm24(rawTemplate);
}

function buildCriticalFromFraction(totalHourly8760, criticalFraction) {
  const frac = Math.max(0, Math.min(1, Number(criticalFraction) || 0.6));
  return totalHourly8760.map(v => Math.max(0, Number(v) || 0) * frac);
}

function clampCriticalToLoad(criticalHourly8760, totalHourly8760) {
  return totalHourly8760.map((load, i) => Math.max(0, Math.min(Number(load) || 0, Number(criticalHourly8760[i]) || 0)));
}

function fallbackPeakFromEnergy(totalHourly8760, criticalHourly8760) {
  return {
    hourlyPeakKw8760: totalHourly8760.map(v => Math.max(0, Number(v) || 0)),
    criticalPeakKw8760: criticalHourly8760.map(v => Math.max(0, Number(v) || 0))
  };
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function uncertaintyForScore(score, tier) {
  if (tier === 'field-validated') return { lowPct: 3, highPct: 8 };
  if (score >= 85) return { lowPct: 5, highPct: 12 };
  if (score >= 75) return { lowPct: 8, highPct: 18 };
  if (score >= 65) return { lowPct: 12, highPct: 28 };
  if (score >= 55) return { lowPct: 20, highPct: 40 };
  if (score >= 45) return { lowPct: 30, highPct: 55 };
  return { lowPct: 40, highPct: 70 };
}

export function buildOffgridAccuracyAssessment({
  productionProfile = {},
  loadProfile = {},
  battery = {},
  generator = {},
  dispatchOptions = {},
  calculationMode = 'basic',
  badWeatherEnabled = false
} = {}) {
  const factors = [];
  const blockers = [];
  let score = 20;

  const add = (points, key, note) => {
    score += points;
    factors.push({ key, points, note });
  };
  const penalize = (points, key, note) => {
    score -= points;
    factors.push({ key, points: -Math.abs(points), note });
  };

  if (productionProfile.hasRealHourlyProduction) {
    add(25, 'real-hourly-pv', 'Gerçek 8760 PV üretim serisi kullanıldı.');
  } else if (productionProfile.productionDispatchProfile === 'monthly-production-derived-synthetic-8760') {
    add(10, 'synthetic-hourly-pv', 'PV saatleri aylık üretimden sentetik 8760 profile dağıtıldı.');
    blockers.push('Gerçek 8760 PV üretimi yok; üretim saat içi dağılımı sentetik.');
  } else {
    blockers.push('Dispatch için güvenilir PV saatlik serisi yok.');
  }

  if (productionProfile.productionFallback || productionProfile.fallbackUsed) {
    penalize(5, 'production-fallback', 'Canlı/authoritative üretim yerine fallback üretim kullanıldı.');
  }

  if (loadProfile.hasRealHourlyLoad) {
    add(24, 'real-hourly-load', 'Gerçek 8760 toplam yük profili kullanıldı.');
  } else if (loadProfile.mode === 'device-list') {
    add(14, 'device-library-load', 'Cihaz kütüphanesi ve manuel cihazlar sentetik saatlik yüke çevrildi.');
    blockers.push('Cihaz kütüphanesi gerçek sayaç profili değildir; kullanım saatleri kullanıcı beyanına dayanır.');
  } else {
    add(8, 'daily-kwh-load', 'Günlük toplam tüketim varsayılan profil ile 8760 saate dağıtıldı.');
    blockers.push('Gerçek yük profili veya cihaz envanteri yok; günlük tüketim varsayılan profil ile dağıtıldı.');
  }

  if (loadProfile.criticalLoadBasis === 'real-hourly-critical-load') {
    add(14, 'real-critical-load', 'Kritik yük ayrı 8760 seriyle verildi.');
  } else if (loadProfile.criticalLoadBasis === 'device-critical-flags') {
    add(8, 'device-critical-flags', 'Kritik yük cihaz işaretlerinden türetildi.');
    blockers.push('Kritik yük önceliği cihaz işaretlerine dayanır; kritik yük saha ölçümü değildir.');
  } else if (loadProfile.criticalLoadBasis === 'fraction-of-real-hourly-load') {
    add(7, 'critical-fraction-real-load', 'Gerçek toplam yükten kritik oran türetildi.');
    blockers.push('Kritik yük ayrı ölçülmedi; toplam yükten oranla türetildi.');
  } else {
    add(4, 'critical-fraction-synthetic', 'Kritik yük oran varsayımıyla türetildi.');
    blockers.push('Kritik yük gerçek cihaz/saha profili değil; oran varsayımı kullanıldı.');
  }

  if (Number.isFinite(Number(battery.maxChargePowerKw ?? battery.maxChargeKw))) {
    add(3, 'battery-charge-limit', 'Batarya şarj kW limiti dispatch içine girdi.');
  } else {
    blockers.push('Batarya şarj kW limiti eksik; şarj gücü sınırsız varsayılabilir.');
  }
  if (Number.isFinite(Number(battery.maxDischargePowerKw ?? battery.maxDischargeKw))) {
    add(3, 'battery-discharge-limit', 'Batarya deşarj kW limiti dispatch içine girdi.');
  } else {
    blockers.push('Batarya deşarj kW limiti eksik; pik yük yeterliliği olduğundan iyi görünebilir.');
  }
  if (Number.isFinite(Number(dispatchOptions.inverterAcLimitKw))) {
    add(3, 'inverter-ac-limit', 'İnverter AC limiti ve surge varsayımı uygulandı.');
  } else {
    blockers.push('İnverter AC limiti eksik; güç limiti kaynaklı unmet yük kaçabilir.');
  }
  if (badWeatherEnabled) add(3, 'bad-weather-dispatch', 'Kötü hava penceresi dispatch yeniden çözülerek test edildi.');

  const generatorEnabled = !!(generator && generator.enabled && Number(generator.capacityKw) > 0);
  if (generatorEnabled && Number(generator.fuelCostPerKwh) > 0) {
    add(2, 'generator-cost', 'Jeneratör enerji ve yakıt maliyeti dispatch sonucuna bağlı.');
  } else if (generatorEnabled) {
    blockers.push('Jeneratör etkin ama yakıt maliyeti eksik veya sıfır; ekonomi olduğundan iyi görünebilir.');
  }

  let tier = 'basic-synthetic';
  if (loadProfile.mode === 'device-list') tier = 'device-library';
  if (productionProfile.hasRealHourlyProduction || loadProfile.hasRealHourlyLoad) tier = 'advanced-hourly';
  if (
    productionProfile.hasRealHourlyProduction &&
    loadProfile.hasRealHourlyLoad &&
    loadProfile.criticalLoadBasis === 'real-hourly-critical-load' &&
    Number.isFinite(Number(battery.maxChargePowerKw ?? battery.maxChargeKw)) &&
    Number.isFinite(Number(battery.maxDischargePowerKw ?? battery.maxDischargeKw)) &&
    Number.isFinite(Number(dispatchOptions.inverterAcLimitKw))
  ) {
    tier = 'field-input-ready';
  }

  if (calculationMode === 'advanced' && tier === 'basic-synthetic') {
    blockers.push('İleri mod seçildi ama gerçek 8760 veya cihaz envanteri girilmedi; sonuç basit sentetik seviyede kaldı.');
    penalize(4, 'advanced-request-missing-data', 'İleri mod için beklenen veri seti eksik.');
  }

  const accuracyScore = clampScore(score);
  const uncertainty = uncertaintyForScore(accuracyScore, tier);
  const confidenceLevel = accuracyScore >= 85 ? 'high'
    : accuracyScore >= 70 ? 'medium-high'
    : accuracyScore >= 55 ? 'medium'
    : accuracyScore >= 40 ? 'low'
    : 'very-low';

  return {
    version: OFFGRID_ACCURACY_VERSION,
    calculationMode,
    tier,
    accuracyScore,
    confidenceLevel,
    expectedUncertaintyPct: uncertainty,
    errorIsNotBounded: true,
    interpretation: accuracyScore >= 85
      ? 'Saatlik girdiler güçlü; yine de saha kabul ve operasyon kanıtı olmadan garanti değildir.'
      : accuracyScore >= 65
        ? 'Mühendislik ön tasarımına yaklaşır; kritik yük ve kötü hava kararları için saha verisi gerekir.'
        : accuracyScore >= 50
          ? 'Ön fizibilite için kullanılabilir; batarya/jeneratör yeterliliğinde çift haneli sapma beklenebilir.'
          : 'Kaba ön fizibilite; dispatch sonucu karar değil, veri toplama yönlendirmesidir.',
    factors,
    blockers: [...new Set(blockers)]
  };
}

/**
 * Cihaz listesinden, gerçek 8760 yükten veya basit mod girdisinden 8760 saatlik yük dizisi üret.
 *
 * Kaynak önceliği:
 * 1. options.hourlyLoad8760
 * 2. cihaz kütüphanesi + manuel cihaz listesi
 * 3. günlük tüketimden türetilmiş sentetik profil
 */
export function buildOffgridLoadProfile(devices, options = {}) {
  const validDevices = Array.isArray(devices)
    ? devices.filter(d => d && Number(d.powerW) > 0 && Number(d.hoursPerDay) > 0)
    : [];
  const inventory = buildDeviceSummary(validDevices);

  if (isComplete8760(options.hourlyLoad8760)) {
    const totalHourly8760 = clone8760(options.hourlyLoad8760);
    const criticalHourly8760 = isComplete8760(options.criticalHourly8760)
      ? clampCriticalToLoad(clone8760(options.criticalHourly8760), totalHourly8760)
      : buildCriticalFromFraction(totalHourly8760, options.criticalFraction);
    const annualTotalKwh = sum(totalHourly8760);
    const annualCriticalKwh = sum(criticalHourly8760);
    const peaks = fallbackPeakFromEnergy(totalHourly8760, criticalHourly8760);
    return {
      totalHourly8760,
      criticalHourly8760,
      ...peaks,
      annualTotalKwh,
      annualCriticalKwh,
      deviceSummary: inventory.deviceSummary,
      mode: 'hourly-8760',
      loadSource: options.hourlyLoadSource || 'real-hourly-8760',
      criticalLoadBasis: isComplete8760(options.criticalHourly8760) ? 'real-hourly-critical-load' : 'fraction-of-real-hourly-load',
      hasRealHourlyLoad: true,
      deviceCount: validDevices.length,
      criticalDeviceCount: inventory.criticalDeviceCount
    };
  }

  if (validDevices.length === 0) {
    // ── Basit mod: günlük kWh + kritik oran ──────────────────────────────────
    const dailyKwh = Math.max(0, Number(options.fallbackDailyKwh) || 5);
    const critFrac = Math.max(0, Math.min(1, Number(options.criticalFraction) || 0.6));
    const baseProfile = norm24(getLoadProfile(options.tariffType || 'residential'));

    const totalHourly8760 = [];
    const criticalHourly8760 = [];

    for (let monthIdx = 0; monthIdx < 12; monthIdx++) {
      for (let d = 0; d < MONTH_DAYS[monthIdx]; d++) {
        for (let h = 0; h < 24; h++) {
          const val = dailyKwh * baseProfile[h];
          totalHourly8760.push(val);
          criticalHourly8760.push(val * critFrac);
        }
      }
    }

    const annualTotalKwh = dailyKwh * 365;
    const peaks = fallbackPeakFromEnergy(totalHourly8760, criticalHourly8760);
    return {
      totalHourly8760,
      criticalHourly8760,
      ...peaks,
      annualTotalKwh,
      annualCriticalKwh: annualTotalKwh * critFrac,
      deviceSummary: [],
      mode: 'simple-fallback',
      loadSource: 'daily-kwh-synthetic-profile',
      criticalLoadBasis: 'critical-fraction-of-synthetic-load',
      hasRealHourlyLoad: false,
      deviceCount: 0,
      criticalDeviceCount: 0
    };
  }

  // ── Cihaz listesi modu ────────────────────────────────────────────────────
  const totalHourly8760 = new Array(HOURS_PER_YEAR).fill(0);
  const criticalHourly8760 = new Array(HOURS_PER_YEAR).fill(0);
  const hourlyPeakKw8760 = new Array(HOURS_PER_YEAR).fill(0);
  const criticalPeakKw8760 = new Array(HOURS_PER_YEAR).fill(0);
  const deviceSummary = [];
  let criticalDeviceCount = 0;

  for (const device of validDevices) {
    const powerKw = Math.max(0, Number(device.powerW) || 0) / 1000;
    const hoursPerDay = Math.max(0, Math.min(24, Number(device.hoursPerDay) || 0));
    const nightHours = Math.max(0, Math.min(hoursPerDay, Number(device.nightHoursPerDay) || 0));
    const dayHours = hoursPerDay - nightHours;
    const dailyKwh = powerKw * hoursPerDay;
    const isCritical = !!device.isCritical;

    const category = device.category && DEVICE_LOAD_TEMPLATES[device.category] ? device.category : 'generic';
    const rawTemplate = [...DEVICE_LOAD_TEMPLATES[category]];
    const template = blendDayNightTemplate(rawTemplate, dayHours, nightHours);
    const surgeMultiplier = deviceSurgeMultiplier(device, category);

    const normFactor = SEASONAL_NORM_FACTORS[category] || 1;
    const seasonFactors = SEASONAL_LOAD_FACTORS[category] || {};
    let cursor = 0;
    for (let monthIdx = 0; monthIdx < 12; monthIdx++) {
      const season = getLoadSeasonForMonth(monthIdx);
      const rawSeasonFactor = seasonFactors[season] ?? 1;
      const seasonalDailyKwh = normFactor > 0 ? dailyKwh * rawSeasonFactor / normFactor : dailyKwh;
      for (let d = 0; d < MONTH_DAYS[monthIdx]; d++) {
        for (let h = 0; h < 24; h++) {
          const val = seasonalDailyKwh * template[h];
          totalHourly8760[cursor] += val;
          if (val > 1e-9) hourlyPeakKw8760[cursor] += powerKw * surgeMultiplier;
          if (isCritical) {
            criticalHourly8760[cursor] += val;
            if (val > 1e-9) criticalPeakKw8760[cursor] += powerKw * surgeMultiplier;
          }
          cursor++;
        }
      }
    }

    if (isCritical) criticalDeviceCount++;
    deviceSummary.push({
      name: device.name || category,
      dailyWh: Math.round(powerKw * 1000 * hoursPerDay),
      dailyKwh: Math.round(dailyKwh * 1000) / 1000,
      annualKwh: Math.round(dailyKwh * 365 * 100) / 100,
      isCritical,
      category,
      surgeMultiplier
    });
  }

  const annualTotalKwh = sum(totalHourly8760);
  const annualCriticalKwh = sum(criticalHourly8760);

  return {
    totalHourly8760,
    criticalHourly8760,
    hourlyPeakKw8760,
    criticalPeakKw8760,
    annualTotalKwh,
    annualCriticalKwh,
    deviceSummary,
    mode: 'device-list',
    loadSource: 'device-library-and-manual-inventory',
    criticalLoadBasis: 'device-critical-flags',
    hasRealHourlyLoad: false,
    deviceCount: validDevices.length,
    criticalDeviceCount
  };
}

/**
 * Seviye 2 saatlik off-grid dispatch motoru.
 * Kritik yük önceliği, SOC rezerv koruması, batarya kW limitleri,
 * inverter AC limiti ve isteğe bağlı jeneratör desteği içerir.
 */
export function runOffgridDispatch(pvHourly8760, loadHourly8760, criticalLoadHourly8760, battery, generator, options = {}) {
  const pvScale = Math.max(0, Math.min(2, Number(options.pvScaleFactor) || 1.0));
  const usableCap = Math.max(0, Number(battery.usableCapacityKwh) || 0);
  const efficiency = Math.max(0.5, Math.min(1, Number(battery.efficiency) || 0.92));
  const chargeEff = Math.sqrt(efficiency);
  const dischargeEff = chargeEff;
  const socReserveKwh = Math.max(0, Math.min(usableCap * 0.5, Number(battery.socReserveKwh) || 0));

  const maxChargePowerKw = finiteOrInfinity(battery.maxChargePowerKw ?? battery.maxChargeKw ?? options.maxChargePowerKw);
  const maxDischargePowerKw = finiteOrInfinity(battery.maxDischargePowerKw ?? battery.maxDischargeKw ?? options.maxDischargePowerKw);
  const inverterAcLimitKw = finiteOrInfinity(options.inverterAcLimitKw ?? battery.inverterAcLimitKw);
  const inverterSurgeMultiplier = Math.max(1, Math.min(6, Number(options.inverterSurgeMultiplier) || 1.25));
  const inverterSurgeLimitKw = inverterAcLimitKw === Infinity ? Infinity : inverterAcLimitKw * inverterSurgeMultiplier;
  const loadPeakKw8760 = isComplete8760(options.loadPeakKw8760) ? options.loadPeakKw8760 : null;
  const criticalPeakKw8760 = isComplete8760(options.criticalPeakKw8760) ? options.criticalPeakKw8760 : null;

  const genEnabled = !!(generator && generator.enabled && Number(generator.capacityKw) > 0);
  const genCapKwh = genEnabled ? Math.max(0, Number(generator.capacityKw) || 0) : 0;
  const genFuelCostPerKwh = genEnabled ? Math.max(0, Number(generator.fuelCostPerKwh) || 0) : 0;

  let soc = Math.max(socReserveKwh, Math.min(usableCap, Number(battery.initialSocKwh) || socReserveKwh));

  let directPvToLoadKwh = 0;
  let batteryToLoadKwh = 0;
  let generatorToLoadKwh = 0;
  let generatorToCriticalKwh = 0;
  let curtailedPvKwh = 0;
  let unmetLoadKwh = 0;
  let unmetCriticalLoadKwh = 0;
  let totalPvGeneratedKwh = 0;
  let chargedFromPvKwh = 0;
  let generatorRunHours = 0;
  let generatorFuelCostAnnual = 0;
  let totalChargedKwh = 0;
  let pvBatteryServedKwh = 0;
  let pvBatteryCriticalServedKwh = 0;
  let batteryChargeLimitedKwh = 0;
  let batteryDischargeLimitedKwh = 0;
  let inverterPowerLimitedLoadKwh = 0;
  let inverterPowerLimitHours = 0;
  let minSocKwh = usableCap > 0 ? soc : 0;
  let socSumKwh = 0;

  let autonomousDays = 0;
  let autonomousDaysWithGenerator = 0;
  const hourly8760 = [];

  const N = Math.min(pvHourly8760.length, loadHourly8760.length, criticalLoadHourly8760.length, HOURS_PER_YEAR);
  let dailyUnmet = 0;
  let dailyUnmetWithGenerator = 0;
  let dailyLoad = 0;

  for (let i = 0; i < N; i++) {
    const rawPv = Math.max(0, Number(pvHourly8760[i]) || 0);
    const pv = rawPv * pvScale;
    const load = Math.max(0, Number(loadHourly8760[i]) || 0);
    const criticalLoad = Math.max(0, Math.min(load, Number(criticalLoadHourly8760[i]) || 0));
    const nonCriticalLoad = Math.max(0, load - criticalLoad);
    const loadPeakKw = Math.max(load, Number(loadPeakKw8760?.[i]) || load);
    const criticalPeakKw = Math.max(criticalLoad, Math.min(loadPeakKw, Number(criticalPeakKw8760?.[i]) || criticalLoad));
    const nonCriticalPeakKw = Math.max(0, loadPeakKw - criticalPeakKw);

    totalPvGeneratedKwh += pv;

    // PV+BESS tarafının AC inverter altında karşılayabileceği saatlik yük.
    let pvBatteryCriticalTarget = criticalLoad;
    let pvBatteryNonCriticalTarget = nonCriticalLoad;
    if (inverterAcLimitKw !== Infinity) {
      pvBatteryCriticalTarget = Math.min(pvBatteryCriticalTarget, inverterAcLimitKw);
      const continuousRoomForNonCritical = Math.max(0, inverterAcLimitKw - pvBatteryCriticalTarget);
      pvBatteryNonCriticalTarget = Math.min(pvBatteryNonCriticalTarget, continuousRoomForNonCritical);
    }
    if (inverterSurgeLimitKw !== Infinity) {
      if (criticalPeakKw > inverterSurgeLimitKw + 1e-9) {
        const criticalScale = Math.max(0, Math.min(1, inverterSurgeLimitKw / criticalPeakKw));
        pvBatteryCriticalTarget *= criticalScale;
        pvBatteryNonCriticalTarget = 0;
      } else if (nonCriticalPeakKw > 0 && loadPeakKw > inverterSurgeLimitKw + 1e-9) {
        const allowedNonCriticalPeak = Math.max(0, inverterSurgeLimitKw - criticalPeakKw);
        const nonCriticalScale = Math.max(0, Math.min(1, allowedNonCriticalPeak / nonCriticalPeakKw));
        pvBatteryNonCriticalTarget *= nonCriticalScale;
      }
    }

    const pvBatteryTargetLoad = Math.max(0, Math.min(load, pvBatteryCriticalTarget + pvBatteryNonCriticalTarget));
    const inverterLimitedThisHour = Math.max(0, load - pvBatteryTargetLoad);
    if (inverterLimitedThisHour > 1e-9) {
      inverterPowerLimitedLoadKwh += inverterLimitedThisHour;
      inverterPowerLimitHours += 1;
    }

    // 1. Doğrudan PV → kritik yük, sonra kritik olmayan yük.
    const directToCritical = Math.min(pv, pvBatteryCriticalTarget);
    const directToNonCritical = Math.min(Math.max(0, pv - directToCritical), pvBatteryNonCriticalTarget);
    const directSelf = directToCritical + directToNonCritical;
    directPvToLoadKwh += directSelf;
    let pvSurplus = Math.max(0, pv - directSelf);

    // 2. PV fazlası → batarya şarj; enerji kapasitesi ve kW limiti ayrı uygulanır.
    const chargeRoom = usableCap > 0 ? Math.max(0, (usableCap - soc) / chargeEff) : 0;
    const potentialChargeFromPv = Math.min(pvSurplus, chargeRoom);
    const chargeFromPv = Math.min(potentialChargeFromPv, maxChargePowerKw);
    if (potentialChargeFromPv > chargeFromPv + 1e-9) {
      batteryChargeLimitedKwh += potentialChargeFromPv - chargeFromPv;
    }
    soc += chargeFromPv * chargeEff;
    chargedFromPvKwh += chargeFromPv;
    totalChargedKwh += chargeFromPv * chargeEff;
    pvSurplus -= chargeFromPv;
    curtailedPvKwh += Math.max(0, pvSurplus);

    const criticalDeficitForBattery = Math.max(0, pvBatteryCriticalTarget - directToCritical);
    const nonCriticalDeficitForBattery = Math.max(0, pvBatteryNonCriticalTarget - directToNonCritical);
    const totalDeficitForBattery = criticalDeficitForBattery + nonCriticalDeficitForBattery;

    // 3. Batarya → kritik yük önce, sonra kritik olmayan yük.
    let batteryDischargeThisHour = 0;
    let batteryToCritical = 0;
    let batteryToNonCritical = 0;
    if (totalDeficitForBattery > 0 && soc > socReserveKwh + 1e-9) {
      const energyAvailableDischargeKwh = Math.max(0, (soc - socReserveKwh) * dischargeEff);
      const dischargeBudget = Math.min(energyAvailableDischargeKwh, maxDischargePowerKw);
      const powerLimitedDischarge = Math.max(0, Math.min(totalDeficitForBattery, energyAvailableDischargeKwh) - dischargeBudget);
      if (powerLimitedDischarge > 1e-9) batteryDischargeLimitedKwh += powerLimitedDischarge;

      const dischargeToCritical = Math.min(criticalDeficitForBattery, dischargeBudget);
      soc -= dischargeToCritical / dischargeEff;
      batteryToCritical = dischargeToCritical;
      batteryDischargeThisHour += dischargeToCritical;

      const budgetAfterCritical = Math.max(0, dischargeBudget - dischargeToCritical);
      const dischargeToNonCritical = Math.min(nonCriticalDeficitForBattery, budgetAfterCritical);
      soc -= dischargeToNonCritical / dischargeEff;
      batteryToNonCritical = dischargeToNonCritical;
      batteryDischargeThisHour += dischargeToNonCritical;
    }

    batteryToLoadKwh += batteryDischargeThisHour;
    pvBatteryServedKwh += directSelf + batteryDischargeThisHour;
    pvBatteryCriticalServedKwh += directToCritical + batteryToCritical;

    const remainingCriticalDeficit = Math.max(0, criticalLoad - directToCritical - batteryToCritical);
    const remainingTotalDeficit = Math.max(0, load - directSelf - batteryDischargeThisHour);

    // 4. Jeneratör (etkinse) kalan kritik yükü önce kapatır.
    let genKwhThisHour = 0;
    let genToCritical = 0;
    if (genEnabled && remainingTotalDeficit > 1e-6) {
      genToCritical = Math.min(remainingCriticalDeficit, genCapKwh);
      const genToNonCritical = Math.min(Math.max(0, remainingTotalDeficit - genToCritical), Math.max(0, genCapKwh - genToCritical));
      genKwhThisHour = genToCritical + genToNonCritical;
      generatorToLoadKwh += genKwhThisHour;
      generatorToCriticalKwh += genToCritical;
      generatorRunHours += 1;
      generatorFuelCostAnnual += genKwhThisHour * genFuelCostPerKwh;
    }

    // 5. Karşılanamayan yük
    const finalUnmet = Math.max(0, remainingTotalDeficit - genKwhThisHour);
    const finalUnmetCritical = Math.max(0, remainingCriticalDeficit - genToCritical);
    unmetLoadKwh += finalUnmet;
    unmetCriticalLoadKwh += finalUnmetCritical;
    dailyUnmet += remainingTotalDeficit;
    dailyUnmetWithGenerator += finalUnmet;
    dailyLoad += load;

    if (i % 24 === 23) {
      // Göreceli eşik: günlük yükün %1'i veya minimum 1 Wh
      const autonomyThreshold = Math.max(0.001, dailyLoad * 0.01);
      if (dailyUnmet < autonomyThreshold) autonomousDays++;
      if (dailyUnmetWithGenerator < autonomyThreshold) autonomousDaysWithGenerator++;
      dailyUnmet = 0;
      dailyUnmetWithGenerator = 0;
      dailyLoad = 0;
    }

    minSocKwh = Math.min(minSocKwh, soc);
    socSumKwh += soc;

    hourly8760.push({
      pvKwh: pv,
      loadKwh: load,
      criticalKwh: criticalLoad,
      directSelf,
      directToCritical,
      batteryDischarge: batteryDischargeThisHour,
      batteryToCritical,
      generatorKwh: genKwhThisHour,
      generatorToCritical: genToCritical,
      curtailed: Math.max(0, pvSurplus),
      unmet: finalUnmet,
      unmetCritical: finalUnmetCritical,
      inverterLimitedLoadKwh: inverterLimitedThisHour,
      soc
    });
  }

  const annualTotalLoad = hourly8760.reduce((a, h) => a + Math.max(0, Number(h.loadKwh) || 0), 0);
  const annualCriticalLoad = hourly8760.reduce((a, h) => a + Math.max(0, Number(h.criticalKwh) || 0), 0);

  const totalServed = directPvToLoadKwh + batteryToLoadKwh + generatorToLoadKwh;
  const totalLoadCoverage = annualTotalLoad > 0 ? Math.min(1, totalServed / annualTotalLoad) : 1;
  const solarBatteryLoadCoverage = annualTotalLoad > 0 ? Math.min(1, pvBatteryServedKwh / annualTotalLoad) : 1;

  const criticalServed = annualCriticalLoad - unmetCriticalLoadKwh;
  const criticalLoadCoverage = annualCriticalLoad > 0 ? Math.min(1, criticalServed / annualCriticalLoad) : 1;
  const solarBatteryCriticalCoverage = annualCriticalLoad > 0 ? Math.min(1, pvBatteryCriticalServedKwh / annualCriticalLoad) : 1;

  const autonomousDaysPct = (autonomousDays / 365) * 100;
  const autonomousDaysWithGeneratorPct = (autonomousDaysWithGenerator / 365) * 100;
  const cyclesPerYear = usableCap > 0 ? totalChargedKwh / usableCap : 0;
  const averageSocKwh = N > 0 ? socSumKwh / N : 0;

  return {
    // Enerji dengesi toplamları (kWh/yıl)
    directPvToLoadKwh,
    batteryToLoadKwh,
    generatorToLoadKwh,
    generatorToCriticalKwh,
    curtailedPvKwh,
    unmetLoadKwh,
    unmetCriticalLoadKwh,
    totalPvGeneratedKwh,
    chargedFromPvKwh,

    // Kapsama metrikleri (0-1 arası)
    totalLoadCoverage,
    criticalLoadCoverage,
    solarBatteryLoadCoverage,
    solarBatteryCriticalCoverage,

    // Güç limitleri
    batteryChargeLimitedKwh,
    batteryDischargeLimitedKwh,
    inverterPowerLimitedLoadKwh,
    inverterPowerLimitHours,
    maxChargePowerKw: maxChargePowerKw === Infinity ? null : maxChargePowerKw,
    maxDischargePowerKw: maxDischargePowerKw === Infinity ? null : maxDischargePowerKw,
    inverterAcLimitKw: inverterAcLimitKw === Infinity ? null : inverterAcLimitKw,
    inverterSurgeMultiplier,
    inverterSurgeLimitKw: inverterSurgeLimitKw === Infinity ? null : inverterSurgeLimitKw,

    // Özerklik
    autonomousDays,
    autonomousDaysPct,
    autonomousDaysWithGenerator,
    autonomousDaysWithGeneratorPct,

    // Jeneratör
    generatorRunHours,
    generatorFuelCostAnnual,

    // Batarya sağlığı
    cyclesPerYear,
    minimumSocKwh: minSocKwh,
    averageSocKwh,
    minimumSocPct: usableCap > 0 ? minSocKwh / usableCap : 0,
    averageSocPct: usableCap > 0 ? averageSocKwh / usableCap : 0,

    // Saatlik iz
    hourly8760
  };
}

/**
 * Yıl içinde en düşük PV'ye sahip ardışık N günlük pencereyi bulur.
 */
function findWorstPvWindow(pvHourly8760, nDays) {
  const nHours = nDays * 24;
  const n = Math.min(pvHourly8760.length, HOURS_PER_YEAR);
  if (nHours >= n) return 0;
  let windowPv = 0;
  for (let i = 0; i < nHours; i++) windowPv += Math.max(0, Number(pvHourly8760[i]) || 0);
  let minPv = windowPv;
  let worstStart = 0;
  for (let start = 1; start + nHours <= n; start++) {
    windowPv += (Math.max(0, Number(pvHourly8760[start + nHours - 1]) || 0))
              - (Math.max(0, Number(pvHourly8760[start - 1]) || 0));
    if (windowPv < minPv) { minPv = windowPv; worstStart = start; }
  }
  return worstStart;
}

/**
 * Kötü hava senaryosu — yıl içindeki en kötü ardışık günler için PV sıfırlanır/düşürülür,
 * dispatch yeniden çalıştırılır. Tüm yılı ölçeklemek yerine sadece o pencere etkilenir.
 */
export function runBadWeatherScenario(normalDispatchResult, pvHourly8760, loadHourly8760, criticalHourly8760, battery, generator, weatherLevel, options = {}) {
  const config = BAD_WEATHER_CONFIG[weatherLevel] || BAD_WEATHER_CONFIG.moderate;
  const { days: badDays, pvFactor } = config;
  const nHours = badDays * 24;

  const worstStart = findWorstPvWindow(pvHourly8760, badDays);

  // Sadece kötü hava penceresindeki PV'yi düşür, geri kalanı normal bırak
  const scaledPvHourly = Array.from({ length: Math.min(pvHourly8760.length, HOURS_PER_YEAR) }, (_, i) => {
    const v = Math.max(0, Number(pvHourly8760[i]) || 0);
    return (i >= worstStart && i < worstStart + nHours) ? v * pvFactor : v;
  });

  const badDispatch = runOffgridDispatch(scaledPvHourly, loadHourly8760, criticalHourly8760, battery, generator, options);

  // Kötü hava penceresindeki anlık metrikleri hesapla
  const windowHourly = badDispatch.hourly8760.slice(worstStart, worstStart + nHours);
  const windowLoad           = windowHourly.reduce((s, h) => s + (h.loadKwh     || 0), 0);
  const windowUnmet          = windowHourly.reduce((s, h) => s + (h.unmet       || 0), 0);
  const windowCriticalLoad   = windowHourly.reduce((s, h) => s + (h.criticalKwh || 0), 0);
  const windowUnmetCritical  = windowHourly.reduce((s, h) => s + (h.unmetCritical || 0), 0);
  const windowCoverage         = windowLoad         > 0 ? Math.max(0, 1 - windowUnmet        / windowLoad)         : 1;
  const windowCriticalCoverage = windowCriticalLoad > 0 ? Math.max(0, 1 - windowUnmetCritical / windowCriticalLoad) : 1;
  const windowMinSoc = windowHourly.reduce((mn, h) => Math.min(mn, h.soc ?? Infinity), Infinity);

  const criticalCoverageDropPct   = Math.max(0, (normalDispatchResult.criticalLoadCoverage   - badDispatch.criticalLoadCoverage)   * 100);
  const totalCoverageDropPct      = Math.max(0, (normalDispatchResult.totalLoadCoverage      - badDispatch.totalLoadCoverage)      * 100);
  const pvBatteryCoverageDropPct  = Math.max(0, (normalDispatchResult.solarBatteryLoadCoverage - badDispatch.solarBatteryLoadCoverage) * 100);
  const additionalGeneratorKwh   = Math.max(0, badDispatch.generatorToLoadKwh       - normalDispatchResult.generatorToLoadKwh);
  const additionalGeneratorCost  = Math.max(0, badDispatch.generatorFuelCostAnnual  - normalDispatchResult.generatorFuelCostAnnual);

  return {
    weatherLevel,
    pvScaleFactor: pvFactor,
    consecutiveDays: badDays,
    worstWindowStartHour: worstStart,
    worstWindowDayOfYear: Math.floor(worstStart / 24) + 1,
    windowCoverage,
    windowCriticalCoverage,
    windowMinSocKwh: isFinite(windowMinSoc) ? windowMinSoc : 0,
    dispatch: badDispatch,
    criticalCoverageDropPct,
    totalCoverageDropPct,
    pvBatteryCoverageDropPct,
    additionalGeneratorKwh,
    additionalGeneratorCost
  };
}

export function runOffgridStressScenarios({
  pvHourly8760 = [],
  loadHourly8760 = [],
  criticalHourly8760 = [],
  battery = {},
  generator = {},
  dispatchOptions = {},
  scenarios = OFFGRID_STRESS_SCENARIOS
} = {}) {
  const results = [];
  const loadPeakBase = isComplete8760(dispatchOptions.loadPeakKw8760) ? dispatchOptions.loadPeakKw8760 : loadHourly8760;
  const criticalPeakBase = isComplete8760(dispatchOptions.criticalPeakKw8760) ? dispatchOptions.criticalPeakKw8760 : criticalHourly8760;

  for (const scenario of scenarios) {
    const pv = scale8760(pvHourly8760, scenario.pvFactor);
    const load = scale8760(loadHourly8760, scenario.loadFactor);
    const critical = scaleCritical8760(criticalHourly8760, load, scenario.criticalLoadFactor);
    const batteryForScenario = scenario.batteryEol ? eolBatteryConfig(battery) : { ...battery };
    const scenarioOptions = {
      ...dispatchOptions,
      loadPeakKw8760: scaleOptional8760(loadPeakBase, scenario.loadFactor),
      criticalPeakKw8760: scaleOptional8760(criticalPeakBase, scenario.criticalLoadFactor)
    };
    const dispatch = runOffgridDispatch(pv, load, critical, batteryForScenario, generator, scenarioOptions);
    const peakCriticalKw = Math.max(...(scenarioOptions.criticalPeakKw8760 || critical).map(v => Math.max(0, Number(v) || 0)));
    results.push(dispatchSummaryForStress(scenario.key, scenario, dispatch, peakCriticalKw));
  }

  const worstCritical = results.reduce((acc, row) => !acc || row.criticalLoadCoverage < acc.criticalLoadCoverage ? row : acc, null);
  const worstTotal = results.reduce((acc, row) => !acc || row.totalLoadCoverage < acc.totalLoadCoverage ? row : acc, null);
  const maxUnmetCritical = results.reduce((acc, row) => !acc || row.unmetCriticalKwh > acc.unmetCriticalKwh ? row : acc, null);
  const generatorCapacityKw = Math.max(0, Number(generator?.capacityKw) || 0);
  const maxCriticalPeakKw = results.reduce((max, row) => Math.max(max, row.peakCriticalKw || 0), 0);
  const generatorCriticalPeakReservePct = generatorCapacityKw > 0 && maxCriticalPeakKw > 0
    ? (generatorCapacityKw / maxCriticalPeakKw) - 1
    : null;

  return {
    version: OFFGRID_FIELD_MODEL_VERSION,
    scenarios: results,
    worstCriticalScenario: worstCritical,
    worstTotalScenario: worstTotal,
    maxUnmetCriticalScenario: maxUnmetCritical,
    generatorCapacityKw,
    maxCriticalPeakKw,
    generatorCriticalPeakReservePct
  };
}

export function buildOffgridFieldModelMaturityGate(stressAnalysis = {}, {
  phase1Ready = false,
  phase2Ready = false,
  generator = {},
  thresholds = DEFAULT_FIELD_MODEL_THRESHOLDS
} = {}) {
  const blockers = [];
  const warnings = [];
  const scenarios = Array.isArray(stressAnalysis.scenarios) ? stressAnalysis.scenarios : [];
  const genEnabled = !!(generator && generator.enabled && Number(generator.capacityKw) > 0);

  if (!phase1Ready) blockers.push('Faz 1 saatlik dispatch girdileri tamamlanmadan Faz 3 model olgunluğu kabul edilemez.');
  if (!phase2Ready) blockers.push('Faz 2 doğrulanmış saha kanıtları tamamlanmadan Faz 3 model olgunluğu kabul edilemez.');
  if (!scenarios.length) blockers.push('Faz 3 stres senaryoları çalıştırılmadı.');

  scenarios.forEach(row => {
    if ((row.criticalLoadCoverage ?? 0) < thresholds.criticalCoverageMin) {
      blockers.push(`${row.key}: kritik yük kapsaması ${(row.criticalLoadCoverage * 100).toFixed(2)}%; eşik ${(thresholds.criticalCoverageMin * 100).toFixed(2)}%.`);
    }
    if ((row.unmetCriticalKwh ?? 0) > thresholds.unmetCriticalMaxKwh) {
      blockers.push(`${row.key}: karşılanamayan kritik yük ${Math.round(row.unmetCriticalKwh)} kWh/yıl; eşik ${thresholds.unmetCriticalMaxKwh} kWh/yıl.`);
    }
    if ((row.totalLoadCoverage ?? 0) < thresholds.totalCoverageMin) {
      blockers.push(`${row.key}: toplam yük kapsaması ${(row.totalLoadCoverage * 100).toFixed(2)}%; eşik ${(thresholds.totalCoverageMin * 100).toFixed(2)}%.`);
    }
    if ((row.inverterPowerLimitedKwh || 0) > 0) {
      warnings.push(`${row.key}: inverter güç limiti ${Math.round(row.inverterPowerLimitedKwh)} kWh/yıl yükü etkiliyor.`);
    }
    if ((row.batteryDischargeLimitedKwh || 0) > 0) {
      warnings.push(`${row.key}: batarya deşarj kW limiti ${Math.round(row.batteryDischargeLimitedKwh)} kWh/yıl yükü etkiliyor.`);
    }
  });

  if (genEnabled) {
    const reserve = stressAnalysis.generatorCriticalPeakReservePct;
    if (reserve == null || reserve < thresholds.generatorCriticalPeakReservePct) {
      blockers.push(`Jeneratör kritik pik yük için en az %${Math.round(thresholds.generatorCriticalPeakReservePct * 100)} kapasite payı sağlamıyor.`);
    }
  } else if (scenarios.some(row => (row.unmetCriticalKwh || 0) > thresholds.unmetCriticalMaxKwh)) {
    blockers.push('Jeneratör yokken stres senaryolarında kritik yük karşılanamıyor.');
  }

  const uniqueBlockers = [...new Set(blockers)];
  const uniqueWarnings = [...new Set(warnings)];
  const phase3Ready = uniqueBlockers.length === 0;

  return {
    version: OFFGRID_FIELD_MODEL_VERSION,
    status: phase3Ready ? 'phase3-ready' : 'blocked',
    phase3Ready,
    stressReady: scenarios.length > 0 && uniqueBlockers.length === 0,
    fieldGuaranteeReady: false,
    thresholds,
    blockers: uniqueBlockers,
    warnings: uniqueWarnings,
    worstCriticalScenario: stressAnalysis.worstCriticalScenario || null,
    worstTotalScenario: stressAnalysis.worstTotalScenario || null,
    maxUnmetCriticalScenario: stressAnalysis.maxUnmetCriticalScenario || null,
    generatorCriticalPeakReservePct: stressAnalysis.generatorCriticalPeakReservePct ?? null
  };
}

/**
 * Dispatch çıktılarını ui-render.js ve calc-engine.js için paketler.
 */
export function buildOffgridResults(normalDispatch, badWeatherDispatch, loadProfile, generatorConfig, financialInputs = {}, withoutGeneratorDispatch = null, productionProfile = {}) {
  const capex = Math.max(0, Number(financialInputs.systemCapexTry) || 0);
  const genCapex = Math.max(0, Number(financialInputs.generatorCapexTry) || 0);
  const totalCapex = capex + genCapex;

  // Yaşam döngüsü maliyeti: düz amortisman + jeneratör yakıt + pil değişimi
  const battCapex = Math.max(0, Number(financialInputs.batteryCapexTry) || 0);
  const battLifetime = Math.max(0, Number(financialInputs.batteryLifetimeYears) || 0);
  const battReplaceFraction = 0.85;
  const battReplacementsIn25y = battLifetime > 0 ? Math.floor(24 / battLifetime) : 0;
  const battReplacementAnnual = battLifetime > 0 ? (battCapex * battReplaceFraction * battReplacementsIn25y) / 25 : 0;
  const lifecycleCostAnnual = (totalCapex / 25) + (normalDispatch.generatorFuelCostAnnual || 0) + battReplacementAnnual;

  const generatorEnabled = !!(generatorConfig && generatorConfig.enabled && Number(generatorConfig.capacityKw) > 0);
  const accuracyAssessment = buildOffgridAccuracyAssessment({
    productionProfile: financialInputs.productionProfile || productionProfile,
    loadProfile,
    battery: financialInputs.batteryConfig || {},
    generator: generatorConfig || {},
    dispatchOptions: financialInputs.dispatchOptions || {},
    calculationMode: financialInputs.calculationMode || 'basic',
    badWeatherEnabled: !!badWeatherDispatch
  });

  return {
    // Dispatch özeti
    directPvKwh: normalDispatch.directPvToLoadKwh,
    batteryKwh: normalDispatch.batteryToLoadKwh,
    generatorKwh: normalDispatch.generatorToLoadKwh,
    generatorEnergyKwh: normalDispatch.generatorToLoadKwh,
    curtailedPvKwh: normalDispatch.curtailedPvKwh,
    unmetLoadKwh: normalDispatch.unmetLoadKwh,
    unmetCriticalKwh: normalDispatch.unmetCriticalLoadKwh,

    // Kapsama metrikleri
    totalLoadCoverage: normalDispatch.totalLoadCoverage,
    criticalLoadCoverage: normalDispatch.criticalLoadCoverage,
    totalLoadCoverageWithGenerator: normalDispatch.totalLoadCoverage,
    criticalLoadCoverageWithGenerator: normalDispatch.criticalLoadCoverage,
    // Jeneratörsüz karşılaştırma (jeneratör etkinse hesaplanır)
    totalLoadCoverageWithoutGenerator: withoutGeneratorDispatch
      ? withoutGeneratorDispatch.totalLoadCoverage
      : (generatorEnabled ? null : normalDispatch.totalLoadCoverage),
    criticalLoadCoverageWithoutGenerator: withoutGeneratorDispatch
      ? withoutGeneratorDispatch.criticalLoadCoverage
      : (generatorEnabled ? null : normalDispatch.criticalLoadCoverage),
    unmetLoadWithoutGeneratorKwh: withoutGeneratorDispatch
      ? withoutGeneratorDispatch.unmetLoadKwh
      : (generatorEnabled ? null : normalDispatch.unmetLoadKwh),
    pvBatteryLoadCoverage: normalDispatch.solarBatteryLoadCoverage,
    pvBatteryCriticalCoverage: normalDispatch.solarBatteryCriticalCoverage,

    // Özerklik ve batarya
    autonomousDays: normalDispatch.autonomousDays,
    autonomousDaysPct: normalDispatch.autonomousDaysPct,
    autonomousDaysWithGenerator: normalDispatch.autonomousDaysWithGenerator,
    autonomousDaysWithGeneratorPct: normalDispatch.autonomousDaysWithGeneratorPct,
    cyclesPerYear: normalDispatch.cyclesPerYear,
    minimumSoc: normalDispatch.minimumSocPct,
    averageSoc: normalDispatch.averageSocPct,
    minimumSocKwh: normalDispatch.minimumSocKwh,
    averageSocKwh: normalDispatch.averageSocKwh,

    // Güç limitleri
    batteryMaxChargeKw: normalDispatch.maxChargePowerKw,
    batteryMaxDischargeKw: normalDispatch.maxDischargePowerKw,
    batteryChargeLimitedKwh: normalDispatch.batteryChargeLimitedKwh,
    batteryDischargeLimitedKwh: normalDispatch.batteryDischargeLimitedKwh,
    inverterAcLimitKw: normalDispatch.inverterAcLimitKw,
    inverterSurgeMultiplier: normalDispatch.inverterSurgeMultiplier,
    inverterSurgeLimitKw: normalDispatch.inverterSurgeLimitKw,
    inverterPowerLimitedKwh: normalDispatch.inverterPowerLimitedLoadKwh,
    inverterPowerLimitHours: normalDispatch.inverterPowerLimitHours,

    // Jeneratör
    generatorEnabled,
    generatorCapacityKw: Math.max(0, Number(generatorConfig?.capacityKw) || 0),
    generatorRunHoursPerYear: normalDispatch.generatorRunHours,
    generatorFuelCostAnnual: normalDispatch.generatorFuelCostAnnual,
    generatorFuelCostPerKwh: Math.max(0, Number(generatorConfig?.fuelCostPerKwh) || 0),
    generatorCapex: genCapex,
    generatorCapexTry: genCapex,
    generatorCapexMissing: generatorEnabled && genCapex <= 0,

    // Kötü hava senaryosu
    badWeatherScenario: badWeatherDispatch || null,
    weatherScenario: badWeatherDispatch?.weatherLevel || financialInputs.weatherScenario || '',

    // Ekonomi
    lifecycleCostAnnual,
    battReplacementAnnual,
    battReplacementsIn25y,
    systemCapexTry: capex,
    totalCapexTry: totalCapex,
    alternativeEnergyCostPerKwh: Math.max(0, Number(financialInputs.alternativeEnergyCostPerKwh) || 0),

    // Doğruluk / belirsizlik
    accuracyAssessment,
    accuracyScore: accuracyAssessment.accuracyScore,
    accuracyTier: accuracyAssessment.tier,
    expectedUncertaintyPct: accuracyAssessment.expectedUncertaintyPct,
    calculationMode: accuracyAssessment.calculationMode,

    // Yük profili meta
    loadMode: loadProfile.mode,
    loadSource: loadProfile.loadSource || loadProfile.mode,
    hasRealHourlyLoad: !!loadProfile.hasRealHourlyLoad,
    criticalLoadBasis: loadProfile.criticalLoadBasis || null,
    annualTotalLoadKwh: loadProfile.annualTotalKwh,
    annualCriticalLoadKwh: loadProfile.annualCriticalKwh,
    deviceSummary: loadProfile.deviceSummary || [],
    deviceCount: loadProfile.deviceCount || 0,
    criticalDeviceCount: loadProfile.criticalDeviceCount || 0,

    // Dürüstlük meta
    dispatchType: loadProfile.hasRealHourlyLoad ? 'hourly-8760-dispatch' : 'synthetic-8760-dispatch',
    methodologyNote: loadProfile.hasRealHourlyLoad ? 'hourly-load-dispatch-pre-feasibility' : 'synthetic-dispatch-pre-feasibility',
    provisional: true,
    synthetic: !loadProfile.hasRealHourlyLoad,
    feasibilityNotGuaranteed: true,
    dispatchVersion: OFFGRID_DISPATCH_VERSION
  };
}
