import assert from 'node:assert/strict';
import {
  applyExportCompensation,
  buildExportCompensationPolicy,
  buildQuoteReadiness,
  determineSkttRegime
} from '../js/turkey-regulation.js';

const residentialSktt = determineSkttRegime({
  tariffType: 'residential',
  annualConsumptionKwh: 4500,
  tariffRegime: 'auto'
});
assert.equal(residentialSktt.effectiveRegime, 'sktt');
assert.equal(residentialSktt.limitKwh, 4000);

const residentialPst = determineSkttRegime({
  tariffType: 'residential',
  annualConsumptionKwh: 3500,
  tariffRegime: 'auto'
});
assert.equal(residentialPst.effectiveRegime, 'pst');

const contract = determineSkttRegime({
  tariffType: 'industrial',
  annualConsumptionKwh: 100000,
  tariffRegime: 'contract',
  hasBilateralContract: true,
  contractedTariff: 6
});
assert.equal(contract.effectiveRegime, 'contract');

const monthlyRows = [
  { gridExport: 100, load: 50 },
  { gridExport: 200, load: 500 }
];
const monthly = applyExportCompensation(monthlyRows, { interval: 'monthly', annualSellableExportCapKwh: 1000 });
assert.equal(monthly.paidGridExport, 250);
assert.equal(monthly.unpaidGridExport, 50);

const hourlyRows = new Array(8760).fill(0).map((_, idx) => ({
  month: idx < 2 ? 0 : 1,
  gridExport: idx === 0 ? 100 : idx === 1 ? 200 : 0,
  load: idx === 0 ? 50 : idx === 1 ? 500 : 0
}));
const hourly = applyExportCompensation(monthlyRows, {
  interval: 'hourly',
  annualSellableExportCapKwh: 180,
  hourlyRows
});
assert.equal(Math.round(hourly.paidGridExport), 180);
assert.equal(Math.round(hourly.unpaidGridExport), 120);
assert.equal(hourly.policy.interval, 'hourly');

const mislabeledHourly = applyExportCompensation(monthlyRows, { interval: 'hourly', annualSellableExportCapKwh: 180 });
assert.equal(mislabeledHourly.paidGridExport, 0);
assert.equal(mislabeledHourly.unpaidGridExport, 300);
assert.equal(mislabeledHourly.policy.interval, 'monthly-aggregate-no-hourly-settlement');
assert.equal(mislabeledHourly.policy.requestedInterval, 'hourly');

const policy = buildExportCompensationPolicy({
  annualConsumptionKwh: 1000,
  previousYearConsumptionKwh: 2000,
  sellableExportCapKwh: 0,
  settlementDate: '2026-05-01'
});
assert.equal(policy.interval, 'hourly');
assert.equal(policy.annualSellableExportCapKwh, 2000);

const readiness = buildQuoteReadiness({
  state: { roofGeometry: null },
  results: { usedFallback: true, calculationWarnings: [] },
  tariffModel: { regulation: { effectiveRegime: 'pst', warnings: [] }, exportCompensationPolicy: { sources: [{}] } }
});
assert.equal(readiness.status, 'not-quote-ready');
assert.ok(readiness.blockers.some(b => b.includes('PVGIS')));
assert.ok(readiness.blockers.some(b => b.includes('Proposal')));

console.log('turkey regulation tests passed');
