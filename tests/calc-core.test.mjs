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

console.log('calc-core tests passed');
