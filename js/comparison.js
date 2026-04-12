// ═══════════════════════════════════════════════════════════
// COMPARISON — Rekabetçi Teklif Karşılaştırma (Faz D4)
// GüneşHesap v2.0
// ═══════════════════════════════════════════════════════════
import { PANEL_TYPES, INVERTER_TYPES } from './data.js';
import {
  buildTariffModel,
  calculateSystemLayout,
  computeFinancialTable,
  simulateHourlyEnergy
} from './calc-core.js';

const DEFAULT_SCENARIOS = [
  { name: 'Senaryo A', panelType: 'mono',    inverterType: 'string',    customPrice: null },
  { name: 'Senaryo B', panelType: 'bifacial', inverterType: 'optimizer', customPrice: null },
  { name: 'Senaryo C', panelType: 'poly',    inverterType: 'string',    customPrice: null }
];

function money(value) {
  const state = window.state || {};
  const currency = state.displayCurrency || 'TRY';
  const usdToTry = Math.max(0.0001, Number(state.usdToTry) || 38.5);
  const converted = currency === 'USD' ? (Number(value) || 0) / usdToTry : (Number(value) || 0);
  return converted.toLocaleString(currency === 'USD' ? 'en-US' : 'tr-TR', { maximumFractionDigits: 0 }) + ' ' + currency;
}

function moneyRate(value, unit = 'kWh') {
  const state = window.state || {};
  const currency = state.displayCurrency || 'TRY';
  const usdToTry = Math.max(0.0001, Number(state.usdToTry) || 38.5);
  const converted = currency === 'USD' ? (Number(value) || 0) / usdToTry : (Number(value) || 0);
  return converted.toLocaleString(currency === 'USD' ? 'en-US' : 'tr-TR', { maximumFractionDigits: currency === 'USD' ? 3 : 2 }) + ` ${currency}/${unit}`;
}

export function openComparison() {
  const modal = document.getElementById('comparison-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  buildComparisonUI();
}

export function closeComparison() {
  const modal = document.getElementById('comparison-modal');
  if (modal) modal.style.display = 'none';
}

function buildComparisonUI() {
  const state = window.state;
  if (!state.results) return;

  const wrap = document.getElementById('comparison-scenarios');
  if (!wrap) return;

  wrap.innerHTML = DEFAULT_SCENARIOS.map((sc, idx) => `
    <div class="comparison-scenario" id="comp-sc-${idx}">
      <h4 style="color:var(--primary);margin-bottom:12px">${sc.name}</h4>
      <div class="form-group">
        <label>Panel Tipi</label>
        <select id="comp-panel-${idx}" onchange="runComparison()"
          style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:8px 12px;color:var(--text);width:100%">
          ${Object.entries(PANEL_TYPES).map(([k, p]) => `
            <option value="${k}" ${k === sc.panelType ? 'selected' : ''}>${p.name}</option>
          `).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>İnverter Tipi</label>
        <select id="comp-inv-${idx}" onchange="runComparison()"
          style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:8px 12px;color:var(--text);width:100%">
          ${Object.entries(INVERTER_TYPES).map(([k, inv]) => `
            <option value="${k}" ${k === sc.inverterType ? 'selected' : ''}>${inv.name}</option>
          `).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Özel Fiyat (TL, boş = otomatik)</label>
        <input type="number" id="comp-price-${idx}" placeholder="Toplam TL"
          oninput="runComparison()"
          style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:8px 12px;color:var(--text);width:100%"/>
      </div>
    </div>
  `).join('');

  runComparison();
}

export function runComparison() {
  const state = window.state;
  if (!state.results) return;

  const r = state.results;
  const results = DEFAULT_SCENARIOS.map((_, idx) => {
    const panelKey = document.getElementById(`comp-panel-${idx}`)?.value || 'mono';
    const invKey = document.getElementById(`comp-inv-${idx}`)?.value || 'string';
    const customPrice = parseFloat(document.getElementById(`comp-price-${idx}`)?.value) || null;

    const panel = PANEL_TYPES[panelKey];
    const inv = INVERTER_TYPES[invKey];

    const layout = calculateSystemLayout({ ...state, panelType: panelKey }, panelKey);
    const panelCount = layout.panelCount;
    const systemPower = layout.systemPower;

    const basePower = Math.max(r.systemPower, 0.001);
    const annualEnergy = Math.round(r.annualEnergy * (systemPower / basePower) * inv.efficiency / (INVERTER_TYPES[state.inverterType || 'string']?.efficiency || 0.97));

    // Maliyet
    const invUnit = systemPower < 10 ? inv.pricePerKWp.lt10 : systemPower < 50 ? inv.pricePerKWp.lt50 : inv.pricePerKWp.gt50;
    const baseCost = systemPower * 1000 * panel.pricePerWatt + systemPower * invUnit + systemPower * (2200 + 600 + 900 + 1800) + 5000;
    const totalCost = customPrice || Math.round(baseCost * 1.20);

    const monthlyData = (r.monthlyData || []).map(v => Math.round((Number(v) || 0) * (annualEnergy / Math.max(r.annualEnergy, 1))));
    const monthlyLoad = Array.isArray(r.monthlyLoad)
      ? r.monthlyLoad
      : new Array(12).fill(Math.max(0, Number(state.dailyConsumption) || 0) * 365 / 12);
    const hourlySummary = simulateHourlyEnergy(monthlyData, monthlyLoad, {
      tariffType: state.tariffType,
      hourlyLoad8760: state.hourlyConsumption8760
    });
    const tariffModel = buildTariffModel({
      ...state,
      annualConsumptionKwh: monthlyLoad.reduce((a, b) => a + b, 0),
      annualPriceIncrease: r.annualPriceIncrease,
      discountRate: r.discountRate,
      tariff: r.tariff,
      exportTariff: r.tariffModel?.exportRate ?? state.exportTariff ?? r.tariff
    });
    const annualOMCost = state.omEnabled ? Math.round(totalCost * ((Number(state.omRate) || 0) / 100)) : 0;
    const annualInsurance = state.omEnabled ? Math.round(totalCost * ((Number(state.insuranceRate) || 0) / 100)) : 0;
    const inverterReplaceCost = state.omEnabled ? Math.round((systemPower * invUnit) * 1.1) : 0;
    const exportRate = state.netMeteringEnabled
      ? tariffModel.exportRate
      : 0;
    const financial = computeFinancialTable({
      annualEnergy,
      hourlySummary,
      batterySummary: null,
      totalCost,
      tariffModel,
      panel,
      annualOMCost,
      annualInsurance,
      inverterLifetime: inv.lifetime || 12,
      inverterReplaceCost,
      netMeteringEnabled: state.netMeteringEnabled,
      exportRateOverride: exportRate
    });

    let lcoeCostSum = totalCost;
    let lcoeEnergySum = 0;
    financial.rows.forEach(y => {
      const df = Math.pow(1 + tariffModel.discountRate, y.year);
      lcoeCostSum += (y.expenses || 0) / df;
      lcoeEnergySum += y.energy / df;
    });
    const lcoe = lcoeEnergySum > 0 ? (lcoeCostSum / lcoeEnergySum).toFixed(2) : '—';

    return {
      name: `Senaryo ${String.fromCharCode(65 + idx)}`,
      panelName: panel.name,
      invName: inv.name,
      panelCount, systemPower: systemPower.toFixed(2),
      annualEnergy: annualEnergy.toLocaleString('tr-TR'),
      totalCost,
      paybackYear: financial.paybackYear || '>25',
      npv: Math.round(financial.projectNPV),
      lcoe,
      isCustom: !!customPrice
    };
  });

  // Tabloyu render et
  const tableEl = document.getElementById('comparison-result-table');
  if (!tableEl) return;

  const bestPayback = Math.min(...results.filter(r => typeof r.paybackYear === 'number').map(r => r.paybackYear));

  tableEl.innerHTML = `
    <table class="comp-table">
      <thead>
        <tr>
          <th>Metrik</th>
          ${results.map(r => `<th style="color:var(--primary)">${r.name}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        <tr><td>Panel</td>${results.map(r => `<td>${r.panelName}</td>`).join('')}</tr>
        <tr><td>İnverter</td>${results.map(r => `<td>${r.invName}</td>`).join('')}</tr>
        <tr><td>Sistem (kWp)</td>${results.map(r => `<td>${r.systemPower} kWp</td>`).join('')}</tr>
        <tr><td>Yıllık Üretim</td>${results.map(r => `<td>${r.annualEnergy} kWh</td>`).join('')}</tr>
        <tr><td>Toplam Maliyet</td>${results.map(r => `<td>${money(r.totalCost)}${r.isCustom ? ' *' : ''}</td>`).join('')}</tr>
        <tr><td>Geri Ödeme</td>${results.map(r => `<td style="color:${r.paybackYear === bestPayback ? '#10B981' : 'inherit'};font-weight:${r.paybackYear === bestPayback ? '700' : '400'}">${r.paybackYear} yıl${r.paybackYear === bestPayback ? ' ✓' : ''}</td>`).join('')}</tr>
        <tr><td>Proje NPV</td>${results.map(r => `<td>${money(r.npv)}</td>`).join('')}</tr>
        <tr><td>LCOE</td>${results.map(r => `<td>${moneyRate(r.lcoe, 'kWh')}</td>`).join('')}</tr>
      </tbody>
    </table>
    <p style="font-size:0.75rem;color:var(--text-muted);margin-top:8px">* Özel fiyat girilmiş. ✓ En iyi geri ödeme süresi. Karşılaştırma aynı çekirdek finansal tablo ve saatlik tüketim özetiyle hesaplanır.</p>
  `;
}

// window'a expose et
window.openComparison = openComparison;
window.closeComparison = closeComparison;
window.runComparison = runComparison;
