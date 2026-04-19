import assert from 'node:assert/strict';
import {
  buildOffgridFieldEvidenceGate,
  buildEvidenceRegistry,
  buildStructuredProposalExport,
  buildTariffSourceGovernance,
  isEvidenceExpired,
  isEvidenceFresh,
  validateEvidenceRegistry
} from '../js/evidence-governance.js';

assert.equal(isEvidenceFresh({ checkedAt: '2026-04-01' }, { today: '2026-04-13', maxAgeDays: 45 }), true);
assert.equal(isEvidenceFresh({ checkedAt: '2026-01-01' }, { today: '2026-04-13', maxAgeDays: 45 }), false);
assert.equal(isEvidenceExpired({ validUntil: '2026-04-01' }, { today: '2026-04-13' }), true);

const emptyMonthlyRegistry = buildEvidenceRegistry(
  { hasSignedCustomerBillData: false, monthlyConsumption: new Array(12).fill(0), evidence: {} },
  {},
  { today: '2026-04-13' }
);
assert.equal(emptyMonthlyRegistry.registry.customerBill.status, 'missing');

const registry = buildEvidenceRegistry(
  {
    hasSignedCustomerBillData: true,
    evidence: {
      customerBill: { status: 'verified', ref: 'bill-001', checkedAt: '2026-04-10', files: [{ id: 'bill-file', name: 'bill.pdf', size: 10, sha256: 'a'.repeat(64), validationStatus: 'validated' }] },
      supplierQuote: { status: 'verified', ref: 'sq-001', issuedAt: '2026-04-01', validUntil: '2026-05-01', files: [{ id: 'sq-file', name: 'sq.pdf', size: 10, sha256: 'b'.repeat(64), validationStatus: 'validated' }] },
      tariffSource: { status: 'verified', ref: 'epdk', checkedAt: '2026-04-13', sourceUrl: 'https://epdk.gov.tr' },
      gridApplication: { status: 'verified', ref: 'grid', checkedAt: '2026-04-12' }
    },
    bomCommercials: { supplierQuoteState: 'received', supplierQuoteRef: 'sq-001', supplierQuoteDate: '2026-04-01', supplierQuoteValidUntil: '2026-05-01' },
    gridApplicationChecklist: {
      bill: { done: true, evidence: 'x' },
      titleOrLease: { done: true, evidence: 'x' },
      connectionOpinion: { done: true, evidence: 'x' },
      singleLine: { done: true, evidence: 'x' },
      staticReview: { done: true, evidence: 'x' },
      layout: { done: true, evidence: 'x' },
      inverterDocs: { done: true, evidence: 'x' },
      metering: { done: true, evidence: 'x' }
    }
  },
  {
    tariffModel: {
      sourceDate: '2026-04-12',
      sourceLabel: 'EPDK local',
      exportCompensationPolicy: {
        version: 'TR-REG',
        sources: [{ label: 'EPDK', checkedDate: '2026-04-13', url: 'https://epdk.gov.tr' }]
      }
    }
  }
);
assert.equal(registry.validation.status, 'complete');

const stale = buildTariffSourceGovernance(
  { sourceDate: '2026-01-01', sourceLabel: 'old' },
  { registry: { tariffSource: { checkedAt: '2026-01-01', sourceLabel: 'old' } } },
  { today: '2026-04-13' }
);
assert.equal(stale.stale, true);

const invalid = validateEvidenceRegistry({
  customerBill: { status: 'missing' },
  supplierQuote: { status: 'verified', validUntil: '2026-04-01' },
  tariffSource: { status: 'verified', checkedAt: '2026-01-01' },
  regulationSource: { status: 'verified', checkedAt: '2026-04-01' },
  gridApplication: { status: 'missing' }
});
assert.equal(invalid.status, 'incomplete');
assert.ok(invalid.blockers.length >= 3);

const offgridEvidenceBlocked = buildOffgridFieldEvidenceGate(
  { registry: {} },
  {
    offgridL2Results: {
      fieldGuaranteeReadiness: { status: 'blocked', phase1Ready: false },
      productionDispatchMetadata: { hasRealHourlyProduction: false },
      loadMode: 'device-list',
      synthetic: true
    }
  },
  { today: '2026-04-13' }
);
assert.equal(offgridEvidenceBlocked.phase2Ready, false);
assert.ok(offgridEvidenceBlocked.blockers.some(item => item.includes('offgridPvProduction')));

const evidenceFile = (id, sha) => ({ id, name: `${id}.csv`, size: 100, sha256: sha.repeat(64).slice(0, 64), validationStatus: 'validated' });
const verifiedOffgridEvidence = {
  offgridPvProduction: { status: 'verified', ref: 'pv.csv', checkedAt: '2026-04-12', files: [evidenceFile('pv', 'a')] },
  offgridLoadProfile: { status: 'verified', ref: 'load.csv', checkedAt: '2026-04-12', files: [evidenceFile('load', 'b')] },
  offgridCriticalLoadProfile: { status: 'verified', ref: 'critical.csv', checkedAt: '2026-04-12', files: [evidenceFile('critical', 'c')] },
  offgridSiteShading: { status: 'verified', ref: 'shade.pdf', checkedAt: '2026-04-12', files: [evidenceFile('shade', 'd')] },
  offgridEquipmentDatasheets: { status: 'verified', ref: 'datasheets.pdf', checkedAt: '2026-04-12', files: [evidenceFile('datasheets', 'e')] }
};
const offgridRegistry = buildEvidenceRegistry(
  {
    scenarioKey: 'off-grid',
    hourlyConsumption8760: new Array(8760).fill(1),
    offgridPvHourly8760: new Array(8760).fill(0.5),
    offgridCriticalLoad8760: new Array(8760).fill(0.3),
    shadingQuality: 'site-verified',
    evidence: verifiedOffgridEvidence
  },
  {
    offgridL2Results: {
      fieldGuaranteeReadiness: { status: 'phase1-ready', phase1Ready: true },
      productionDispatchMetadata: { hasRealHourlyProduction: true },
      loadMode: 'hourly-8760',
      synthetic: false
    }
  },
  { today: '2026-04-13' }
);
const offgridEvidenceReady = buildOffgridFieldEvidenceGate(
  offgridRegistry,
  {
    offgridL2Results: {
      fieldGuaranteeReadiness: { status: 'phase1-ready', phase1Ready: true },
      productionDispatchMetadata: { hasRealHourlyProduction: true },
      loadMode: 'hourly-8760',
      synthetic: false
    }
  },
  { today: '2026-04-13' }
);
assert.equal(offgridEvidenceReady.phase2Ready, true);
assert.equal(offgridEvidenceReady.fieldGuaranteeReady, false);

const exported = buildStructuredProposalExport(
  { cityName: 'Ankara', tariffType: 'commercial', panelType: 'mono', inverterType: 'string' },
  {
    systemPower: 10,
    annualEnergy: 15000,
    totalCost: 1000000,
    quoteReadiness: { blockers: ['x'] },
    proposalGovernance: { confidence: { score: 70, level: 'engineering estimate' }, approval: { state: 'finance-review' } },
    tariffModel: { effectiveRegime: 'sktt', importRate: 8, exportRate: 2, sourceDate: '2026-04-12', sourceLabel: 'EPDK' }
  }
);
assert.equal(exported.schema, 'guneshesap.proposal-handoff.v2');
assert.equal(exported.customer.cityName, 'Ankara');
assert.equal(exported.commercial.confidenceScore, 70);
assert.ok(exported.financialSummary);

const offgridExported = buildStructuredProposalExport(
  { scenarioKey: 'off-grid', cityName: 'Ankara' },
  {
    offgridL2Results: {
      productionDispatchProfile: 'monthly-production-derived-synthetic-8760',
      productionDispatchMetadata: { hasRealHourlyProduction: false, synthetic: true },
      loadMode: 'device-list',
      dispatchType: 'synthetic-8760-dispatch',
      generatorEnabled: true,
      autonomousDays: 120,
      autonomousDaysPct: 32.9,
      autonomousDaysWithGenerator: 360,
      autonomousDaysWithGeneratorPct: 98.6,
      badWeatherScenario: {
        weatherLevel: 'moderate',
        criticalCoverageDropPct: 12.5,
        totalCoverageDropPct: 18.2,
        additionalGeneratorKwh: 240,
        windowCoverage: 0.72,
        windowCriticalCoverage: 0.91,
        worstWindowDayOfYear: 15
      },
      fieldGuaranteeReadiness: { status: 'blocked', phase1Ready: false, fieldGuaranteeReady: false, blockers: ['missing real PV'] },
      fieldEvidenceGate: { status: 'blocked', phase2Ready: false, fieldGuaranteeReady: false, blockers: ['missing evidence'] },
      fieldGuaranteeCandidate: false,
      fieldGuaranteeReady: false
    },
    proposalGovernance: { confidence: { score: 50 } },
    tariffModel: {}
  }
);
assert.equal(offgridExported.offGridL2.productionDispatchProfile, 'monthly-production-derived-synthetic-8760');
assert.equal(offgridExported.offGridL2.productionDispatchMetadata.synthetic, true);
assert.equal(offgridExported.offGridL2.autonomousDays, 120);
assert.equal(offgridExported.offGridL2.autonomousDaysWithGenerator, 360);
assert.equal(offgridExported.offGridL2.badWeatherCriticalCoverageDropPct, 12.5);
assert.equal(offgridExported.offGridL2.badWeatherAdditionalGeneratorKwh, 240);
assert.equal(offgridExported.offGridL2.fieldGuaranteeReadiness.status, 'blocked');
assert.equal(offgridExported.offGridL2.fieldEvidenceGate.status, 'blocked');
assert.equal(offgridExported.offGridL2.fieldGuaranteeReady, false);

console.log('evidence governance tests passed');
