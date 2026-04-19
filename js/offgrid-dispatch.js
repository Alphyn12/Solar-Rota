// ═══════════════════════════════════════════════════════════
// OFFGRID DISPATCH — Solar Rota Off-Grid Level 2 Engine
// Synthetic/real-hourly dispatch, critical load priority, battery and inverter power limits
// Sadece off-grid senaryosunda çağrılır. DOM erişimi yok.
// Solar Rota v2.0 — OGD-2026.04-v1.1
// ═══════════════════════════════════════════════════════════
import { getLoadProfile } from './calc-core.js';

export const OFFGRID_DISPATCH_VERSION = 'OGD-2026.04-v1.1';

const HOURS_PER_YEAR = 8760;
const MONTH_DAYS = [31,28,31,30,31,30,31,31,30,31,30,31];
const DAY_HOURS = new Set([6,7,8,9,10,11,12,13,14,15,16,17]);
const NIGHT_HOURS = new Set([0,1,2,3,4,5,18,19,20,21,22,23]);

// Sentetik kötü hava PV ölçekleme faktörleri
export const BAD_WEATHER_PV_FACTORS = {
  light:    0.70,  // -30% PV — 3 bulutlu gün
  moderate: 0.45,  // -55% PV — 5 ardışık kasvetli gün
  severe:   0.25   // -75% PV — Karadeniz / dağ kışı
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

function buildDeviceSummary(validDevices) {
  let criticalDeviceCount = 0;
  const deviceSummary = validDevices.map(device => {
    const category = device.category && DEVICE_LOAD_TEMPLATES[device.category] ? device.category : 'generic';
    const powerKw = Math.max(0, Number(device.powerW) || 0) / 1000;
    const hoursPerDay = Math.max(0, Math.min(24, Number(device.hoursPerDay) || 0));
    const dailyKwh = powerKw * hoursPerDay;
    const isCritical = !!device.isCritical;
    if (isCritical) criticalDeviceCount++;
    return {
      name: device.name || category,
      dailyWh: Math.round(powerKw * 1000 * hoursPerDay),
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

    let cursor = 0;
    for (let monthIdx = 0; monthIdx < 12; monthIdx++) {
      for (let d = 0; d < MONTH_DAYS[monthIdx]; d++) {
        for (let h = 0; h < 24; h++) {
          const val = dailyKwh * template[h];
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
  const hourly8760 = [];

  const N = Math.min(pvHourly8760.length, loadHourly8760.length, criticalLoadHourly8760.length, HOURS_PER_YEAR);
  let dailyUnmet = 0;

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
    dailyUnmet += finalUnmet;

    if (i % 24 === 23) {
      if (dailyUnmet < 0.001) autonomousDays++;
      dailyUnmet = 0;
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

  const annualTotalLoad = loadHourly8760.slice(0, N).reduce((a, b) => a + Math.max(0, Number(b) || 0), 0);
  const annualCriticalLoad = criticalLoadHourly8760.slice(0, N).reduce((a, b) => a + Math.max(0, Number(b) || 0), 0);

  const totalServed = directPvToLoadKwh + batteryToLoadKwh + generatorToLoadKwh;
  const totalLoadCoverage = annualTotalLoad > 0 ? Math.min(1, totalServed / annualTotalLoad) : 1;
  const solarBatteryLoadCoverage = annualTotalLoad > 0 ? Math.min(1, pvBatteryServedKwh / annualTotalLoad) : 1;

  const criticalServed = annualCriticalLoad - unmetCriticalLoadKwh;
  const criticalLoadCoverage = annualCriticalLoad > 0 ? Math.min(1, criticalServed / annualCriticalLoad) : 1;
  const solarBatteryCriticalCoverage = annualCriticalLoad > 0 ? Math.min(1, pvBatteryCriticalServedKwh / annualCriticalLoad) : 1;

  const autonomousDaysPct = (autonomousDays / 365) * 100;
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
 * Kötü hava senaryosu — PV ölçeklendirilerek dispatch yeniden çalıştırılır.
 */
export function runBadWeatherScenario(normalDispatchResult, pvHourly8760, loadHourly8760, criticalHourly8760, battery, generator, weatherLevel, options = {}) {
  const factor = BAD_WEATHER_PV_FACTORS[weatherLevel] || BAD_WEATHER_PV_FACTORS.moderate;
  const badDispatch = runOffgridDispatch(pvHourly8760, loadHourly8760, criticalHourly8760, battery, generator, {
    ...options,
    pvScaleFactor: factor
  });

  const criticalCoverageDropPct = Math.max(0, (normalDispatchResult.criticalLoadCoverage - badDispatch.criticalLoadCoverage) * 100);
  const totalCoverageDropPct = Math.max(0, (normalDispatchResult.totalLoadCoverage - badDispatch.totalLoadCoverage) * 100);
  const pvBatteryCoverageDropPct = Math.max(0, (normalDispatchResult.solarBatteryLoadCoverage - badDispatch.solarBatteryLoadCoverage) * 100);
  const additionalGeneratorKwh = Math.max(0, badDispatch.generatorToLoadKwh - normalDispatchResult.generatorToLoadKwh);
  const additionalGeneratorCost = Math.max(0, badDispatch.generatorFuelCostAnnual - normalDispatchResult.generatorFuelCostAnnual);

  return {
    weatherLevel,
    pvScaleFactor: factor,
    dispatch: badDispatch,
    criticalCoverageDropPct,
    totalCoverageDropPct,
    pvBatteryCoverageDropPct,
    additionalGeneratorKwh,
    additionalGeneratorCost
  };
}

/**
 * Dispatch çıktılarını ui-render.js ve calc-engine.js için paketler.
 */
export function buildOffgridResults(normalDispatch, badWeatherDispatch, loadProfile, generatorConfig, financialInputs = {}) {
  const capex = Math.max(0, Number(financialInputs.systemCapexTry) || 0);
  const genCapex = Math.max(0, Number(financialInputs.generatorCapexTry) || 0);
  const totalCapex = capex + genCapex;
  const lifecycleCostAnnual = (totalCapex / 25) + (normalDispatch.generatorFuelCostAnnual || 0);
  const generatorEnabled = !!(generatorConfig && generatorConfig.enabled && Number(generatorConfig.capacityKw) > 0);

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
    pvBatteryLoadCoverage: normalDispatch.solarBatteryLoadCoverage,
    pvBatteryCriticalCoverage: normalDispatch.solarBatteryCriticalCoverage,

    // Özerklik ve batarya
    autonomousDays: normalDispatch.autonomousDays,
    autonomousDaysPct: normalDispatch.autonomousDaysPct,
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
    systemCapexTry: capex,
    totalCapexTry: totalCapex,
    alternativeEnergyCostPerKwh: Math.max(0, Number(financialInputs.alternativeEnergyCostPerKwh) || 0),

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
