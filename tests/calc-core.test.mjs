import assert from 'node:assert/strict';
import {
  buildTariffModel,
  computeFinancialTable,
  normalizeProfile,
  simulateBatteryOnHourlySummary,
  simulateHourlyEnergy
} from '../js/calc-core.js';
import { PANEL_TYPES } from '../js/data.js';

function nearly(actual, expected, tolerance = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
}

const normalized = normalizeProfile([0, 2, 2]);
nearly(normalized.reduce((a, b) => a + b, 0), 1);
nearly(normalized[1], 0.5);

const hourly = simulateHourlyEnergy(
  new Array(12).fill(100),
  new Array(12).fill(80),
  { tariffType: 'residential' }
);
nearly(hourly.annualProduction, 1200);
nearly(hourly.annualLoad, 960);
assert.ok(hourly.selfConsumption <= hourly.annualProduction);
assert.ok(hourly.gridExport >= 0);

const battery = simulateBatteryOnHourlySummary(hourly, { capacity: 10, dod: 0.9, efficiency: 0.9 });
assert.ok(battery.totalSelfConsumption >= hourly.selfConsumption);
assert.ok(battery.remainingExport <= hourly.gridExport);

const tariffModel = buildTariffModel({
  tariffType: 'residential',
  tariff: 5,
  exportTariff: 2,
  annualPriceIncrease: 0,
  discountRate: 0
});
const financial = computeFinancialTable({
  annualEnergy: 1000,
  hourlySummary: {
    annualProduction: 1000,
    annualLoad: 1000,
    selfConsumption: 800,
    gridExport: 200,
    gridImport: 200
  },
  batterySummary: null,
  totalCost: 10000,
  tariffModel,
  panel: PANEL_TYPES.mono,
  annualOMCost: 0,
  annualInsurance: 0,
  inverterLifetime: 12,
  inverterReplaceCost: 0,
  netMeteringEnabled: true,
  exportRateOverride: 2
});
assert.equal(financial.rows[0].rate, '5.00');
assert.ok(financial.projectNPV < financial.discountedCashFlow);
assert.equal(Math.round(financial.projectNPV), Math.round(financial.discountedCashFlow - 10000));
assert.equal(financial.simplePaybackYear, financial.paybackYear);
assert.ok(financial.discountedPaybackYear >= financial.simplePaybackYear || financial.discountedPaybackYear === 0);

const cappedFinancial = computeFinancialTable({
  annualEnergy: 1000,
  hourlySummary: {
    annualProduction: 1000,
    annualLoad: 200,
    selfConsumption: 100,
    gridExport: 900,
    paidGridExport: 200,
    gridImport: 100
  },
  batterySummary: null,
  totalCost: 10000,
  tariffModel,
  panel: { firstYearDeg: 0, degradation: 0 },
  annualOMCost: 0,
  annualInsurance: 0,
  inverterLifetime: 12,
  inverterReplaceCost: 0,
  netMeteringEnabled: true,
  exportRateOverride: 2
});
assert.equal(cappedFinancial.rows[0].savings, 900);

const skttTariff = buildTariffModel({
  tariffType: 'residential',
  tariffRegime: 'auto',
  annualConsumptionKwh: 4500,
  tariff: 5,
  skttTariff: 8
});
assert.equal(skttTariff.effectiveRegime, 'sktt');
assert.equal(skttTariff.importRate, 8);

const cappedExport = simulateHourlyEnergy(
  new Array(12).fill(500),
  new Array(12).fill(100),
  { tariffType: 'residential' }
);
assert.ok(cappedExport.gridExport > cappedExport.paidGridExport);
assert.ok(cappedExport.unpaidGridExport > 0);

const chronologicalBattery = simulateBatteryOnHourlySummary(cappedExport, { capacity: 5, dod: 0.9, efficiency: 0.9 });
assert.equal(chronologicalBattery.batteryExportPaid, 0);
assert.ok(chronologicalBattery.remainingExport <= cappedExport.gridExport);
assert.ok(chronologicalBattery.remainingImport <= cappedExport.gridImport);

console.log('calc-core tests passed');
