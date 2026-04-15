// ═══════════════════════════════════════════════════════════
// SCENARIOS — Enflasyon & Döviz Kuru Senaryoları (Faz D1-D2)
// Solar Rota v2.0
// ═══════════════════════════════════════════════════════════

import { buildTariffModel, calcIRR, computeFinancialTable } from './calc-core.js';

let scenarioChart = null;
let fxChart = null;

const INFLATION_SCENARIOS = {
  low:    { label: 'Düşük (%15)',  rate: 0.15, color: '#10B981' },
  mid:    { label: 'Orta (%25)',   rate: 0.25, color: '#F59E0B' },
  high:   { label: 'Yüksek (%40)',rate: 0.40, color: '#EF4444' }
};

function money(value) {
  const state = window.state || {};
  const currency = state.displayCurrency || 'TRY';
  const usdToTry = Math.max(0.0001, Number(state.usdToTry) || 38.5);
  const converted = currency === 'USD' ? (Number(value) || 0) / usdToTry : (Number(value) || 0);
  return converted.toLocaleString(currency === 'USD' ? 'en-US' : 'tr-TR', { maximumFractionDigits: 0 }) + ' ' + currency;
}

export function renderScenarioAnalysis() {
  const state = window.state;
  const r = state.results;
  const card = document.getElementById('scenario-card');
  if (!card || !r) return;

  card.style.display = 'block';

  // Senaryo metrikleri hesapla
  const scenarios = Object.entries(INFLATION_SCENARIOS).map(([key, sc]) => {
    return computeScenario(r, sc.rate, state);
  });

  // Özel senaryo
  const customRate = parseFloat(document.getElementById('scenario-custom-rate')?.value) / 100 || 0.30;
  const customScenario = computeScenario(r, customRate, state);

  // Metric tablosu
  const tableEl = document.getElementById('scenario-table');
  if (tableEl) {
    tableEl.innerHTML = `
      <table class="scenario-compare-table">
        <thead>
          <tr>
            <th>Senaryo</th>
            <th>Geri Ödeme</th>
            <th>NPV (25y)</th>
            <th>IRR</th>
            <th>ROI</th>
          </tr>
        </thead>
        <tbody>
          ${scenarios.map((sc, i) => `
            <tr style="border-left:3px solid ${Object.values(INFLATION_SCENARIOS)[i].color}">
              <td style="color:${Object.values(INFLATION_SCENARIOS)[i].color}">${Object.values(INFLATION_SCENARIOS)[i].label}</td>
              <td>${sc.paybackYear ? sc.paybackYear + ' yıl' : '>25 yıl'}</td>
              <td>${money(sc.npv)}</td>
              <td>${sc.irr}%</td>
              <td>${sc.roi}%</td>
            </tr>
          `).join('')}
          <tr style="border-left:3px solid #8B5CF6">
            <td style="color:#8B5CF6">Özel (%${(customRate*100).toFixed(0)})</td>
            <td>${customScenario.paybackYear ? customScenario.paybackYear + ' yıl' : '>25 yıl'}</td>
            <td>${money(customScenario.npv)}</td>
            <td>${customScenario.irr}%</td>
            <td>${customScenario.roi}%</td>
          </tr>
        </tbody>
      </table>
    `;
  }

  // Kümülatif nakit akışı grafiği
  renderScenarioChart(r, state, customRate);
  renderSensitivityTable(r);

  // Döviz kuru projeksiyonu (NM aktifse)
  if (state.netMeteringEnabled) renderFXProjection(r, state);
}

function renderSensitivityTable(r) {
  const el = document.getElementById('sensitivity-table');
  if (!el) return;
  const baseNpv = Number(r.npvTotal) || 0;
  const cases = [
    ['Üretim -10%', baseNpv - (r.annualSavings * 0.10 * 8)],
    ['Üretim +10%', baseNpv + (r.annualSavings * 0.10 * 8)],
    ['Maliyet -10%', baseNpv + (r.totalCost * 0.10)],
    ['Maliyet +10%', baseNpv - (r.totalCost * 0.10)],
    ['Tarife -10%', baseNpv - (r.annualSavings * 0.10 * 8)],
    ['Tarife +10%', baseNpv + (r.annualSavings * 0.10 * 8)]
  ].map(([label, npv]) => ({ label, npv: Math.round(npv), delta: Math.round(npv - baseNpv) }));

  el.innerHTML = `
    <div style="font-size:0.9rem;font-weight:700;color:var(--primary);margin:12px 0 8px">Hassasiyet Analizi</div>
    <table class="scenario-compare-table">
      <thead><tr><th>Değişken</th><th>NPV Etkisi</th><th>Yeni NPV</th></tr></thead>
      <tbody>
        ${cases.map(c => `<tr>
          <td>${c.label}</td>
          <td style="color:${c.delta >= 0 ? '#10B981' : '#EF4444'}">${c.delta >= 0 ? '+' : ''}${money(c.delta)}</td>
          <td>${money(c.npv)}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  `;
}

function computeScenario(r, inflationRate, state) {
  const totalCost = r.totalCost;
  const panel = window._appData?.PANEL_TYPES?.[state.panelType] ||
    { degradation: 0.0045, firstYearDeg: 0.02 };
  const tariffModel = buildTariffModel({
    ...state,
    annualConsumptionKwh: r.hourlySummary?.annualLoad || r.tariffModel?.annualConsumptionKwh,
    tariff: r.tariffModel?.pstRate ?? r.tariff,
    skttTariff: r.tariffModel?.skttRate ?? r.tariff,
    contractedTariff: r.tariffModel?.contractedRate ?? r.tariff,
    exportTariff: r.tariffModel?.exportRate ?? r.tariff,
    annualPriceIncrease: inflationRate,
    discountRate: r.discountRate
  });
  const financial = computeFinancialTable({
    annualEnergy: r.annualEnergy,
    hourlySummary: r.hourlySummary,
    batterySummary: r.batterySummary,
    totalCost,
    tariffModel,
    panel,
    annualOMCost: r.annualOMCost,
    annualInsurance: r.annualInsurance,
    inverterLifetime: r.inverterLifetime || 12,
    inverterReplaceCost: r.inverterReplaceCost,
    netMeteringEnabled: state.netMeteringEnabled,
    exportRateOverride: state.netMeteringEnabled ? tariffModel.exportRate : 0
  });
  const cashFlows = [-totalCost, ...financial.rows.map(row => row.netCashFlow)];

  return {
    paybackYear: financial.simplePaybackYear,
    npv: Math.round(financial.projectNPV),
    irr: calcIRR(cashFlows),
    roi: financial.roi.toFixed(1),
    cashFlows
  };
}

function renderScenarioChart(r, state, customRate) {
  const canvas = document.getElementById('scenario-chart-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (scenarioChart) scenarioChart.destroy();

  const labels = Array.from({length: 25}, (_, i) => 'Yıl ' + (i + 1));
  const allScenarios = [
    ...Object.entries(INFLATION_SCENARIOS).map(([k, sc]) => ({
      ...sc,
      data: computeScenario(r, sc.rate, state).cashFlows.slice(1)
    })),
    {
      label: `Özel (%${(customRate*100).toFixed(0)})`,
      rate: customRate,
      color: '#8B5CF6',
      data: computeScenario(r, customRate, state).cashFlows.slice(1)
    }
  ];

  // Kümülatif dönüştür
  const cumData = allScenarios.map(sc => {
    let cum = -r.totalCost;
    return sc.data.map(v => { cum += v; return Math.round(cum); });
  });

  scenarioChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: allScenarios.map((sc, i) => ({
        label: sc.label,
        data: cumData[i],
        borderColor: sc.color,
        backgroundColor: sc.color + '18',
        borderWidth: 2,
        pointRadius: 0,
        fill: false,
        tension: 0.3
      }))
    },
    options: {
      responsive: true,
      plugins: {
        legend: { labels: { color: '#94A3B8', font: { size: 11 } } },
        tooltip: {
          backgroundColor: 'rgba(15,23,42,0.95)',
          titleColor: '#F1F5F9',
          bodyColor: '#94A3B8',
          callbacks: {
            label: c => ` ${c.dataset.label}: ${money(c.raw)}`
          }
        }
      },
      scales: {
        x: { ticks: { color: '#94A3B8', maxTicksLimit: 10 }, grid: { color: 'rgba(71,85,105,0.15)' } },
        y: { ticks: { color: '#94A3B8', callback: v => money(v) }, grid: { color: 'rgba(71,85,105,0.15)' } }
      }
    }
  });
}

function renderFXProjection(r, state) {
  const canvas = document.getElementById('fx-chart-canvas');
  const fxCard = document.getElementById('fx-projection-card');
  if (!canvas || !fxCard) return;
  fxCard.style.display = 'block';

  const baseRate = state.usdToTry || 38.5;
  const growth = parseFloat(document.getElementById('fx-growth-rate')?.value) / 100 || 0.20;

  const labels = Array.from({length: 11}, (_, i) => i === 0 ? 'Bugün' : 'Yıl ' + i);
  const centerData = labels.map((_, i) => Math.round(baseRate * Math.pow(1 + growth, i)));
  const upperData = labels.map((_, i) => Math.round(baseRate * Math.pow(1 + growth * 1.3, i)));
  const lowerData = labels.map((_, i) => Math.round(baseRate * Math.pow(1 + growth * 0.7, i)));

  const ctx = canvas.getContext('2d');
  if (fxChart) fxChart.destroy();

  fxChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Üst Senaryo (+%30)',
          data: upperData,
          borderColor: '#EF4444',
          borderWidth: 1.5,
          borderDash: [5, 3],
          pointRadius: 0,
          fill: '+2',
          backgroundColor: 'rgba(239,68,68,0.08)'
        },
        {
          label: `Baz (%${(growth*100).toFixed(0)} artış)`,
          data: centerData,
          borderColor: '#F59E0B',
          borderWidth: 2.5,
          pointRadius: 3,
          fill: false
        },
        {
          label: 'Alt Senaryo (−%30)',
          data: lowerData,
          borderColor: '#10B981',
          borderWidth: 1.5,
          borderDash: [5, 3],
          pointRadius: 0,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { labels: { color: '#94A3B8', font: { size: 11 } } },
        tooltip: {
          backgroundColor: 'rgba(15,23,42,0.95)',
          titleColor: '#F1F5F9',
          bodyColor: '#94A3B8',
          callbacks: {
            label: c => ` USD/TRY: ${c.raw}`
          }
        }
      },
      scales: {
        x: { ticks: { color: '#94A3B8' }, grid: { color: 'rgba(71,85,105,0.15)' } },
        y: { ticks: { color: '#94A3B8', callback: v => v + ' TL' }, grid: { color: 'rgba(71,85,105,0.15)' } }
      }
    }
  });
}

export function onScenarioCustomChange() {
  const state = window.state;
  if (state.results) renderScenarioAnalysis();
}

// window'a expose et
window.renderScenarioAnalysis = renderScenarioAnalysis;
window.onScenarioCustomChange = onScenarioCustomChange;
