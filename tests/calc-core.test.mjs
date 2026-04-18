import assert from 'node:assert/strict';
import {
  buildBaseHourlyLoad8760,
  buildTariffModel,
  calculateSystemLayout,
  computeFinancialTable,
  getLoadProfile,
  normalizeMonthlyProductionToAnnual,
  normalizeProfile,
  resolveProductionTemperatureAdjustment,
  resolveTaxTreatment,
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

const daytimeProfile = getLoadProfile('daytime-heavy');
const eveningProfile = getLoadProfile('evening-heavy');
const businessProfile = getLoadProfile('business-hours');
nearly(daytimeProfile.reduce((sum, value) => sum + value, 0), 1);
assert.ok(daytimeProfile.slice(9, 16).reduce((sum, value) => sum + value, 0)
  > eveningProfile.slice(9, 16).reduce((sum, value) => sum + value, 0));
assert.ok(eveningProfile.slice(17, 23).reduce((sum, value) => sum + value, 0)
  > daytimeProfile.slice(17, 23).reduce((sum, value) => sum + value, 0));
assert.ok(businessProfile.slice(8, 17).reduce((sum, value) => sum + value, 0) > 0.75);

const daytimeLoad8760 = buildBaseHourlyLoad8760(new Array(12).fill(310), 'residential', 'daytime-heavy');
const eveningLoad8760 = buildBaseHourlyLoad8760(new Array(12).fill(310), 'residential', 'evening-heavy');
nearly(daytimeLoad8760.reduce((sum, value) => sum + value, 0), 3720);
assert.ok(daytimeLoad8760.slice(10, 15).reduce((sum, value) => sum + value, 0)
  > eveningLoad8760.slice(10, 15).reduce((sum, value) => sum + value, 0));

const normalizedMonthlyProduction = normalizeMonthlyProductionToAnnual(new Array(12).fill(100), 1234);
assert.equal(normalizedMonthlyProduction.reduce((sum, value) => sum + value, 0), 1234);
assert.equal(normalizedMonthlyProduction.length, 12);

const pvgisTemperatureAdjustment = resolveProductionTemperatureAdjustment({
  source: 'pvgis-live',
  panelTempCoeff: -0.0037,
  avgSummerTemp: 38
});
assert.equal(pvgisTemperatureAdjustment.factor, 1);
assert.equal(pvgisTemperatureAdjustment.applied, false);
assert.equal(pvgisTemperatureAdjustment.lossRate, 0);

const fallbackTemperatureAdjustment = resolveProductionTemperatureAdjustment({
  source: 'fallback-psh',
  panelTempCoeff: -0.0037,
  avgSummerTemp: 38
});
assert.ok(fallbackTemperatureAdjustment.applied);
nearly(fallbackTemperatureAdjustment.factor, 1 + (-0.0037 * 13));
assert.ok(fallbackTemperatureAdjustment.factor < 1);

const hourly = simulateHourlyEnergy(
  new Array(12).fill(100),
  new Array(12).fill(80),
  { tariffType: 'residential' }
);
nearly(hourly.annualProduction, 1200);
nearly(hourly.annualLoad, 960);
assert.ok(hourly.selfConsumption <= hourly.annualProduction);
assert.ok(hourly.gridExport >= 0);
assert.equal(hourly.exportPolicy.interval, 'monthly');

const daytimeHourly = simulateHourlyEnergy(
  new Array(12).fill(300),
  new Array(12).fill(300),
  { tariffType: 'residential', loadProfileKey: 'daytime-heavy' }
);
const eveningHourly = simulateHourlyEnergy(
  new Array(12).fill(300),
  new Array(12).fill(300),
  { tariffType: 'residential', loadProfileKey: 'evening-heavy' }
);
assert.ok(daytimeHourly.selfConsumption > eveningHourly.selfConsumption);

const fillRoofLayout = calculateSystemLayout({
  scenarioKey: 'on-grid',
  designTarget: 'fill-roof',
  panelType: 'mono',
  roofArea: 100,
  tilt: 30,
  azimuth: 180,
  usableRoofRatio: 0.75,
  annualConsumptionKwh: 1000,
  ghi: 1600
}, 'mono');
const billTargetLayout = calculateSystemLayout({
  scenarioKey: 'on-grid',
  designTarget: 'bill-offset',
  panelType: 'mono',
  roofArea: 100,
  tilt: 30,
  azimuth: 180,
  usableRoofRatio: 0.75,
  annualConsumptionKwh: 1000,
  ghi: 1600
}, 'mono');
assert.ok(billTargetLayout.panelCount < fillRoofLayout.panelCount);
assert.equal(billTargetLayout.designTargetApplied, 'bill-offset');

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

const offGridRate = 19.5;
const offGridTariffModel = { ...tariffModel, importRate: offGridRate, exportRate: 0, annualPriceIncrease: 0 };
const offGridFinancial = computeFinancialTable({
  annualEnergy: 1000,
  hourlySummary: {
    annualProduction: 1000,
    annualLoad: 1000,
    selfConsumption: 800,
    gridExport: 200,
    paidGridExport: 200,
    gridImport: 200
  },
  batterySummary: null,
  totalCost: 10000,
  tariffModel: offGridTariffModel,
  panel: { firstYearDeg: 0, degradation: 0 },
  annualOMCost: 0,
  annualInsurance: 0,
  inverterLifetime: 12,
  inverterReplaceCost: 0,
  netMeteringEnabled: false,
  exportRateOverride: 0
});
assert.equal(offGridFinancial.rows[0].savings, Math.round(800 * offGridRate));
assert.equal(offGridFinancial.rows[0].paidExportKwh, 0);

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

const recoverableVatTreatment = resolveTaxTreatment({
  grossTotalCost: 120000,
  solarKdv: 20000,
  taxEnabled: true,
  tax: { kdvRecovery: true }
});
assert.equal(recoverableVatTreatment.recoverableKdv, 20000);
assert.equal(recoverableVatTreatment.financialCostBasis, 100000);
assert.equal(recoverableVatTreatment.vatTreatment, 'recoverable-kdv-excluded-from-financial-cost-basis');

const noVatRecoveryTreatment = resolveTaxTreatment({
  grossTotalCost: 120000,
  solarKdv: 20000,
  taxEnabled: true,
  tax: { kdvRecovery: false }
});
assert.equal(noVatRecoveryTreatment.recoverableKdv, 0);
assert.equal(noVatRecoveryTreatment.financialCostBasis, 120000);

// --- Tariff Input Mode / Distribution Fee Tests ---

// net-plus-fee mode: buildTariffModel uses s.tariff which app.js already adds fee to
// We test buildTariffModel directly: tariffInputMode and distributionFee are passed through
const tariffNetPlusFee = buildTariffModel({
  tariffType: 'residential',
  tariff: 6.0,           // 5.0 base + 1.0 fee, pre-summed by app.js
  distributionFee: 1.0,
  tariffInputMode: 'net-plus-fee',
  annualPriceIncrease: 0,
  discountRate: 0
});
assert.equal(tariffNetPlusFee.tariffInputMode, 'net-plus-fee');
assert.equal(tariffNetPlusFee.distributionFee, 1.0);
// importRate should be 6.0 (base + fee already in tariff)
assert.equal(tariffNetPlusFee.importRate, 6.0);

// gross mode: distributionFee should be zeroed out in model (app.js does not add fee)
const tariffGross = buildTariffModel({
  tariffType: 'residential',
  tariff: 6.0,           // gross tariff — no fee to add
  distributionFee: 1.0,
  tariffInputMode: 'gross',
  annualPriceIncrease: 0,
  discountRate: 0
});
assert.equal(tariffGross.tariffInputMode, 'gross');
assert.equal(tariffGross.distributionFee, 0, 'gross mode: distributionFee in model must be 0');
// importRate is still what was passed as tariff (app.js sends 6.0 without adding fee in gross mode)
assert.equal(tariffGross.importRate, 6.0);

// Verify distribution fee does NOT leak to export rate
assert.equal(tariffNetPlusFee.exportRate, 0);
assert.equal(tariffGross.exportRate, 0);

// tariffSourceType is passed through
const tariffOfficial = buildTariffModel({ tariff: 5, tariffSourceType: 'official', annualPriceIncrease: 0, discountRate: 0 });
assert.equal(tariffOfficial.tariffSourceType, 'official');
const tariffManual = buildTariffModel({ tariff: 5, tariffSourceType: 'manual', annualPriceIncrease: 0, discountRate: 0 });
assert.equal(tariffManual.tariffSourceType, 'manual');

// --- Hourly profile source test ---
// simulateHourlyEnergy uses real hourly data when provided
const syntheticMonthly = new Array(12).fill(500);
const syntheticLoad = new Array(12).fill(310);
const syntheticResult = simulateHourlyEnergy(syntheticMonthly, syntheticLoad, {});
assert.equal(syntheticResult.hourly8760.length, 8760);

// With real hourly data the annual load should match the provided data exactly
const fakeHourly8760 = new Array(8760).fill(1.0); // 1 kWh/h = 8760 kWh/year
const realProfileResult = simulateHourlyEnergy(syntheticMonthly, syntheticLoad, { hourlyLoad8760: fakeHourly8760 });
assert.ok(Math.abs(realProfileResult.annualLoad - 8760) < 1, 'Real hourly profile annual load should equal sum of provided data');

console.log('calc-core tests passed');
