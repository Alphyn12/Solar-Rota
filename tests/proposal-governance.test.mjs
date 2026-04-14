import assert from 'node:assert/strict';
import {
  buildApprovalWorkflow,
  buildProposalGovernance,
  calculateBomCommercials,
  calculateFinancingModel,
  createProposalRevision,
  diffProposalRevisions,
  isGridChecklistComplete
} from '../js/proposal-governance.js';

const blockedApproval = buildApprovalWorkflow(
  { proposalApproval: { state: 'approved' }, quoteInputsVerified: false },
  { score: 90 }
);
assert.equal(blockedApproval.state, 'finance-review');
assert.ok(blockedApproval.blockers.length > 0);

const zeroConsumptionApproval = buildApprovalWorkflow(
  {
    proposalApproval: { state: 'approved' },
    quoteInputsVerified: true,
    hasSignedCustomerBillData: false,
    monthlyConsumption: new Array(12).fill(0),
    userIdentity: { name: 'qa', role: 'approver' },
    evidence: {
      customerBill: { status: 'verified' },
      supplierQuote: { status: 'verified' },
      tariffSource: { status: 'verified' }
    },
    bomCommercials: { supplierQuoteState: 'received' }
  },
  { score: 90 }
);
assert.equal(zeroConsumptionApproval.state, 'finance-review');
assert.ok(zeroConsumptionApproval.blockers.some(blocker => blocker.includes('Fatura/tüketim')));

const bom = calculateBomCommercials(100000, {
  bomCommercials: { marginRate: 0.2, contingencyRate: 0.05, supplierQuoteState: 'received' }
});
assert.equal(bom.contingency, 5000);
assert.equal(bom.margin, 21000);
assert.equal(bom.proposedSellPrice, 126000);

const financing = calculateFinancingModel(100000, 40000, {
  financing: { downPayment: 20000, annualRate: 0.24, termYears: 4 }
});
assert.equal(financing.loanPrincipal, 80000);
assert.ok(financing.monthlyPayment > 0);
assert.ok(financing.firstYearDebtServiceCoverage > 0);

assert.equal(isGridChecklistComplete({ bill: { done: true } }), false);

const prev = createProposalRevision({ cityName: 'Ankara', tariffType: 'residential' }, { totalCost: 100, annualEnergy: 1000 });
const next = createProposalRevision({ cityName: 'Ankara', tariffType: 'commercial' }, { totalCost: 120, annualEnergy: 1000 }, prev);
const diff = diffProposalRevisions(prev, next);
assert.ok(diff.some(item => item.key === 'tariffType'));
assert.ok(diff.some(item => item.key === 'totalCost'));

const governance = buildProposalGovernance(
  {
    cityName: 'Ankara',
    roofGeometry: { areaM2: 100 },
    hasSignedCustomerBillData: true,
    evidence: {
      customerBill: { status: 'verified', ref: 'bill-001', checkedAt: '2026-04-10' },
      supplierQuote: { status: 'verified', ref: 'sq-001', issuedAt: '2026-04-01', validUntil: '2026-05-01' },
      tariffSource: { status: 'verified', ref: 'epdk', checkedAt: '2026-04-13' }
    },
    quoteInputsVerified: true,
    userIdentity: { name: 'qa', role: 'approver' },
    proposalApproval: { state: 'approved', approvedBy: 'qa' },
    bomCommercials: { supplierQuoteState: 'received' },
    gridApplicationChecklist: {
      bill: { done: true }, titleOrLease: { done: true }, connectionOpinion: { done: true },
      singleLine: { done: true }, staticReview: { done: true }, layout: { done: true },
      inverterDocs: { done: true }, metering: { done: true }
    }
  },
  {
    usedFallback: false,
    calculationWarnings: [],
    quoteReadiness: { status: 'quote-ready', blockers: [] },
    tariffModel: { effectiveRegime: 'pst', regulation: { warnings: [] }, exportCompensationPolicy: { sources: [{}], interval: 'hourly' } },
    costBreakdown: { subtotal: 100000 },
    totalCost: 120000,
    yearlyTable: [{ netCashFlow: 50000 }]
  }
);
assert.equal(governance.gridChecklistComplete, true);
assert.equal(governance.approval.state, 'approved');
assert.ok(governance.confidence.score >= 85);

console.log('proposal governance tests passed');
