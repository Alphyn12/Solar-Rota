import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { i18n } from '../js/i18n.js';

async function setLocale(lang) {
  i18n.locale = lang;
  i18n.translations = JSON.parse(await readFile(new URL(`../locales/${lang}.json`, import.meta.url), 'utf8'));
}

const reportBody = {
  innerHTML: '',
  innerText: '',
  classList: { contains: () => false, toggle: () => {}, remove: () => {} }
};

globalThis.document = {
  getElementById: id => id === 'eng-report-body' ? reportBody : null,
  querySelectorAll: () => [],
  querySelector: () => null,
  documentElement: { lang: 'tr' }
};
globalThis.window = {
  state: {},
  showToast: () => {},
  renderExchangeRateStatus: () => {}
};

const { renderEngReport } = await import('../js/eng-report.js');
const { buildStructuredProposalExport } = await import('../js/evidence-governance.js');
const { buildCrmLeadExport } = await import('../js/crm-export.js');
const { downloadPDF, downloadTechnicalPDF } = await import('../js/ui-render.js');

function yearlyTable() {
  return Array.from({ length: 25 }, (_, index) => ({
    year: index + 1,
    energy: 15000 - index * 40,
    rate: 3.5 + index * 0.1,
    savings: 50000 + index * 1000,
    expenses: 1500,
    netCashFlow: 48500 + index * 1000,
    cumulative: -350000 + index * 48500,
    npv: 45000 + index * 500
  }));
}

function sampleState() {
  return {
    cityName: 'Ankara',
    lat: 39.93,
    lon: 32.85,
    ghi: 1680,
    panelType: 'mono',
    inverterType: 'string',
    roofArea: 120,
    azimuth: 180,
    azimuthName: 'South',
    azimuthCoeff: 1,
    tilt: 30,
    shadingFactor: 8,
    soilingFactor: 3,
    dailyConsumption: 45,
    displayCurrency: 'TRY',
    usdToTry: 40,
    tariffType: 'commercial',
    netMeteringEnabled: true,
    omRate: 1,
    insuranceRate: 0.5,
    auditLog: [],
    scenarioKey: 'on-grid',
    scenarioContext: {
      label: 'On-Grid',
      nextAction: 'Validate evidence before approval.',
      resultFrame: 'Grid-connected savings and proposal readiness'
    },
    results: {
      annualEnergy: 15000,
      pvgisRawEnergy: 17000,
      pvgisPoa: 1800,
      systemPower: 10,
      panelCount: 24,
      inverterType: 'string',
      inverterEfficiency: 97,
      pvgisLossParam: 0,
      usedFallback: false,
      shadingLoss: 900,
      tempLossEnergy: 0,
      azimuthLossEnergy: 0,
      bifacialGainEnergy: 0,
      soilingLoss: 500,
      cableLossPct: 1.2,
      cableLoss: 180,
      effectiveShadingFactor: 8,
      pr: 82,
      psh: 4.4,
      ysp: 1500,
      cf: 17,
      irr: 14,
      lcoe: 2.1,
      tariff: 3.6,
      totalCost: 350000,
      annualSavings: 54000,
      simplePaybackYear: 6.4,
      discountedPaybackYear: 8.2,
      npvTotal: 220000,
      roi: 160,
      co2Savings: '7.5',
      annualOMCost: 3500,
      annualInsurance: 1200,
      totalExpenses25y: 140000,
      inverterReplaceCost: 40000,
      inverterLifetime: 12,
      discountRate: 0.12,
      annualPriceIncrease: 0.25,
      expenseEscalationRate: 0.15,
      lidFactor: 2,
      paybackYear: 7,
      methodologyVersion: 'GH-CALC-2026.04',
      calculationMode: 'backend-pvlib',
      confidenceLevel: 'high',
      sourceQualityNote: 'validated',
      authoritativeEngineMode: 'backend',
      authoritativeEngineFallbackReason: 'PVGIS canlı veri yok; fallback üretim quote-ready kabul edilmez.',
      authoritativeEngineSource: {
        provider: 'backend',
        source: 'pvlib',
        pvlibBacked: true,
        engineQuality: 'high'
      },
      authoritativeProduction: {
        annualEnergyKwh: 15000,
        monthlyEnergyKwh: yearlyTable().slice(0, 12).map((_, index) => 1250 + index),
        systemPowerKwp: 10,
        panelCount: 24,
        source: 'pvlib'
      },
      engineParity: {
        authoritativeSource: 'pvlib',
        comparisonSource: 'browser-pvgis',
        localAnnualEnergyKwh: 14500,
        authoritativeAnnualEnergyKwh: 15000,
        deltaKwh: 500,
        deltaPct: 3.45,
        intentionalDifference: true
      },
      costBreakdown: {
        panel: 86000,
        inverter: 50000,
        mounting: 22000,
        dcCable: 6000,
        acElec: 9000,
        labor: 18000,
        permits: 10000,
        subtotal: 201000,
        kdv: 40200,
        kdvRate: 0.2,
        total: 241200,
        invUnit: 5000
      },
      yearlyTable: yearlyTable(),
      tariffModel: {
        type: 'commercial',
        effectiveRegime: 'PST',
        importRate: 3.6,
        exportRate: 1.2,
        sourceDate: '2026-01-01',
        sourceLabel: 'Tariff source',
        exportCompensationPolicy: { version: 'TR-REG-2026.04' }
      },
      hourlySummary: { annualLoad: 16425 },
      nmMetrics: {
        selfConsumedEnergy: 12000,
        paidGridExport: 1500,
        annualGridExport: 3000,
        annualExportRevenue: 1800,
        selfConsumptionPct: 80,
        unpaidGridExport: 1500,
        systemType: 'monthly-aggregation'
      },
      proposalGovernance: {
        confidence: { score: 62, level: 'medium' },
        approval: {
          state: 'draft',
          blockers: ['Proposal ticari temeli değişti; mevcut onay geçersiz, yeni revizyon/onay gerekli.']
        },
        gridChecklistComplete: false,
        financing: {},
        maintenance: {},
        revision: { id: 'rev-1', diff: [] },
        ledger: { entries: [] }
      },
      quoteReadiness: {
        status: 'not-quote-ready',
        version: 'TR-REG-2026.04',
        blockers: ['PVGIS canlı veri yok; fallback üretim quote-ready kabul edilmez.']
      },
      evidenceGovernance: {
        registry: {},
        validation: {
          status: 'incomplete',
          blockers: ['supplierQuote: doğrulanmış kanıt yok.'],
          warnings: ['supplierQuote: geçerlilik tarihi yok; marj ve satış fiyatı riskli.']
        }
      },
      tariffSourceGovernance: {
        sourceLabel: 'Tariff source',
        ageDays: 50,
        stale: true,
        warning: 'Tarife kaynak kontrol tarihi 45 günden eski veya eksik.'
      }
    }
  };
}

await setLocale('en');
assert.equal(i18n.t('finance.simplePayback'), 'Cumulative Net Payback Period');
assert.equal(i18n.t('report.simplePayback'), 'Cumulative Net Payback');
assert.doesNotMatch(i18n.t('finance.simplePayback'), /Simple Payback/);
window.state = sampleState();
renderEngReport();
assert.match(reportBody.innerHTML, /Panel and System Design/);
assert.match(reportBody.innerHTML, /Panel area = width/);
assert.match(reportBody.innerHTML, /Inverter AC output efficiency/);
assert.match(reportBody.innerHTML, /The 75% usable-area factor/);
assert.match(reportBody.innerHTML, /Cost Breakdown/);
assert.match(reportBody.innerHTML, /PVGIS live data is unavailable/);
assert.doesNotMatch(reportBody.innerHTML, /Panel &amp; Sistem Tasarımı/);
assert.doesNotMatch(reportBody.innerHTML, /Maliyet Kırılımı/);
assert.doesNotMatch(reportBody.innerHTML, /Kullanılabilir çatı alanı/);
assert.doesNotMatch(reportBody.innerHTML, /İnverter AC çıkış verimi/);

const offGridState = sampleState();
offGridState.scenarioKey = 'off-grid';
offGridState.netMeteringEnabled = false;
offGridState.battery = { capacity: 9.6, dod: 0.9 };
offGridState.scenarioContext = {
  label: 'Off-Grid',
  nextAction: 'Validate autonomy with field evidence.',
  resultFrame: 'Off-grid pre-feasibility sizing'
};
offGridState.results = {
  ...offGridState.results,
  financialSavingsRate: 19.5,
  financialSavingsBasis: 'off-grid-user-alternative-energy-cost',
  tariffModel: { ...offGridState.results.tariffModel, exportRate: 1.2 },
  nmMetrics: { ...offGridState.results.nmMetrics, paidGridExport: 0, annualExportRevenue: 0 },
  bessMetrics: {
    modelName: 'LFP',
    dailyProduction: 41.1,
    usableCapacity: 8.6,
    gridIndependence: '78.0',
    nightCoverage: '62.0',
    batteryCost: 120000
  }
};
window.state = offGridState;
renderEngReport();
assert.match(reportBody.innerHTML, /PV-served load share \(synthetic dispatch\)/);
assert.match(reportBody.innerHTML, /surplus PV is not monetized/);
assert.match(reportBody.innerHTML, /synthetic 8760 dispatch pre-check/);
assert.doesNotMatch(reportBody.innerHTML, /Grid Export \/ Settlement/);
assert.doesNotMatch(reportBody.innerHTML, /Annual export/);

const proposalEn = buildStructuredProposalExport(window.state, window.state.results);
assert.equal(proposalEn.display.language, 'en');
assert.equal(proposalEn.display.productName, 'Solar Rota');
assert.equal(proposalEn.display.title, 'Proposal handoff summary');
assert.match(proposalEn.display.blockers.join(' '), /PVGIS live data is unavailable/);
assert.match(proposalEn.display.approvalBlockers.join(' '), /commercial basis changed/);
assert.match(proposalEn.display.evidenceBlockers.join(' '), /Supplier quote: no verified evidence/);
assert.doesNotMatch(proposalEn.display.evidenceBlockers.join(' '), /supplierQuote/);
assert.deepEqual(proposalEn.blockers, window.state.results.quoteReadiness.blockers);
assert.equal(proposalEn.system.authoritativeProduction.annualEnergyKwh, 15000);
assert.equal(proposalEn.system.productionParity.deltaKwh, 500);
assert.equal(proposalEn.tariff.exportRate, 0);
assert.equal(proposalEn.financialSummary.financialSavingsBasis, 'off-grid-user-alternative-energy-cost');

const crmEn = buildCrmLeadExport(window.state, window.state.results);
assert.equal(crmEn.display.language, 'en');
assert.equal(crmEn.display.productName, 'Solar Rota');
assert.equal(crmEn.display.quoteReadiness, 'Not quote-ready');
assert.match(crmEn.display.blockers.join(' '), /PVGIS live data is unavailable/);
assert.deepEqual(crmEn.qualification.blockers, window.state.results.quoteReadiness.blockers);

const pdfText = [];
class FakePdf {
  setFillColor() {}
  rect() {}
  setTextColor() {}
  setFontSize() {}
  setFont() {}
  text(value) { pdfText.push(Array.isArray(value) ? value.join(' ') : String(value)); }
  setDrawColor() {}
  setLineWidth() {}
  line() {}
  addPage() {}
  save(value) { pdfText.push(`save:${value}`); }
}
window.jspdf = { jsPDF: FakePdf };
window.showToast = message => pdfText.push(`toast:${message}`);
downloadPDF();
assert.ok(pdfText.some(value => value.includes('Turkey Solar Energy and Investment Report')));
assert.ok(pdfText.some(value => value.includes('System Design')));
assert.ok(!pdfText.some(value => value.includes('Türkiye Güneş Paneli Enerji ve Yatırım Raporu')));

pdfText.length = 0;
reportBody.innerText = 'Authoritative Production Engine\nPanel and System Design\nPanel area = width × height';
downloadTechnicalPDF();
assert.ok(pdfText.some(value => value.includes('Solar Rota Technical Calculation Report')));
assert.ok(pdfText.some(value => value.includes('PDF uses a built-in font fallback')));
assert.ok(pdfText.some(value => value.includes('Panel area = width')));

await setLocale('de');
window.state = sampleState();
renderEngReport();
assert.match(reportBody.innerHTML, /Panel- und Systemauslegung/);
assert.match(reportBody.innerHTML, /Panelfläche = Breite/);
assert.match(reportBody.innerHTML, /AC-Ausgangswirkungsgrad/);
assert.doesNotMatch(reportBody.innerHTML, /Kullanılabilir çatı alanı/);
const proposalDe = buildStructuredProposalExport(window.state, window.state.results);
assert.equal(proposalDe.display.language, 'de');
assert.equal(proposalDe.display.title, 'Proposal-Handoff-Zusammenfassung');
assert.match(proposalDe.display.blockers.join(' '), /PVGIS-Livedaten/);
assert.match(proposalDe.display.evidenceWarnings.join(' '), /Gültigkeitsdatum fehlt/);
assert.match(proposalDe.display.evidenceBlockers.join(' '), /Lieferantenangebot: kein verifizierter Nachweis/);

await setLocale('tr');
window.state = sampleState();
pdfText.length = 0;
downloadPDF();
assert.ok(pdfText.some(value => value.includes('PDF yerlesik font fallback')));
assert.ok(pdfText.some(value => value.includes('Turkiye Gunes Paneli Enerji ve Yatirim Raporu')));
assert.ok(pdfText.some(value => value.includes('Solar Rota')));

console.log('report/export i18n tests passed');
