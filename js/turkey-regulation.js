// Turkey tariff and lisanssiz uretim regulation helpers.
// This module centralizes date-sensitive regulatory assumptions so quote output
// can expose exactly which rule set was used.
import { isEvidenceComplete } from './evidence-governance.js';

export const TURKEY_REGULATORY_VERSION = 'TR-REG-2026.04.13';

export const TURKEY_REGULATORY_SOURCES = [
  {
    id: 'epdk-sktt-2026',
    version: '2026.04-local',
    label: 'EPDK SKTT 2026 bilgilendirme',
    url: 'https://www.epdk.gov.tr/Detay/Icerik/16-38/son-kaynak-tedarik-tarifesi-sktt-ile-ilgili-bil',
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    checkedDate: '2026-04-13',
    validationStatus: 'locally-verified'
  },
  {
    id: 'epdk-lisanssiz-uretim',
    version: '2026.04-local',
    label: 'EPDK Elektrik Piyasasında Lisanssız Elektrik Üretimi',
    url: 'https://www.epdk.gov.tr/detay/icerik/3-0-0-1160/elektrik-piyasasinda-lisanssiz-elektrik-uretimi-',
    effectiveFrom: '2026-04-02',
    effectiveTo: null,
    checkedDate: '2026-04-13',
    validationStatus: 'locally-verified'
  },
  {
    id: 'rg-2026-33212',
    version: '2026.04-local',
    label: '02.04.2026 RG 33212 lisanssız üretim değişikliği',
    url: 'https://www.resmigazete.gov.tr/',
    effectiveFrom: '2026-04-02',
    effectiveTo: null,
    checkedDate: '2026-04-13',
    validationStatus: 'locally-verified'
  }
];

export const TARIFF_DATA_LIFECYCLE = {
  version: 'TR-TARIFF-SOURCE-GOV-2026.04-local',
  ingestionMode: 'source-governed-local',
  futureIngestionAdapter: 'epdk-live-ingestion-adapter',
  staleAfterDays: 45,
  sources: TURKEY_REGULATORY_SOURCES
};

export const SKTT_LIMITS_2026 = {
  residential: 4000,
  commercial: 15000,
  industrial: 15000,
  public_service: 15000,
  lighting: 15000,
  agriculture: null,
  custom: null
};

export const SETTLEMENT_CHANGE_DATE = '2026-05-01';

function finiteNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function startOfFollowingThirdMonth(exceededDate) {
  const date = new Date(`${exceededDate}T00:00:00+03:00`);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 3, 1));
}

export function determineSkttRegime(state = {}) {
  const type = state.tariffType || 'residential';
  const limit = SKTT_LIMITS_2026[type] ?? null;
  const annualConsumptionKwh = Math.max(0, finiteNumber(state.annualConsumptionKwh, finiteNumber(state.dailyConsumption) * 365));
  const previousYearConsumptionKwh = Math.max(0, finiteNumber(state.previousYearConsumptionKwh, annualConsumptionKwh));
  const currentYearConsumptionKwh = Math.max(0, finiteNumber(state.currentYearConsumptionKwh, annualConsumptionKwh));
  const tariffRegime = state.tariffRegime || 'auto';
  const hasBilateralContract = !!state.hasBilateralContract || tariffRegime === 'contract';
  const exceeded = !!limit && Math.max(annualConsumptionKwh, previousYearConsumptionKwh, currentYearConsumptionKwh) >= limit;
  const requested = tariffRegime === 'auto'
    ? (exceeded ? 'sktt' : 'pst')
    : tariffRegime;
  const effectiveRegime = hasBilateralContract ? 'contract' : requested;
  const warnings = [];

  if (!limit && tariffRegime === 'sktt') warnings.push('Bu abone grubu için SKTT limiti tanımlı değil; manuel seçim doğrulanmalı.');
  if (effectiveRegime === 'sktt' && !exceeded && limit) warnings.push('SKTT seçili ancak yıllık tüketim limiti aşmıyor.');
  if (effectiveRegime === 'contract' && !state.contractedTariff) warnings.push('Sözleşmeli tarife seçili ancak sözleşmeli birim fiyat girilmedi.');

  const activationDate = state.skttActivationDate || (state.skttExceededDate ? startOfFollowingThirdMonth(state.skttExceededDate)?.toISOString().slice(0, 10) : null);

  return {
    type,
    limitKwh: limit,
    annualConsumptionKwh,
    previousYearConsumptionKwh,
    currentYearConsumptionKwh,
    exceeded,
    hasBilateralContract,
    requestedRegime: requested,
    effectiveRegime,
    activationDate,
    warnings
  };
}

export function buildExportCompensationPolicy(state = {}) {
  const settlementMode = state.exportSettlementMode || state.netMeteringSettlement || 'auto';
  const settlementDate = state.settlementDate || new Date().toISOString().slice(0, 10);
  const interval = settlementMode === 'auto'
    ? (settlementDate >= SETTLEMENT_CHANGE_DATE ? 'hourly' : 'monthly')
    : settlementMode;
  const annualConsumptionKwh = Math.max(0, finiteNumber(state.annualConsumptionKwh, finiteNumber(state.dailyConsumption) * 365));
  const previousYearConsumptionKwh = Math.max(0, finiteNumber(state.previousYearConsumptionKwh, annualConsumptionKwh));
  const currentYearConsumptionKwh = Math.max(0, finiteNumber(state.currentYearConsumptionKwh, annualConsumptionKwh));
  const userCap = Number(state.sellableExportCapKwh);
  const hasManualCap = Number.isFinite(userCap) && userCap > 0;
  const annualSellableExportCapKwh = hasManualCap
    ? Math.max(0, userCap)
    : Math.max(annualConsumptionKwh, previousYearConsumptionKwh, currentYearConsumptionKwh);

  return {
    version: TURKEY_REGULATORY_VERSION,
    settlementMode,
    interval,
    settlementDate,
    annualSellableExportCapKwh,
    capBasis: hasManualCap ? 'manual' : 'max(current/previous/annual consumption)',
    paidBatteryExportAllowed: false,
    sources: TURKEY_REGULATORY_SOURCES,
    lifecycle: TARIFF_DATA_LIFECYCLE
  };
}

function proratePaidExport(monthly, paidTotal) {
  const exports = monthly.map(m => Math.max(0, Number(m.gridExport) || 0));
  const totalExport = exports.reduce((s, v) => s + v, 0);
  if (totalExport <= 0) return monthly.map(() => ({ paidGridExport: 0, unpaidGridExport: 0 }));
  return exports.map(v => {
    const paidGridExport = paidTotal * (v / totalExport);
    return { paidGridExport, unpaidGridExport: Math.max(0, v - paidGridExport) };
  });
}

export function applyExportCompensation(monthly, policy = {}) {
  const rows = Array.isArray(monthly) ? monthly : [];
  const interval = policy.interval || 'monthly';
  const annualCap = Number.isFinite(Number(policy.annualSellableExportCapKwh))
    ? Math.max(0, Number(policy.annualSellableExportCapKwh))
    : Infinity;

  let compensated;
  if (interval === 'hourly') {
    const totalExport = rows.reduce((s, m) => s + Math.max(0, Number(m.gridExport) || 0), 0);
    compensated = proratePaidExport(rows, Math.min(totalExport, annualCap));
  } else {
    compensated = rows.map(m => {
      const rawExport = Math.max(0, Number(m.gridExport) || 0);
      const load = Math.max(0, Number(m.load) || 0);
      const paidGridExport = Math.min(rawExport, load);
      return {
        paidGridExport,
        unpaidGridExport: Math.max(0, rawExport - paidGridExport)
      };
    });
    const paidBeforeAnnualCap = compensated.reduce((s, m) => s + m.paidGridExport, 0);
    if (paidBeforeAnnualCap > annualCap) compensated = proratePaidExport(rows, annualCap);
  }

  return {
    paidGridExport: compensated.reduce((s, m) => s + m.paidGridExport, 0),
    unpaidGridExport: compensated.reduce((s, m) => s + m.unpaidGridExport, 0),
    monthly: compensated,
    policy: {
      ...policy,
      interval,
      annualSellableExportCapKwh: Number.isFinite(annualCap) ? annualCap : null
    }
  };
}

export function buildQuoteReadiness({ state = {}, results = {}, tariffModel = null, evidenceGovernance = null } = {}) {
  const blockers = [];
  if (results.usedFallback) blockers.push('PVGIS canlı veri yok; fallback üretim quote-ready kabul edilmez.');
  if (!state.roofGeometry) blockers.push('Çatı geometrisi harita/saha çizimiyle doğrulanmadı.');
  if (!state.quoteInputsVerified) blockers.push('Teklif varsayımları yetkili kullanıcı tarafından doğrulanmadı.');
  if (!state.hasSignedCustomerBillData && !Array.isArray(state.monthlyConsumption)) blockers.push('Müşteri fatura/tüketim verisi doğrulanmadı.');
  if (!tariffModel?.regulation?.effectiveRegime) blockers.push('Tarife rejimi belirlenemedi.');
  if (tariffModel?.regulation?.warnings?.length) blockers.push(...tariffModel.regulation.warnings);
  if (!tariffModel?.exportCompensationPolicy?.sources?.length) blockers.push('İhracat mahsuplaşma kaynağı kayıtlı değil.');
  if (state.proposalApproval?.state !== 'approved') blockers.push('Proposal onay durumu approved değil.');
  if (!state.proposalApproval?.approvalRecord?.immutable) blockers.push('Immutable onay kaydı yok.');
  if (state.bomCommercials?.supplierQuoteState !== 'received') blockers.push('Tedarikçi BOM teklifi alınmadı.');
  if (state.gridApplicationChecklist) {
    const done = Object.values(state.gridApplicationChecklist).every(item => item?.done);
    if (!done) blockers.push('Şebeke başvuru kontrol listesi eksik.');
  } else {
    blockers.push('Şebeke başvuru kontrol listesi oluşturulmadı.');
  }
  if (!tariffModel?.sourceDate || !tariffModel?.sourceLabel) blockers.push('Tarife kaynak tarihi/etiketi eksik.');
  if (!isEvidenceComplete(evidenceGovernance)) {
    blockers.push(...(evidenceGovernance?.validation?.blockers || ['Kanıt yönetimi kaydı tamamlanmadı.']));
  }
  if (Array.isArray(results.calculationWarnings) && results.calculationWarnings.length) blockers.push(...results.calculationWarnings);

  return {
    status: blockers.length ? 'not-quote-ready' : 'quote-ready',
    blockers: [...new Set(blockers)],
    warnings: [...new Set(evidenceGovernance?.validation?.warnings || [])],
    version: TURKEY_REGULATORY_VERSION
  };
}
