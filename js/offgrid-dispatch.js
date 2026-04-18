// ═══════════════════════════════════════════════════════════
// OFFGRID DISPATCH — Solar Rota Off-Grid Level 2 Engine
// Synthetic saatlik dispatch, kritik yük önceliği, jeneratör desteği
// Sadece off-grid senaryosunda çağrılır. DOM erişimi yok.
// Solar Rota v2.0 — OGD-2026.04-v1.0
// ═══════════════════════════════════════════════════════════
import { HOURLY_SOLAR_PROFILE } from './data.js';
import { normalizeProfile, getSeasonForMonth, getLoadProfile } from './calc-core.js';

export const OFFGRID_DISPATCH_VERSION = 'OGD-2026.04-v1.0';

// Sentetik kötü hava PV ölçekleme faktörleri
export const BAD_WEATHER_PV_FACTORS = {
  light:    0.70,  // -30% PV — 3 bulutlu gün
  moderate: 0.45,  // -55% PV — 5 ardışık kasvetli gün
  severe:   0.25   // -75% PV — Karadeniz / dağ kışı
};

// Cihaz kategorisi başına 24 saatlik şablonlar (toplamları 1.0)
// Fiziksel anlam: tipik günlük kullanım ağırlığı saat başına
export const DEVICE_LOAD_TEMPLATES = {
  lighting:      [0.005,0.005,0.005,0.005,0.005,0.010,0.020,0.030,0.020,0.015,0.015,0.015,
                  0.015,0.015,0.015,0.020,0.030,0.060,0.080,0.085,0.085,0.075,0.060,0.025],
  refrigerator:  [0.0417,0.0417,0.0417,0.0417,0.0417,0.0417,0.0417,0.0417,0.0417,0.0417,0.0417,0.0417,
                  0.0417,0.0417,0.0417,0.0417,0.0417,0.0417,0.0417,0.0417,0.0417,0.0417,0.0417,0.0413],
  pump:          [0,0,0,0,0,0,0.050,0.120,0.140,0.140,0.140,0.120,
                  0.100,0.100,0.100,0.090,0,0,0,0,0,0,0,0],
  entertainment: [0.005,0.005,0.005,0.005,0.005,0.005,0.010,0.020,0.030,0.030,0.030,0.030,
                  0.030,0.030,0.030,0.030,0.040,0.075,0.105,0.120,0.120,0.100,0.065,0.025],
  generic:       [0.042,0.042,0.042,0.042,0.042,0.042,0.042,0.042,0.042,0.042,0.042,0.042,
                  0.042,0.042,0.042,0.042,0.042,0.042,0.042,0.042,0.042,0.042,0.042,0.034]
};

// İç yardımcı: profili normalize et ve 1.0'a topla
function norm24(arr) {
  const sum = arr.reduce((a, b) => a + b, 0);
  if (sum <= 0) return arr.map(() => 1 / 24);
  return arr.map(v => v / sum);
}


/**
 * Cihaz listesinden veya basit mod girdisinden 8760 saatlik yük dizisi üret.
 *
 * @param {Array<{
 *   name: string,
 *   category: 'lighting'|'refrigerator'|'pump'|'entertainment'|'generic',
 *   powerW: number,
 *   hoursPerDay: number,
 *   isCritical: boolean
 * }>} devices - Cihaz listesi (boşsa basit mod kullanılır)
 *
 * @param {{
 *   fallbackDailyKwh?: number,
 *   criticalFraction?: number,
 *   tariffType?: string
 * }} options
 *
 * @returns {{
 *   totalHourly8760: number[],
 *   criticalHourly8760: number[],
 *   annualTotalKwh: number,
 *   annualCriticalKwh: number,
 *   deviceSummary: Array<{name,dailyKwh,annualKwh,isCritical}>,
 *   mode: 'device-list'|'simple-fallback'
 * }}
 */
export function buildOffgridLoadProfile(devices, options = {}) {
  const monthDays = [31,28,31,30,31,30,31,31,30,31,30,31];
  const validDevices = Array.isArray(devices) ? devices.filter(d => d && Number(d.powerW) > 0 && Number(d.hoursPerDay) > 0) : [];

  if (validDevices.length === 0) {
    // ── Basit mod: günlük kWh + kritik oran ──────────────────────────────────
    const dailyKwh = Math.max(0, Number(options.fallbackDailyKwh) || 5);
    const critFrac = Math.max(0, Math.min(1, Number(options.criticalFraction) || 0.6));
    const baseProfile = norm24(getLoadProfile(options.tariffType || 'residential'));

    const totalHourly8760 = [];
    const criticalHourly8760 = [];

    for (let monthIdx = 0; monthIdx < 12; monthIdx++) {
      for (let d = 0; d < monthDays[monthIdx]; d++) {
        for (let h = 0; h < 24; h++) {
          const val = dailyKwh * baseProfile[h];
          totalHourly8760.push(val);
          criticalHourly8760.push(val * critFrac);
        }
      }
    }

    const annualTotalKwh = dailyKwh * 365;
    return {
      totalHourly8760,
      criticalHourly8760,
      annualTotalKwh,
      annualCriticalKwh: annualTotalKwh * critFrac,
      deviceSummary: [],
      mode: 'simple-fallback'
    };
  }

  // ── Cihaz listesi modu ────────────────────────────────────────────────────
  const totalHourly8760 = new Array(8760).fill(0);
  const criticalHourly8760 = new Array(8760).fill(0);
  const deviceSummary = [];

  for (const device of validDevices) {
    const powerKw = Math.max(0, Number(device.powerW) || 0) / 1000;
    const hoursPerDay = Math.max(0, Math.min(24, Number(device.hoursPerDay) || 0));
    const dailyKwh = powerKw * hoursPerDay;
    const isCritical = !!device.isCritical;
    const category = device.category && DEVICE_LOAD_TEMPLATES[device.category] ? device.category : 'generic';
    const template = norm24([...DEVICE_LOAD_TEMPLATES[category]]);

    let cursor = 0;
    for (let monthIdx = 0; monthIdx < 12; monthIdx++) {
      for (let d = 0; d < monthDays[monthIdx]; d++) {
        for (let h = 0; h < 24; h++) {
          const val = dailyKwh * template[h];
          totalHourly8760[cursor] += val;
          if (isCritical) criticalHourly8760[cursor] += val;
          cursor++;
        }
      }
    }

    deviceSummary.push({
      name: device.name || category,
      dailyKwh: Math.round(dailyKwh * 1000) / 1000,
      annualKwh: Math.round(dailyKwh * 365 * 100) / 100,
      isCritical
    });
  }

  const annualTotalKwh = totalHourly8760.reduce((a, b) => a + b, 0);
  const annualCriticalKwh = criticalHourly8760.reduce((a, b) => a + b, 0);

  return {
    totalHourly8760,
    criticalHourly8760,
    annualTotalKwh,
    annualCriticalKwh,
    deviceSummary,
    mode: 'device-list'
  };
}

/**
 * Seviye 2 saatlik off-grid dispatch motoru.
 * Kritik yük önceliği, SOC rezerv koruması, isteğe bağlı jeneratör desteği.
 *
 * @param {number[]} pvHourly8760 - Saat başına PV üretimi (kWh)
 * @param {number[]} loadHourly8760 - Saat başına toplam yük (kWh)
 * @param {number[]} criticalLoadHourly8760 - Saat başına kritik yük (kWh)
 * @param {{
 *   usableCapacityKwh: number,
 *   efficiency: number,
 *   socReserveKwh: number,
 *   initialSocKwh?: number
 * }} battery
 * @param {{
 *   enabled: boolean,
 *   capacityKw: number,
 *   fuelCostPerKwh: number
 * }} generator
 * @param {{
 *   pvScaleFactor?: number
 * }} options
 *
 * @returns {object} Dispatch sonuç nesnesi
 */
export function runOffgridDispatch(pvHourly8760, loadHourly8760, criticalLoadHourly8760, battery, generator, options = {}) {
  const pvScale = Math.max(0, Math.min(2, Number(options.pvScaleFactor) || 1.0));
  const usableCap = Math.max(0, Number(battery.usableCapacityKwh) || 0);
  const efficiency = Math.max(0.5, Math.min(1, Number(battery.efficiency) || 0.92));
  const chargeEff = Math.sqrt(efficiency);
  const dischargeEff = chargeEff;
  const socReserveKwh = Math.max(0, Math.min(usableCap * 0.5, Number(battery.socReserveKwh) || 0));
  const dispatchableCap = usableCap - socReserveKwh;

  const genEnabled = !!(generator && generator.enabled && Number(generator.capacityKw) > 0);
  const genCapKwh = genEnabled ? Math.max(0, Number(generator.capacityKw) || 0) : 0; // kW → kWh/h when running 1h
  const genFuelCostPerKwh = genEnabled ? Math.max(0, Number(generator.fuelCostPerKwh) || 0) : 0;

  let soc = Math.max(socReserveKwh, Math.min(usableCap, Number(battery.initialSocKwh) || socReserveKwh));

  // Yıllık birikimler
  let directPvToLoadKwh = 0;
  let batteryToLoadKwh = 0;
  let generatorToLoadKwh = 0;
  let curtailedPvKwh = 0;
  let unmetLoadKwh = 0;
  let unmetCriticalLoadKwh = 0;
  let totalPvGeneratedKwh = 0;
  let chargedFromPvKwh = 0;
  let generatorRunHours = 0;
  let generatorFuelCostAnnual = 0;
  let totalChargedKwh = 0; // Çevrim sayımı için

  let autonomousDays = 0;
  const hourly8760 = [];

  const N = Math.min(pvHourly8760.length, loadHourly8760.length, criticalLoadHourly8760.length, 8760);
  let dailyUnmet = 0;
  let hourOfDay = 0;

  for (let i = 0; i < N; i++) {
    const rawPv = Math.max(0, Number(pvHourly8760[i]) || 0);
    const pv = rawPv * pvScale;
    const load = Math.max(0, Number(loadHourly8760[i]) || 0);
    const criticalLoad = Math.max(0, Math.min(load, Number(criticalLoadHourly8760[i]) || 0));

    totalPvGeneratedKwh += pv;

    // 1. Doğrudan PV → Yük
    const directSelf = Math.min(pv, load);
    directPvToLoadKwh += directSelf;
    let pvSurplus = pv - directSelf;
    let deficit = load - directSelf;

    // 2. PV fazlası → batarya şarj
    const chargeRoom = (usableCap - soc) / chargeEff;
    const chargeFromPv = Math.min(pvSurplus, chargeRoom);
    soc += chargeFromPv * chargeEff;
    chargedFromPvKwh += chargeFromPv;
    totalChargedKwh += chargeFromPv * chargeEff; // depositlenen kWh
    pvSurplus -= chargeFromPv;
    curtailedPvKwh += pvSurplus; // Artık PV kırpılır

    // 3. Kritik yük açığı önce hesapla
    const criticalDeficit = Math.max(0, criticalLoad - directSelf);
    const nonCriticalDeficit = Math.max(0, deficit - criticalDeficit);

    // 4. Batarya → kritik yük önce
    let batteryDischargeThisHour = 0;
    let batteryToCritical = 0;
    let batteryToNonCritical = 0;

    if (deficit > 0 && soc > socReserveKwh + 1e-9) {
      const availableDischargeKwh = (soc - socReserveKwh) * dischargeEff;
      // Kritik açığa karşıla
      const dischargeToCritical = Math.min(criticalDeficit, availableDischargeKwh);
      soc -= dischargeToCritical / dischargeEff;
      batteryToCritical = dischargeToCritical;
      batteryDischargeThisHour += dischargeToCritical;

      // Kalan kapasite ile kritik olmayan açığı karşıla
      const availableAfterCritical = Math.max(0, (soc - socReserveKwh) * dischargeEff);
      const dischargeToNonCritical = Math.min(nonCriticalDeficit, availableAfterCritical);
      soc -= dischargeToNonCritical / dischargeEff;
      batteryToNonCritical = dischargeToNonCritical;
      batteryDischargeThisHour += dischargeToNonCritical;
    }

    batteryToLoadKwh += batteryDischargeThisHour;
    const remainingDeficit = Math.max(0, deficit - batteryDischargeThisHour);
    const remainingCriticalDeficit = Math.max(0, criticalDeficit - batteryToCritical);

    // 5. Jeneratör (etkinse ve açık varsa)
    let genKwhThisHour = 0;
    let genToCritical = 0;
    if (genEnabled && remainingDeficit > 1e-6) {
      genKwhThisHour = Math.min(genCapKwh, remainingDeficit);
      genToCritical = Math.min(remainingCriticalDeficit, genKwhThisHour);
      generatorToLoadKwh += genKwhThisHour;
      generatorRunHours += 1;
      generatorFuelCostAnnual += genKwhThisHour * genFuelCostPerKwh;
    }

    // 6. Karşılanamayan yük
    const finalUnmet = Math.max(0, remainingDeficit - genKwhThisHour);
    const finalUnmetCritical = Math.max(0, remainingCriticalDeficit - genToCritical);
    unmetLoadKwh += finalUnmet;
    unmetCriticalLoadKwh += finalUnmetCritical;
    dailyUnmet += finalUnmet;

    // Günlük özerklik takibi (UTC saat)
    hourOfDay = i % 24;
    if (hourOfDay === 23) {
      if (dailyUnmet < 0.001) autonomousDays++;
      dailyUnmet = 0;
    }

    hourly8760.push({
      pvKwh: pv,
      loadKwh: load,
      criticalKwh: criticalLoad,
      directSelf,
      batteryDischarge: batteryDischargeThisHour,
      generatorKwh: genKwhThisHour,
      curtailed: pvSurplus,
      unmet: finalUnmet,
      unmetCritical: finalUnmetCritical,
      soc
    });
  }

  const annualTotalLoad = loadHourly8760.slice(0, N).reduce((a, b) => a + Math.max(0, Number(b) || 0), 0);
  const annualCriticalLoad = criticalLoadHourly8760.slice(0, N).reduce((a, b) => a + Math.max(0, Number(b) || 0), 0);

  const totalServed = directPvToLoadKwh + batteryToLoadKwh + generatorToLoadKwh;
  const totalLoadCoverage = annualTotalLoad > 0 ? Math.min(1, totalServed / annualTotalLoad) : 1;

  const criticalServed = annualCriticalLoad - unmetCriticalLoadKwh;
  const criticalLoadCoverage = annualCriticalLoad > 0 ? Math.min(1, criticalServed / annualCriticalLoad) : 1;

  const autonomousDaysPct = (autonomousDays / 365) * 100;

  // Çevrim sayımı: toplam depolanan kWh / kullanılabilir kapasite
  const cyclesPerYear = usableCap > 0 ? totalChargedKwh / usableCap : 0;

  return {
    // Enerji dengesi toplamları (kWh/yıl)
    directPvToLoadKwh,
    batteryToLoadKwh,
    generatorToLoadKwh,
    curtailedPvKwh,
    unmetLoadKwh,
    unmetCriticalLoadKwh,
    totalPvGeneratedKwh,
    chargedFromPvKwh,

    // Kapsama metrikleri (0–1 arası)
    totalLoadCoverage,
    criticalLoadCoverage,

    // Özerklik
    autonomousDays,
    autonomousDaysPct,

    // Jeneratör
    generatorRunHours,
    generatorFuelCostAnnual,

    // Batarya sağlığı
    cyclesPerYear,

    // Saatlik iz
    hourly8760
  };
}

/**
 * Kötü hava senaryosu — PV ölçeklendirilerek dispatch yeniden çalıştırılır.
 *
 * @param {object} normalDispatchResult - runOffgridDispatch çıktısı (pvScaleFactor=1.0)
 * @param {number[]} pvHourly8760
 * @param {number[]} loadHourly8760
 * @param {number[]} criticalHourly8760
 * @param {object} battery
 * @param {object} generator
 * @param {'light'|'moderate'|'severe'} weatherLevel
 * @returns {object}
 */
export function runBadWeatherScenario(normalDispatchResult, pvHourly8760, loadHourly8760, criticalHourly8760, battery, generator, weatherLevel) {
  const factor = BAD_WEATHER_PV_FACTORS[weatherLevel] || BAD_WEATHER_PV_FACTORS.moderate;
  const badDispatch = runOffgridDispatch(pvHourly8760, loadHourly8760, criticalHourly8760, battery, generator, { pvScaleFactor: factor });

  const criticalCoverageDropPct = Math.max(0, (normalDispatchResult.criticalLoadCoverage - badDispatch.criticalLoadCoverage) * 100);
  const totalCoverageDropPct = Math.max(0, (normalDispatchResult.totalLoadCoverage - badDispatch.totalLoadCoverage) * 100);
  const additionalGeneratorKwh = Math.max(0, badDispatch.generatorToLoadKwh - normalDispatchResult.generatorToLoadKwh);
  const additionalGeneratorCost = Math.max(0, badDispatch.generatorFuelCostAnnual - normalDispatchResult.generatorFuelCostAnnual);

  return {
    weatherLevel,
    pvScaleFactor: factor,
    dispatch: badDispatch,
    criticalCoverageDropPct,
    totalCoverageDropPct,
    additionalGeneratorKwh,
    additionalGeneratorCost
  };
}

/**
 * Dispatch çıktılarını ui-render.js ve calc-engine.js için paketler.
 *
 * @param {object} normalDispatch - runOffgridDispatch çıktısı
 * @param {object|null} badWeatherDispatch - runBadWeatherScenario çıktısı
 * @param {object} loadProfile - buildOffgridLoadProfile çıktısı
 * @param {{enabled,capacityKw,fuelCostPerKwh}} generatorConfig
 * @param {{alternativeEnergyCostPerKwh,systemCapexTry,generatorCapexTry?}} financialInputs
 * @returns {object}
 */
export function buildOffgridResults(normalDispatch, badWeatherDispatch, loadProfile, generatorConfig, financialInputs) {
  const capex = Math.max(0, Number(financialInputs.systemCapexTry) || 0);
  const genCapex = Math.max(0, Number(financialInputs.generatorCapexTry) || 0);
  const totalCapex = capex + genCapex;
  const lifecycleCostAnnual = (totalCapex / 25) + (normalDispatch.generatorFuelCostAnnual || 0);

  return {
    // Dispatch özeti
    directPvKwh: normalDispatch.directPvToLoadKwh,
    batteryKwh: normalDispatch.batteryToLoadKwh,
    generatorKwh: normalDispatch.generatorToLoadKwh,
    curtailedPvKwh: normalDispatch.curtailedPvKwh,
    unmetLoadKwh: normalDispatch.unmetLoadKwh,
    unmetCriticalKwh: normalDispatch.unmetCriticalLoadKwh,

    // Kapsama metrikleri
    totalLoadCoverage: normalDispatch.totalLoadCoverage,
    criticalLoadCoverage: normalDispatch.criticalLoadCoverage,

    // Özerklik
    autonomousDays: normalDispatch.autonomousDays,
    autonomousDaysPct: normalDispatch.autonomousDaysPct,
    cyclesPerYear: normalDispatch.cyclesPerYear,

    // Jeneratör
    generatorEnabled: !!(generatorConfig && generatorConfig.enabled && Number(generatorConfig.capacityKw) > 0),
    generatorRunHoursPerYear: normalDispatch.generatorRunHours,
    generatorFuelCostAnnual: normalDispatch.generatorFuelCostAnnual,

    // Kötü hava senaryosu
    badWeatherScenario: badWeatherDispatch || null,

    // Ekonomi
    lifecycleCostAnnual,

    // Yük profili meta
    loadMode: loadProfile.mode,
    annualTotalLoadKwh: loadProfile.annualTotalKwh,
    annualCriticalLoadKwh: loadProfile.annualCriticalKwh,
    deviceSummary: loadProfile.deviceSummary || [],

    // Dürüstlük meta
    methodologyNote: 'synthetic-dispatch-pre-feasibility',
    dispatchVersion: OFFGRID_DISPATCH_VERSION
  };
}
