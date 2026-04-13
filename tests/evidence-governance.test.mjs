import assert from 'node:assert/strict';
import {
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

console.log('evidence governance tests passed');
