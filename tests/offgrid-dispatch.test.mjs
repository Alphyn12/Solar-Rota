// ═══════════════════════════════════════════════════════════
// OFFGRID DISPATCH TESTS — Solar Rota Off-Grid Level 2
// ═══════════════════════════════════════════════════════════
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildOffgridLoadProfile,
  runOffgridDispatch,
  runBadWeatherScenario,
  buildOffgridResults,
  BAD_WEATHER_PV_FACTORS,
  OFFGRID_DISPATCH_VERSION,
  DEVICE_LOAD_TEMPLATES
} from '../js/offgrid-dispatch.js';

// Yaklaşık eşitlik yardımcısı
function nearly(actual, expected, tol = 0.5, msg = '') {
  const diff = Math.abs(actual - expected);
  assert.ok(diff <= tol, `${msg || 'nearly'}: expected ${expected} ± ${tol}, got ${actual} (diff=${diff.toFixed(4)})`);
}

// ── Sabit test yardımcıları ──────────────────────────────────────────────────

function makeFlatPvHourly(annualKwh) {
  // Düz PV üretimi — tüm saatlerde eşit
  const hourly = new Array(8760).fill(annualKwh / 8760);
  return hourly;
}

function makeLoadHourly(dailyKwh) {
  // Düz yük profili
  return new Array(8760).fill(dailyKwh / 24);
}

function makeDaytimePvHourly(dailyKwh) {
  // PV sadece 08-17 saatleri arası (10 saat/gün)
  const hourlys = [];
  for (let d = 0; d < 365; d++) {
    for (let h = 0; h < 24; h++) {
      hourlys.push(h >= 8 && h < 18 ? (dailyKwh / 10) : 0);
    }
  }
  return hourlys;
}

const DEFAULT_BATTERY = {
  usableCapacityKwh: 10,
  efficiency: 0.92,
  socReserveKwh: 1.0,
  initialSocKwh: 1.0
};

const NO_GENERATOR = { enabled: false, capacityKw: 0, fuelCostPerKwh: 0 };
const WITH_GENERATOR = { enabled: true, capacityKw: 5, fuelCostPerKwh: 8 };

// ── 1. buildOffgridLoadProfile: Basit Mod ───────────────────────────────────
describe('buildOffgridLoadProfile — simple fallback', () => {
  it('boş cihaz listesiyle basit moda geçer', () => {
    const result = buildOffgridLoadProfile([], { fallbackDailyKwh: 10, criticalFraction: 0.5 });
    assert.equal(result.mode, 'simple-fallback');
    assert.equal(result.totalHourly8760.length, 8760);
    assert.equal(result.criticalHourly8760.length, 8760);
  });

  it('toplam yıllık kWh doğru', () => {
    const result = buildOffgridLoadProfile([], { fallbackDailyKwh: 12, criticalFraction: 0.6 });
    nearly(result.annualTotalKwh, 12 * 365, 1, 'annualTotalKwh');
  });

  it('kritik oranı doğru uygulanır', () => {
    const result = buildOffgridLoadProfile([], { fallbackDailyKwh: 10, criticalFraction: 0.4 });
    nearly(result.annualCriticalKwh, result.annualTotalKwh * 0.4, 0.5, 'criticalFraction');
  });

  it('saatlik toplamlar yıllık toplamla eşleşir', () => {
    const result = buildOffgridLoadProfile([], { fallbackDailyKwh: 8, criticalFraction: 0.7 });
    const sumTotal = result.totalHourly8760.reduce((a, b) => a + b, 0);
    const sumCritical = result.criticalHourly8760.reduce((a, b) => a + b, 0);
    nearly(sumTotal, result.annualTotalKwh, 0.1, 'hourly total sum');
    nearly(sumCritical, result.annualCriticalKwh, 0.1, 'hourly critical sum');
  });

  it('kritik her saat <= toplam yük', () => {
    const result = buildOffgridLoadProfile([], { fallbackDailyKwh: 10, criticalFraction: 0.6 });
    for (let i = 0; i < 8760; i++) {
      assert.ok(result.criticalHourly8760[i] <= result.totalHourly8760[i] + 1e-9,
        `saat ${i}: critical > total`);
    }
  });
});

// ── 2. buildOffgridLoadProfile: Cihaz Listesi Modu ──────────────────────────
describe('buildOffgridLoadProfile — device list', () => {
  it('cihaz listesi modunu seçer', () => {
    const devices = [{ name: 'Buzdolabı', category: 'refrigerator', powerW: 150, hoursPerDay: 8, isCritical: true }];
    const result = buildOffgridLoadProfile(devices, {});
    assert.equal(result.mode, 'device-list');
  });

  it('cihaz günlük kWh math doğruluğu', () => {
    const devices = [{ name: 'Pompa', category: 'pump', powerW: 1000, hoursPerDay: 4, isCritical: false }];
    // 1kW × 4h = 4 kWh/gün → 365 × 4 = 1460 kWh/yıl
    const result = buildOffgridLoadProfile(devices, {});
    nearly(result.annualTotalKwh, 4 * 365, 5, 'pump annual kWh');
  });

  it('kritik cihaz kritik profile girer', () => {
    const devices = [
      { name: 'Kritik', category: 'generic', powerW: 200, hoursPerDay: 6, isCritical: true },
      { name: 'Normal', category: 'generic', powerW: 200, hoursPerDay: 6, isCritical: false }
    ];
    const result = buildOffgridLoadProfile(devices, {});
    // Kritik kWh toplam kWh'ın yaklaşık yarısı olmalı
    nearly(result.annualCriticalKwh, result.annualTotalKwh / 2, 10, 'critical vs total');
  });

  it('kritik asla toplam yükten büyük olamaz', () => {
    const devices = [
      { name: 'A', category: 'lighting', powerW: 100, hoursPerDay: 8, isCritical: true },
      { name: 'B', category: 'pump', powerW: 500, hoursPerDay: 4, isCritical: false }
    ];
    const result = buildOffgridLoadProfile(devices, {});
    for (let i = 0; i < 8760; i++) {
      assert.ok(result.criticalHourly8760[i] <= result.totalHourly8760[i] + 1e-9,
        `saat ${i}: critical > total`);
    }
  });

  it('deviceSummary alanları doğru', () => {
    const devices = [{ name: 'Lamba', category: 'lighting', powerW: 60, hoursPerDay: 5, isCritical: true }];
    const result = buildOffgridLoadProfile(devices, {});
    assert.equal(result.deviceSummary.length, 1);
    assert.equal(result.deviceSummary[0].name, 'Lamba');
    assert.ok(result.deviceSummary[0].isCritical);
    nearly(result.deviceSummary[0].dailyKwh, 0.3, 0.01);
  });
});

// ── 2b. buildOffgridLoadProfile: gerçek 8760 önceliği ──────────────────────
describe('buildOffgridLoadProfile — real 8760 source priority', () => {
  it('gerçek 8760 yük varsa cihaz listesiyle karıştırmadan onu kullanır', () => {
    const hourly = Array.from({ length: 8760 }, (_, i) => (i % 24 >= 18 ? 1.2 : 0.3));
    const devices = [{ name: 'Pompa', category: 'pump', powerW: 2000, hoursPerDay: 6, isCritical: false }];
    const result = buildOffgridLoadProfile(devices, {
      hourlyLoad8760: hourly,
      hourlyLoadSource: 'hourly-uploaded',
      criticalFraction: 0.4
    });
    assert.equal(result.mode, 'hourly-8760');
    assert.equal(result.loadSource, 'hourly-uploaded');
    assert.equal(result.deviceCount, 1, 'cihazlar inventory olarak korunmalı');
    nearly(result.annualTotalKwh, hourly.reduce((a, b) => a + b, 0), 0.01, 'real 8760 sum');
    nearly(result.annualCriticalKwh, result.annualTotalKwh * 0.4, 0.01, 'critical fallback fraction');
  });
});

// ── 3. runOffgridDispatch: SOC / Rezerv Davranışı ───────────────────────────
describe('runOffgridDispatch — SOC ve rezerv', () => {
  it('SOC hiçbir zaman rezerv altına düşmez', () => {
    const pv = makeLoadHourly(0); // PV yok
    const load = makeLoadHourly(10); // Sürekli yük
    const critical = makeLoadHourly(5);
    const result = runOffgridDispatch(pv, load, critical, DEFAULT_BATTERY, NO_GENERATOR, {});
    for (const h of result.hourly8760) {
      assert.ok(h.soc >= DEFAULT_BATTERY.socReserveKwh - 1e-6,
        `SOC ${h.soc} < reserve ${DEFAULT_BATTERY.socReserveKwh}`);
    }
  });

  it('PV fazlası bataryayı doldurur, dolu batarya PV kırpar', () => {
    const smallBattery = { usableCapacityKwh: 5, efficiency: 1.0, socReserveKwh: 0.5, initialSocKwh: 4.5 };
    const pv = makeLoadHourly(50); // Çok fazla PV
    const load = makeLoadHourly(5);
    const critical = makeLoadHourly(2);
    const result = runOffgridDispatch(pv, load, critical, smallBattery, NO_GENERATOR, {});
    // Kesilen PV > 0 olmalı
    assert.ok(result.curtailedPvKwh > 0, 'curtailed PV > 0 bekleniyor');
  });

  it('PV yok, büyük batarya — unmet az olmalı', () => {
    const largeBattery = { usableCapacityKwh: 10000, efficiency: 0.95, socReserveKwh: 0, initialSocKwh: 9000 };
    const pv = makeLoadHourly(0);
    const load = makeLoadHourly(5);
    const critical = makeLoadHourly(2);
    const result = runOffgridDispatch(pv, load, critical, largeBattery, NO_GENERATOR, {});
    // Büyük batarya ile unmet çok küçük olmalı
    assert.ok(result.totalLoadCoverage > 0.9, 'büyük batarya ile yüksek kapsama bekleniyor');
  });
});

// ── 3b. runOffgridDispatch: batarya ve inverter güç limitleri ───────────────
describe('runOffgridDispatch — battery and inverter power limits', () => {
  it('kWh yeterli olsa bile maxDischargePowerKw unmet load üretir', () => {
    const largeBattery = { usableCapacityKwh: 20000, efficiency: 1.0, socReserveKwh: 0, initialSocKwh: 20000, maxDischargePowerKw: 0.5 };
    const unlimitedBattery = { ...largeBattery, maxDischargePowerKw: 10 };
    const pv = makeLoadHourly(0);
    const load = makeLoadHourly(48); // 2 kWh/h
    const critical = makeLoadHourly(24);
    const limited = runOffgridDispatch(pv, load, critical, largeBattery, NO_GENERATOR, {});
    const unlimited = runOffgridDispatch(pv, load, critical, unlimitedBattery, NO_GENERATOR, {});
    assert.ok(limited.unmetLoadKwh > unlimited.unmetLoadKwh, 'deşarj kW limiti unmet load artırmalı');
    assert.ok(limited.batteryDischargeLimitedKwh > 0, 'deşarj kW limit metriği dolmalı');
  });

  it('maxChargePowerKw PV kırpılmasını artırır', () => {
    const batterySlow = { usableCapacityKwh: 20, efficiency: 1.0, socReserveKwh: 0, initialSocKwh: 0, maxChargePowerKw: 0.2 };
    const batteryFast = { ...batterySlow, maxChargePowerKw: 20 };
    const pv = makeDaytimePvHourly(40);
    const load = makeLoadHourly(2);
    const critical = makeLoadHourly(1);
    const slow = runOffgridDispatch(pv, load, critical, batterySlow, NO_GENERATOR, {});
    const fast = runOffgridDispatch(pv, load, critical, batteryFast, NO_GENERATOR, {});
    assert.ok(slow.curtailedPvKwh > fast.curtailedPvKwh, 'şarj kW limiti curtailed PV artırmalı');
    assert.ok(slow.batteryChargeLimitedKwh > 0, 'şarj kW limit metriği dolmalı');
  });

  it('inverter AC limiti enerji yeterliyken bile kapsama düşürür', () => {
    const battery = { usableCapacityKwh: 1000, efficiency: 1.0, socReserveKwh: 0, initialSocKwh: 1000, maxDischargePowerKw: 20 };
    const pv = makeLoadHourly(240); // 10 kWh/h
    const load = makeLoadHourly(240);
    const critical = makeLoadHourly(120);
    const limited = runOffgridDispatch(pv, load, critical, battery, NO_GENERATOR, { inverterAcLimitKw: 2, inverterSurgeMultiplier: 1 });
    const unlimited = runOffgridDispatch(pv, load, critical, battery, NO_GENERATOR, {});
    assert.ok(limited.totalLoadCoverage < unlimited.totalLoadCoverage, 'inverter limiti kapsamayı düşürmeli');
    assert.ok(limited.inverterPowerLimitedLoadKwh > 0, 'inverter limit metriği dolmalı');
  });

  it('jeneratör dahil kapsama PV+BESS kapsamasından ayrı raporlanır', () => {
    const tinyBattery = { usableCapacityKwh: 1, efficiency: 0.9, socReserveKwh: 0.1, initialSocKwh: 1, maxDischargePowerKw: 1 };
    const pv = makeLoadHourly(1);
    const load = makeLoadHourly(10);
    const critical = makeLoadHourly(5);
    const result = runOffgridDispatch(pv, load, critical, tinyBattery, WITH_GENERATOR, {});
    assert.ok(result.totalLoadCoverage > result.solarBatteryLoadCoverage, 'jeneratör dahil kapsama ayrı artmalı');
    assert.ok(result.criticalLoadCoverage >= result.solarBatteryCriticalCoverage, 'kritik kapsamada jeneratör katkısı ayrı görünmeli');
  });
});

// ── 4. runOffgridDispatch: Kritik Yük Önceliği ──────────────────────────────
describe('runOffgridDispatch — kritik yük önceliği', () => {
  it('küçük batarya ile kritik kapsama > toplam kapsama', () => {
    const smallBattery = { usableCapacityKwh: 2, efficiency: 0.95, socReserveKwh: 0.2, initialSocKwh: 2 };
    const pv = makeDaytimePvHourly(5);    // Gündüz PV
    const load = makeLoadHourly(15);       // Gece dahil sürekli yük
    const critical = makeLoadHourly(3);   // Kritik = az

    const result = runOffgridDispatch(pv, load, critical, smallBattery, NO_GENERATOR, {});
    // Kritik kapsama >= toplam kapsama (kısıt varken kritik önce karşılanır)
    assert.ok(result.criticalLoadCoverage >= result.totalLoadCoverage - 1e-6,
      `critical ${result.criticalLoadCoverage.toFixed(3)} >= total ${result.totalLoadCoverage.toFixed(3)}`);
  });

  it('sıfır kritik yük ile unmetCritical = 0', () => {
    const pv = makeLoadHourly(5);
    const load = makeLoadHourly(10);
    const critical = new Array(8760).fill(0); // Kritik yük yok
    const result = runOffgridDispatch(pv, load, critical, DEFAULT_BATTERY, NO_GENERATOR, {});
    assert.equal(result.unmetCriticalLoadKwh, 0);
    assert.equal(result.criticalLoadCoverage, 1);
  });
});

// ── 5. runOffgridDispatch: Unmet Load Birikmesi ──────────────────────────────
describe('runOffgridDispatch — unmet load', () => {
  it('PV ve batarya yetersizse unmet load oluşur', () => {
    const tinyBattery = { usableCapacityKwh: 0.5, efficiency: 0.9, socReserveKwh: 0.05, initialSocKwh: 0.5 };
    const pv = makeLoadHourly(1);   // Az PV
    const load = makeLoadHourly(20); // Çok yük
    const critical = makeLoadHourly(10);
    const result = runOffgridDispatch(pv, load, critical, tinyBattery, NO_GENERATOR, {});
    assert.ok(result.unmetLoadKwh > 0, 'unmet load > 0 bekleniyor');
    assert.ok(result.totalLoadCoverage < 1, 'kapsama < 1 bekleniyor');
  });

  it('yeterli PV ile unmet = 0 ve kapsama = 1', () => {
    const pv = makeLoadHourly(50); // Çok fazla PV
    const load = makeLoadHourly(5);
    const critical = makeLoadHourly(2);
    const result = runOffgridDispatch(pv, load, critical, DEFAULT_BATTERY, NO_GENERATOR, {});
    nearly(result.unmetLoadKwh, 0, 0.01, 'unmet = 0');
    nearly(result.totalLoadCoverage, 1, 0.001, 'kapsama = 1');
  });
});

// ── 6. runOffgridDispatch: Jeneratör Desteği ────────────────────────────────
describe('runOffgridDispatch — jeneratör', () => {
  it('jeneratör ile unmet load azalır', () => {
    const tinyBattery = { usableCapacityKwh: 1, efficiency: 0.9, socReserveKwh: 0.1, initialSocKwh: 1 };
    const pv = makeLoadHourly(2);
    const load = makeLoadHourly(15);
    const critical = makeLoadHourly(7);

    const withoutGen = runOffgridDispatch(pv, load, critical, tinyBattery, NO_GENERATOR, {});
    const withGen = runOffgridDispatch(pv, load, critical, tinyBattery, WITH_GENERATOR, {});

    assert.ok(withGen.unmetLoadKwh < withoutGen.unmetLoadKwh,
      'jeneratör ile unmet < jeneratörsüz unmet');
    assert.ok(withGen.generatorToLoadKwh > 0, 'jeneratör enerji üretmeli');
    assert.ok(withGen.generatorRunHours > 0, 'jeneratör çalışma saati > 0');
    assert.ok(withGen.generatorFuelCostAnnual > 0, 'yakıt maliyeti > 0');
  });

  it('jeneratör devre dışıyken generatorToLoadKwh = 0', () => {
    const pv = makeLoadHourly(5);
    const load = makeLoadHourly(10);
    const critical = makeLoadHourly(5);
    const result = runOffgridDispatch(pv, load, critical, DEFAULT_BATTERY, NO_GENERATOR, {});
    assert.equal(result.generatorToLoadKwh, 0);
    assert.equal(result.generatorRunHours, 0);
    assert.equal(result.generatorFuelCostAnnual, 0);
  });

  it('yakıt maliyeti = çalışma kWh × birim maliyet', () => {
    const pv = makeLoadHourly(2);
    const load = makeLoadHourly(10);
    const critical = makeLoadHourly(5);
    const tinyBat = { usableCapacityKwh: 1, efficiency: 0.9, socReserveKwh: 0.1, initialSocKwh: 1 };
    const gen = { enabled: true, capacityKw: 3, fuelCostPerKwh: 10 };
    const result = runOffgridDispatch(pv, load, critical, tinyBat, gen, {});
    const expected = result.generatorToLoadKwh * 10;
    nearly(result.generatorFuelCostAnnual, expected, 0.01, 'fuel cost math');
  });
});

// ── 7. runOffgridDispatch: On-Grid Kavram Sızıntısı Yok ─────────────────────
describe('runOffgridDispatch — on-grid kavram sızıntısı yok', () => {
  it('çıktı nesnesi paidGridExport içermez', () => {
    const pv = makeLoadHourly(10);
    const load = makeLoadHourly(5);
    const critical = makeLoadHourly(2);
    const result = runOffgridDispatch(pv, load, critical, DEFAULT_BATTERY, NO_GENERATOR, {});
    assert.equal(result.paidGridExport, undefined, 'paidGridExport off-grid çıktısında olmamalı');
    assert.equal(result.gridImport, undefined, 'gridImport off-grid çıktısında olmamalı');
    assert.equal(result.netMetering, undefined, 'netMetering off-grid çıktısında olmamalı');
  });

  it('saatlik iz nesnesi gridImport içermez', () => {
    const pv = makeLoadHourly(10);
    const load = makeLoadHourly(5);
    const critical = makeLoadHourly(2);
    const result = runOffgridDispatch(pv, load, critical, DEFAULT_BATTERY, NO_GENERATOR, {});
    if (result.hourly8760.length > 0) {
      const h0 = result.hourly8760[0];
      assert.equal(h0.gridImport, undefined, 'gridImport hourly nesnesinde olmamalı');
    }
  });
});

// ── 8. runBadWeatherScenario ─────────────────────────────────────────────────
describe('runBadWeatherScenario', () => {
  it('kötü hava ile toplam kapsama düşer veya eşit kalır', () => {
    const pv = makeDaytimePvHourly(8);
    const load = makeLoadHourly(10);
    const critical = makeLoadHourly(4);
    const normal = runOffgridDispatch(pv, load, critical, DEFAULT_BATTERY, NO_GENERATOR, {});
    const bad = runBadWeatherScenario(normal, pv, load, critical, DEFAULT_BATTERY, NO_GENERATOR, 'moderate');
    assert.ok(bad.dispatch.totalLoadCoverage <= normal.totalLoadCoverage + 1e-6,
      'kötü hava kapsama <= normal kapsama');
  });

  it('hafif/orta/şiddetli PV faktörleri doğru', () => {
    assert.equal(BAD_WEATHER_PV_FACTORS.light, 0.70);
    assert.equal(BAD_WEATHER_PV_FACTORS.moderate, 0.45);
    assert.equal(BAD_WEATHER_PV_FACTORS.severe, 0.25);
  });

  it('delta metrikleri pozitif veya sıfır', () => {
    const pv = makeDaytimePvHourly(8);
    const load = makeLoadHourly(10);
    const critical = makeLoadHourly(4);
    const normal = runOffgridDispatch(pv, load, critical, DEFAULT_BATTERY, NO_GENERATOR, {});
    const bad = runBadWeatherScenario(normal, pv, load, critical, DEFAULT_BATTERY, NO_GENERATOR, 'severe');
    assert.ok(bad.criticalCoverageDropPct >= 0, 'criticalCoverageDropPct >= 0');
    assert.ok(bad.totalCoverageDropPct >= 0, 'totalCoverageDropPct >= 0');
  });

  it('weatherLevel ve pvScaleFactor çıktıda doğru', () => {
    const pv = makeLoadHourly(10);
    const load = makeLoadHourly(8);
    const critical = makeLoadHourly(3);
    const normal = runOffgridDispatch(pv, load, critical, DEFAULT_BATTERY, NO_GENERATOR, {});
    const bad = runBadWeatherScenario(normal, pv, load, critical, DEFAULT_BATTERY, NO_GENERATOR, 'light');
    assert.equal(bad.weatherLevel, 'light');
    assert.equal(bad.pvScaleFactor, 0.70);
  });
});

// ── 9. buildOffgridResults ───────────────────────────────────────────────────
describe('buildOffgridResults', () => {
  it('lifecycle maliyet formülü doğru', () => {
    const pv = makeDaytimePvHourly(10);
    const load = makeLoadHourly(8);
    const critical = makeLoadHourly(3);
    const normal = runOffgridDispatch(pv, load, critical, DEFAULT_BATTERY, NO_GENERATOR, {});
    const loadProfile = buildOffgridLoadProfile([], { fallbackDailyKwh: 8 * 365 / 365, criticalFraction: 0.375 });
    const result = buildOffgridResults(normal, null, loadProfile, { enabled: false }, {
      systemCapexTry: 100000,
      generatorCapexTry: 0,
      alternativeEnergyCostPerKwh: 17
    });
    const expected = (100000 / 25) + normal.generatorFuelCostAnnual;
    nearly(result.lifecycleCostAnnual, expected, 1, 'lifecycle cost');
  });

  it('methodologyNote ve dispatchVersion mevcut', () => {
    const pv = makeLoadHourly(10);
    const load = makeLoadHourly(8);
    const critical = makeLoadHourly(3);
    const normal = runOffgridDispatch(pv, load, critical, DEFAULT_BATTERY, NO_GENERATOR, {});
    const loadProfile = buildOffgridLoadProfile([], { fallbackDailyKwh: 8, criticalFraction: 0.375 });
    const result = buildOffgridResults(normal, null, loadProfile, { enabled: false }, { systemCapexTry: 50000, alternativeEnergyCostPerKwh: 15 });
    assert.equal(result.methodologyNote, 'synthetic-dispatch-pre-feasibility');
    assert.ok(result.dispatchVersion.startsWith('OGD-'), 'dispatchVersion başlangıcı');
    assert.equal(typeof result.pvBatteryLoadCoverage, 'number');
    assert.equal(typeof result.minimumSoc, 'number');
  });

  it('badWeatherScenario null olabilir', () => {
    const pv = makeLoadHourly(10);
    const load = makeLoadHourly(8);
    const critical = makeLoadHourly(3);
    const normal = runOffgridDispatch(pv, load, critical, DEFAULT_BATTERY, NO_GENERATOR, {});
    const loadProfile = buildOffgridLoadProfile([], { fallbackDailyKwh: 8, criticalFraction: 0.4 });
    const result = buildOffgridResults(normal, null, loadProfile, { enabled: false }, { systemCapexTry: 50000, alternativeEnergyCostPerKwh: 15 });
    assert.equal(result.badWeatherScenario, null);
  });
});

// ── 10. Enerji Korunumu ───────────────────────────────────────────────────────
describe('runOffgridDispatch — enerji korunumu', () => {
  it('directPv + battery + gen + unmet = total load (tolerans ile)', () => {
    const pv = makeDaytimePvHourly(10);
    const load = makeLoadHourly(10);
    const critical = makeLoadHourly(4);
    const result = runOffgridDispatch(pv, load, critical, DEFAULT_BATTERY, WITH_GENERATOR, {});

    const annualLoad = load.reduce((a, b) => a + b, 0);
    const totalServed = result.directPvToLoadKwh + result.batteryToLoadKwh + result.generatorToLoadKwh;
    const accountedFor = totalServed + result.unmetLoadKwh;

    nearly(accountedFor, annualLoad, 5, 'enerji korunumu: served + unmet = load');
  });

  it('PV = directPV + chargedFromPv + curtailed (tolerans ile)', () => {
    const pv = makeDaytimePvHourly(12);
    const load = makeLoadHourly(6);
    const critical = makeLoadHourly(2);
    const result = runOffgridDispatch(pv, load, critical, DEFAULT_BATTERY, NO_GENERATOR, {});

    const totalPv = pv.reduce((a, b) => a + b, 0);
    const pvAccount = result.directPvToLoadKwh + result.chargedFromPvKwh + result.curtailedPvKwh;
    // chargedFromPv ve curtailed kayıpları içerebilir (verim kayıpları nedeniyle)
    nearly(pvAccount, totalPv, totalPv * 0.1, 'PV balance: direct + charged + curtailed ≈ total');
  });
});

// ── 11. OFFGRID_DISPATCH_VERSION sabit ───────────────────────────────────────
describe('sabitler', () => {
  it('OFFGRID_DISPATCH_VERSION tanımlı ve string', () => {
    assert.equal(typeof OFFGRID_DISPATCH_VERSION, 'string');
    assert.ok(OFFGRID_DISPATCH_VERSION.length > 0);
  });

  it('DEVICE_LOAD_TEMPLATES 5 kategori içerir', () => {
    const keys = Object.keys(DEVICE_LOAD_TEMPLATES);
    assert.ok(keys.includes('lighting'));
    assert.ok(keys.includes('refrigerator'));
    assert.ok(keys.includes('pump'));
    assert.ok(keys.includes('entertainment'));
    assert.ok(keys.includes('generic'));
  });

  it('her şablon 24 eleman içerir', () => {
    for (const [cat, tpl] of Object.entries(DEVICE_LOAD_TEMPLATES)) {
      assert.equal(tpl.length, 24, `${cat} şablonu 24 saat olmalı`);
    }
  });
});
