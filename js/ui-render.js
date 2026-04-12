// ═══════════════════════════════════════════════════════════
// UI RENDER — Sonuç gösterimi, PDF, Share
// GüneşHesap v2.0
// ═══════════════════════════════════════════════════════════
import { PANEL_TYPES, MONTHS, COMPASS_DIRS } from './data.js';

let monthlyChart = null;

function moneyContext(state = window.state) {
  const currency = state.displayCurrency || 'TRY';
  const usdToTry = Math.max(0.0001, Number(state.usdToTry) || 38.5);
  const suffix = currency === 'USD' ? 'USD' : 'TL';
  const locale = currency === 'USD' ? 'en-US' : 'tr-TR';
  return { currency, usdToTry, suffix, locale };
}

function money(value, opts = {}) {
  const ctx = moneyContext();
  const raw = Number(value) || 0;
  const converted = ctx.currency === 'USD' ? raw / ctx.usdToTry : raw;
  const digits = opts.digits ?? (ctx.currency === 'USD' ? 0 : 0);
  return converted.toLocaleString(ctx.locale, { maximumFractionDigits: digits, minimumFractionDigits: opts.minDigits ?? 0 }) + ' ' + ctx.suffix;
}

function moneyRate(value, unit = 'kWh') {
  const ctx = moneyContext();
  const raw = Number(value) || 0;
  const converted = ctx.currency === 'USD' ? raw / ctx.usdToTry : raw;
  return converted.toLocaleString(ctx.locale, { maximumFractionDigits: ctx.currency === 'USD' ? 3 : 2 }) + ` ${ctx.suffix}/${unit}`;
}

export function renderResults() {
  const state = window.state;
  const r = state.results;
  const p = PANEL_TYPES[state.panelType];

  window.animateCounter('kpi-energy', r.annualEnergy, v => Math.round(v).toLocaleString('tr-TR'));
  window.animateCounter('kpi-savings', r.annualSavings, v => money(v));
  window.animateCounter('kpi-power', r.systemPower, v => v.toFixed(2));
  window.animateCounter('kpi-co2', parseFloat(r.co2Savings), v => v.toFixed(2));
  document.getElementById('kpi-panels-sub').textContent = `${r.panelCount} adet panel`;
  document.getElementById('kpi-tree-sub').textContent = `≈ ${r.trees} ağaç eşdeğeri`;

  document.querySelector('#step-5 .kpi-card:nth-child(2) .kpi-unit').textContent =
    (state.displayCurrency === 'USD' ? 'USD / yıl' : 'TL / yıl');
  document.getElementById('fin-cost').textContent = money(r.totalCost);
  document.getElementById('fin-payback').textContent = r.simplePaybackYear ? r.simplePaybackYear + ' yıl' : '>25 yıl';
  const discountedPaybackEl = document.getElementById('fin-discounted-payback');
  if (discountedPaybackEl) discountedPaybackEl.textContent = r.discountedPaybackYear ? r.discountedPaybackYear + ' yıl' : '>25 yıl';
  document.getElementById('fin-total').textContent = money(r.npvTotal);
  document.getElementById('fin-roi').textContent = r.roi + '%';
  document.getElementById('fin-irr').textContent = r.irr === 'N/A' ? 'N/A' : r.irr + '%';
  document.getElementById('fin-lcoe').textContent = moneyRate(r.lcoe, 'kWh');

  const omRow = document.getElementById('fin-om-row');
  const invRow = document.getElementById('fin-inverter-row');
  if (r.annualOMCost > 0 || r.annualInsurance > 0) {
    if (omRow) { omRow.style.display = ''; document.getElementById('fin-om-cost').textContent = '-' + money(r.annualOMCost + r.annualInsurance) + '/yıl'; }
    if (invRow) { invRow.style.display = ''; document.getElementById('fin-inverter-cost').textContent = '-' + money(r.inverterReplaceCost); }
  } else {
    if (omRow) omRow.style.display = 'none';
    if (invRow) invRow.style.display = 'none';
  }
  const paybackPct = Math.min(((r.simplePaybackYear || 25) / 15) * 100, 100);
  document.getElementById('payback-bar').style.width = paybackPct + '%';

  document.getElementById('eng-report-body').innerHTML = '';
  document.getElementById('eng-report-body').classList.remove('open');
  document.getElementById('eng-report-toggle').classList.remove('open');
  document.getElementById('eng-chevron').classList.remove('open');

  const tbody = document.getElementById('tech-table-body');
  tbody.innerHTML = '';
  const rows = [
    ['Panel Sayısı', r.panelCount + ' adet'],
    ['Panel Tipi', p.name],
    ['Panel Verimliliği', (p.efficiency*100).toFixed(1) + '%'],
    ['Sistem Gücü', r.systemPower.toFixed(2) + ' kWp'],
    ['Çatı Eğimi', state.tilt + '°'],
    ['Çatı Yönü', state.azimuthName],
    ['Gölgelenme', state.shadingFactor + '%'],
    ['Kirlenme', state.soilingFactor + '%'],
    ['İnverter Tipi', r.inverterType ? r.inverterType.charAt(0).toUpperCase() + r.inverterType.slice(1) : 'String'],
    ['İnverter Verimi', (r.inverterEfficiency || '97') + '%'],
    ['Spesifik Verim', r.ysp + ' kWh/kWp'],
    ['Kapasite Faktörü', r.cf + '%'],
    ['Performans Oranı', r.pr + '%'],
    ['CO₂ Tasarrufu', r.co2Savings + ' ton/yıl'],
    ['Hesap Metodu', `${r.calculationMode || '—'} / ${r.methodologyVersion || '—'}`],
    ['PVGIS loss parametresi', `${r.pvgisLossParam ?? 0}%`],
    ['PVGIS POA', `${r.pvgisPoa || '—'} kWh/m²/yıl`],
    ['Tarife', moneyRate(r.tariff, 'kWh')],
    ['Tarife Rejimi', `${r.tariffModel?.effectiveRegime || '—'} / Sözleşme gücü: ${r.tariffModel?.contractedPowerKw || 0} kW`],
    ['Para Birimi', `${state.displayCurrency || 'TRY'} (USD/TRY: ${Number(state.usdToTry || 38.5).toFixed(2)})`],
    ['Tarife Kaynak Tarihi', r.tariffModel?.sourceDate || '—'],
    ['Yıllık Fiyat Artışı', ((r.annualPriceIncrease || 0) * 100).toFixed(1) + '%'],
  ];
  rows.forEach(([k, v]) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${k}</td><td>${v}</td>`;
    tbody.appendChild(tr);
  });

  // ── Çatı yüzeyleri kırılımı ───────────────────────────────────────────────
  const sectionCard = document.getElementById('section-breakdown-card');
  const sectionBody = document.getElementById('section-breakdown-body');
  if (r.sectionResults && r.sectionResults.length > 1 && sectionCard && sectionBody) {
    sectionCard.style.display = 'block';
    sectionBody.innerHTML = '';
    let totalPC = 0, totalPow = 0, totalE = 0;
    r.sectionResults.forEach((sec, i) => {
      totalPC  += sec.panelCount;
      totalPow += sec.systemPower;
      totalE   += sec.annualEnergy;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${i + 1}. Yüzey</td>
        <td>${sec.sectionArea} m²</td>
        <td>${sec.sectionAzimuthName}</td>
        <td>${sec.sectionTilt}°</td>
        <td>${sec.panelCount}</td>
        <td>${sec.systemPower.toFixed(2)}</td>
        <td>${Math.round(sec.annualEnergy).toLocaleString('tr-TR')} kWh</td>`;
      sectionBody.appendChild(tr);
    });
    const totalRow = document.createElement('tr');
    totalRow.className = 'section-total-row';
    totalRow.innerHTML = `
      <td>Toplam</td><td>—</td><td>—</td><td>—</td>
      <td>${totalPC}</td>
      <td>${totalPow.toFixed(2)}</td>
      <td>${Math.round(totalE).toLocaleString('tr-TR')} kWh</td>`;
    sectionBody.appendChild(totalRow);
  } else if (sectionCard) {
    sectionCard.style.display = 'none';
  }

  const avgConsumption = state.dailyConsumption ? Math.round(state.dailyConsumption * 30) : Math.round(r.annualEnergy / 12 * 0.6);
  renderMonthlyChart(r.monthlyData, avgConsumption);
  window.renderPRGauge(parseFloat(r.pr));

  renderBESSResults(r.bessMetrics);
  renderNMResults(r.nmMetrics, state.netMeteringEnabled);
  renderWarningsAndAudit(state, r);
  renderPanelLayoutSketch(state, r, p);

  // Faz B: Fatura analizi sonuçları
  if (r.billAnalysis) renderBillAnalysisResults(r.billAnalysis);
  else document.getElementById('bill-result-card')?.remove();

  // Faz C: EV Şarj sonuçları
  renderEVResults(r.evMetrics);

  // Faz C: Isı Pompası sonuçları
  renderHeatPumpResults(r.heatPumpMetrics);

  // Faz C: Yapısal kontrol sonuçları
  renderStructuralResults(r.structuralCheck);

  // Faz D: Vergi avantajı
  renderTaxResults(r.taxMetrics);

  // Karşılaştırmalı dashboard güncelle
  if (window.updateDashboard) window.updateDashboard();
}

function renderBESSResults(bess) {
  const section = document.getElementById('bess-result-section');
  if (!section) return;
  if (!bess) { section.style.display = 'none'; return; }
  section.style.display = 'block';
  document.getElementById('bess-model-badge').textContent = bess.modelName || 'Batarya';
  document.getElementById('bess-independence').textContent = `${bess.gridIndependence}%`;
  document.getElementById('bess-night').textContent = `${bess.nightCoverage}%`;
  document.getElementById('bess-detail-row').innerHTML = `
    <span>Kullanılabilir kapasite: <strong>${bess.usableCapacity} kWh</strong></span>
    <span>Yıllık batarya deşarjı: <strong>${Number(bess.batteryStored || 0).toLocaleString('tr-TR')} kWh</strong></span>
    <span>Tahmini çevrim/yıl: <strong>${bess.cyclesPerYear || '—'}</strong></span>
    <span>Batarya maliyeti: <strong>${money(bess.batteryCost)}</strong></span>
  `;
}

function renderNMResults(nm, enabled) {
  const section = document.getElementById('nm-result-section');
  if (!section) return;
  if (!nm) { section.style.display = 'none'; return; }
  section.style.display = 'block';
  document.getElementById('nm-license-badge').textContent = enabled ? nm.systemType : 'Satış kapalı';
  document.getElementById('nm-export-kwh').textContent = `${nm.paidGridExport.toLocaleString('tr-TR')} / ${nm.annualGridExport.toLocaleString('tr-TR')}`;
  document.getElementById('nm-export-revenue').textContent = money(nm.annualExportRevenue);
  document.getElementById('nm-self-consumption').textContent = `${nm.selfConsumptionPct}%`;
}

function renderWarningsAndAudit(state, r) {
  const techCard = document.getElementById('tech-table-body')?.closest('.card');
  if (!techCard) return;

  let audit = document.getElementById('audit-panel-card');
  if (!audit) {
    audit = document.createElement('div');
    audit.id = 'audit-panel-card';
    audit.className = 'card';
    audit.style.marginTop = '16px';
    techCard.insertAdjacentElement('afterend', audit);
  }

  const warnings = Array.isArray(r.calculationWarnings) ? r.calculationWarnings : [];
  const warningHtml = warnings.length
    ? `<div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);border-radius:8px;padding:12px;margin-bottom:12px;color:#FCA5A5;font-size:0.82rem">
        <strong>Hata yakala uyarıları:</strong><br>${warnings.map(w => `• ${w}`).join('<br>')}
      </div>`
    : `<div style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.25);border-radius:8px;padding:12px;margin-bottom:12px;color:#A7F3D0;font-size:0.82rem">Hata yakala modu kritik anomali bulmadı.</div>`;

  audit.innerHTML = `
    <div class="card-title">Audit Paneli</div>
    ${warningHtml}
    <table class="tech-table">
      <tbody>
        <tr><td>Konum</td><td>${state.cityName || '—'} (${Number(state.lat || 0).toFixed(4)}, ${Number(state.lon || 0).toFixed(4)})</td></tr>
        <tr><td>Tarife</td><td>${r.tariffModel?.type || state.tariffType} | ${r.tariffModel?.effectiveRegime || '—'} | ${moneyRate(r.tariff, 'kWh')} | Kaynak: ${r.tariffModel?.sourceDate || '—'}</td></tr>
        <tr><td>Tüketim</td><td>${Math.round(r.hourlySummary?.annualLoad || state.dailyConsumption * 365).toLocaleString('tr-TR')} kWh/yıl</td></tr>
        <tr><td>Öz tüketim / İhracat</td><td>${Math.round(r.nmMetrics?.selfConsumedEnergy || 0).toLocaleString('tr-TR')} kWh / ücretli ${Math.round(r.nmMetrics?.paidGridExport || 0).toLocaleString('tr-TR')} kWh / toplam ${Math.round(r.nmMetrics?.annualGridExport || 0).toLocaleString('tr-TR')} kWh</td></tr>
        <tr><td>Üretim güven aralığı</td><td>Kötü yıl: ${Math.round(r.annualEnergy * 0.90).toLocaleString('tr-TR')} kWh | Baz: ${r.annualEnergy.toLocaleString('tr-TR')} kWh | İyi yıl: ${Math.round(r.annualEnergy * 1.10).toLocaleString('tr-TR')} kWh</td></tr>
        <tr><td>Güven seviyesi</td><td>${r.confidenceLevel} (${r.calculationMode})</td></tr>
        <tr><td>Veri gizliliği</td><td>Kayıtlı hesaplar sadece bu tarayıcıdaki localStorage alanında tutulur.</td></tr>
      </tbody>
    </table>
  `;
}

function renderPanelLayoutSketch(state, r, panel) {
  const sectionCard = document.getElementById('section-breakdown-card');
  if (!sectionCard) return;
  let card = document.getElementById('panel-layout-card');
  if (!card) {
    card = document.createElement('div');
    card.id = 'panel-layout-card';
    card.className = 'card';
    card.style.marginTop = '16px';
    sectionCard.insertAdjacentElement('afterend', card);
  }
  const cols = Math.max(1, Math.ceil(Math.sqrt(r.panelCount)));
  const rows = Math.max(1, Math.ceil(r.panelCount / cols));
  const cells = Array.from({ length: rows * cols }, (_, i) =>
    `<span style="display:block;aspect-ratio:${panel.width}/${panel.height};border:1px solid ${i < r.panelCount ? 'rgba(245,158,11,0.65)' : 'rgba(71,85,105,0.25)'};background:${i < r.panelCount ? 'rgba(245,158,11,0.18)' : 'transparent'};border-radius:3px"></span>`
  ).join('');
  card.innerHTML = `
    <div class="card-title">Kabaca Panel Yerleşim Kontrolü</div>
    <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:12px">Bu çizim kesin saha yerleşimi değildir; baca, parapet, yangın boşluğu ve gölge objeleri ayrıca saha keşfinde kontrol edilmelidir.</div>
    <div style="display:grid;grid-template-columns:repeat(${cols},minmax(10px,1fr));gap:4px;max-width:420px">
      ${cells}
    </div>
    <div style="font-size:0.78rem;color:var(--text-muted);margin-top:10px">${r.panelCount} panel | Yaklaşık panel alanı: ${(r.panelCount * panel.width * panel.height).toFixed(1)} m² | Kullanılan çatı alanı varsayımı: %75</div>
  `;
}

export function renderMonthlyChart(data, avgConsumption) {
  const canvas = document.getElementById('monthly-chart-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (monthlyChart) monthlyChart.destroy();

  // NaN/null guard — Chart.js sıfır beklediğinde null/NaN çizim bozar
  const safeData = Array.isArray(data)
    ? data.map(v => (v == null || isNaN(v) || !isFinite(v)) ? 0 : v)
    : Array(12).fill(0);

  const grad = ctx.createLinearGradient(0, 0, 0, 280);
  grad.addColorStop(0, 'rgba(245,158,11,0.88)');
  grad.addColorStop(0.55, 'rgba(245,158,11,0.4)');
  grad.addColorStop(1, 'rgba(245,158,11,0.05)');

  monthlyChart = new Chart(ctx, {
    data: {
      labels: MONTHS,
      datasets: [
        {
          type: 'bar',
          label: 'Aylık Üretim (kWh)',
          data: safeData,
          backgroundColor: grad,
          borderColor: 'rgba(245,158,11,0.9)',
          borderWidth: 1,
          borderRadius: 6,
          borderSkipped: false,
          order: 2
        },
        {
          type: 'line',
          label: `Tahmini Tüketim (~${Math.round(avgConsumption || 250).toLocaleString('tr-TR')} kWh/ay)`,
          data: new Array(12).fill(avgConsumption || 250),
          borderColor: '#06B6D4',
          borderDash: [5, 5],
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
          order: 1
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { labels: { color: '#94A3B8', font: { family: 'Space Grotesk, Inter', size: 11 } } },
        tooltip: {
          backgroundColor: 'rgba(15,23,42,0.95)',
          borderColor: 'rgba(71,85,105,0.5)',
          borderWidth: 1,
          titleColor: '#F1F5F9',
          bodyColor: '#94A3B8',
          padding: 12,
          cornerRadius: 10,
          callbacks: {
            label: c => ' ' + (c.raw || 0).toLocaleString('tr-TR') + ' kWh'
          }
        }
      },
      scales: {
        x: {
          ticks: { color: '#94A3B8', font: { family: 'Space Grotesk, Inter' } },
          grid: { color: 'rgba(71,85,105,0.18)', drawBorder: false }
        },
        y: {
          ticks: { color: '#94A3B8', font: { family: 'Space Grotesk, Inter' } },
          grid: { color: 'rgba(71,85,105,0.18)', drawBorder: false }
        }
      }
    }
  });
}

// ── Faz C: EV Sonuçları ─────────────────────────────────────────────────────
function renderEVResults(ev) {
  const card = document.getElementById('ev-result-card');
  if (!card) return;
  if (!ev) { card.style.display = 'none'; return; }
  card.style.display = 'block';
  card.innerHTML = `
    <div class="result-card-header">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/><circle cx="7" cy="14" r="1"/><circle cx="17" cy="14" r="1"/></svg>
      <span>EV Şarj Analizi</span>
    </div>
    <div class="result-metrics-grid">
      <div class="result-metric"><div class="result-metric-val">${ev.annual_kWh.toLocaleString('tr-TR')}</div><div class="result-metric-label">kWh/yıl EV ihtiyacı</div></div>
      <div class="result-metric"><div class="result-metric-val">${ev.solarChargeRatio}%</div><div class="result-metric-label">Güneşle şarj oranı</div></div>
      <div class="result-metric"><div class="result-metric-val">${money(ev.fuelCostSaved)}</div><div class="result-metric-label">Yıllık yakıt tasarrufu</div></div>
      <div class="result-metric"><div class="result-metric-val">${money(ev.netSaving)}</div><div class="result-metric-label">Net yıllık tasarruf</div></div>
    </div>
    <p style="font-size:0.78rem;color:var(--text-muted);margin-top:8px">Ek panel ihtiyacı: ${ev.additionalPanels} adet | Güneşten şarj: ${ev.solarChargeKwh.toLocaleString('tr-TR')} kWh/yıl</p>
  `;
}

// ── Faz C: Isı Pompası Sonuçları ────────────────────────────────────────────
function renderHeatPumpResults(hp) {
  const card = document.getElementById('heatpump-result-card');
  if (!card) return;
  if (!hp) { card.style.display = 'none'; return; }
  card.style.display = 'block';
  card.innerHTML = `
    <div class="result-card-header">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#06B6D4" stroke-width="2"><path d="M12 2v6M12 22v-6M4.93 4.93l4.24 4.24M14.83 14.83l4.24 4.24M2 12h6M22 12h-6M4.93 19.07l4.24-4.24M14.83 9.17l4.24-4.24"/></svg>
      <span>Isı Pompası Analizi</span>
    </div>
    <div class="result-metrics-grid">
      <div class="result-metric"><div class="result-metric-val">${hp.annual_heat_demand.toLocaleString('tr-TR')}</div><div class="result-metric-label">kWh/yıl ısıtma talebi</div></div>
      <div class="result-metric"><div class="result-metric-val">COP ${hp.cop}</div><div class="result-metric-label">Verimlilik katsayısı</div></div>
      <div class="result-metric"><div class="result-metric-val">${money(hp.gas_cost)}</div><div class="result-metric-label">Mevcut doğalgaz maliyeti</div></div>
      <div class="result-metric"><div class="result-metric-val">${money(hp.savings)}</div><div class="result-metric-label">Yıllık tasarruf</div></div>
    </div>
    <p style="font-size:0.78rem;color:var(--text-muted);margin-top:8px">Isı pompası elektrik tüketimi: ${hp.hp_electricity.toLocaleString('tr-TR')} kWh/yıl</p>
  `;
}

// ── Faz C: Yapısal Kontrol Sonuçları ────────────────────────────────────────
function renderStructuralResults(sc) {
  const card = document.getElementById('structural-result-card');
  if (!card) return;
  if (!sc) { card.style.display = 'none'; return; }
  card.style.display = 'block';

  const snowStatus = sc.snowLoad <= 0.5 ? 'ok' : sc.snowLoad <= 1.0 ? 'warn' : 'danger';
  const windStatus = sc.windPressure <= 0.5 ? 'ok' : sc.windPressure <= 1.0 ? 'warn' : 'danger';
  const statusColors = { ok: '#10B981', warn: '#F59E0B', danger: '#EF4444' };
  const statusLabels = { ok: 'OK', warn: 'Dikkat', danger: 'Kritik' };

  card.innerHTML = `
    <div class="result-card-header">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
      <span>Yapısal Kontrol</span>
    </div>
    <div class="structural-checks">
      <div class="structural-check-row">
        <span>Kar Yükü (${sc.snowZone})</span>
        <span>${sc.snowLoad.toFixed(2)} kN/m²</span>
        <span class="status-badge" style="background:${statusColors[snowStatus]}22;color:${statusColors[snowStatus]};border:1px solid ${statusColors[snowStatus]}44;padding:2px 8px;border-radius:20px;font-size:0.75rem">${statusLabels[snowStatus]}</span>
      </div>
      <div class="structural-check-row">
        <span>Rüzgar Basıncı (${sc.windZone})</span>
        <span>${sc.windPressure.toFixed(2)} kN/m²</span>
        <span class="status-badge" style="background:${statusColors[windStatus]}22;color:${statusColors[windStatus]};border:1px solid ${statusColors[windStatus]}44;padding:2px 8px;border-radius:20px;font-size:0.75rem">${statusLabels[windStatus]}</span>
      </div>
    </div>
    <p style="font-size:0.78rem;color:var(--text-muted);margin-top:8px">${sc.recommendation}</p>
  `;
}

// ── Faz D: Vergi Sonuçları ────────────────────────────────────────────────
function renderTaxResults(tax) {
  const card = document.getElementById('tax-result-card');
  if (!card) return;
  if (!tax) { card.style.display = 'none'; return; }
  card.style.display = 'block';
  card.innerHTML = `
    <div class="result-card-header">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
      <span>Vergi Avantajı Özeti</span>
    </div>
    <div class="result-metrics-grid">
      <div class="result-metric"><div class="result-metric-val">${money(tax.taxShieldNPV)}</div><div class="result-metric-label">Amortisman vergi kalkanı (NPV)</div></div>
      <div class="result-metric"><div class="result-metric-val">${money(tax.kdv_recovery)}</div><div class="result-metric-label">KDV iadesi</div></div>
      <div class="result-metric"><div class="result-metric-val">${money(tax.totalTaxBenefit)}</div><div class="result-metric-label">Toplam vergi avantajı</div></div>
      <div class="result-metric"><div class="result-metric-val">${money(tax.effectiveCost)}</div><div class="result-metric-label">Efektif yatırım maliyeti</div></div>
    </div>
  `;
}

// ── Faz B: Fatura Analizi Sonuçları (placeholder) ────────────────────────
function renderBillAnalysisResults(ba) {
  const chartWrap = document.querySelector('.chart-wrap');
  if (!chartWrap || !ba) return;
  let card = document.getElementById('bill-result-card');
  if (!card) {
    card = document.createElement('div');
    card.id = 'bill-result-card';
    card.className = 'card';
    card.style.marginTop = '16px';
    chartWrap.insertAdjacentElement('afterend', card);
  }
  const best = ba.rows.reduce((acc, row) => Number(row.coveragePct) > Number(acc.coveragePct) ? row : acc, ba.rows[0]);
  const worst = ba.rows.reduce((acc, row) => Number(row.coveragePct) < Number(acc.coveragePct) ? row : acc, ba.rows[0]);
  card.innerHTML = `
    <div class="card-title">Fatura Analizi</div>
    <div class="result-metrics-grid">
      <div class="result-metric"><div class="result-metric-val">${ba.annualConsumption.toLocaleString('tr-TR')}</div><div class="result-metric-label">kWh/yıl tüketim</div></div>
      <div class="result-metric"><div class="result-metric-val">${ba.avgCoveragePct.toFixed(1)}%</div><div class="result-metric-label">Ortalama aylık karşılama</div></div>
      <div class="result-metric"><div class="result-metric-val">${money(ba.annualSaving)}</div><div class="result-metric-label">Aylık eşleşme tasarrufu</div></div>
      <div class="result-metric"><div class="result-metric-val">${MONTHS[best.month]} / ${MONTHS[worst.month]}</div><div class="result-metric-label">En iyi / en zayıf ay</div></div>
    </div>
  `;
}

// ── PDF ─────────────────────────────────────────────────────────────────────
function normalizeTR(str) {
  if (!str) return '';
  return String(str)
    .replace(/ş/g,'s').replace(/Ş/g,'S')
    .replace(/ı/g,'i').replace(/İ/g,'I')
    .replace(/ğ/g,'g').replace(/Ğ/g,'G')
    .replace(/ç/g,'c').replace(/Ç/g,'C')
    .replace(/ö/g,'o').replace(/Ö/g,'O')
    .replace(/ü/g,'u').replace(/Ü/g,'U');
}

export function downloadPDF() {
  const state = window.state;
  if (!state.results) return;
  const { jsPDF } = window.jspdf || {};
  if (!jsPDF) {
    window.showToast?.('PDF kütüphanesi yüklenemedi. İnternet bağlantısını kontrol edin.', 'error');
    return;
  }
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const r = state.results;
  const p = PANEL_TYPES[state.panelType];

  // Kapak Sayfası
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 297, 'F');
  doc.setTextColor(245, 158, 11);
  doc.setFontSize(22); doc.setFont('helvetica', 'bold');
  doc.text(normalizeTR('GüneşHesap'), 20, 25);
  doc.setFontSize(12); doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text(normalizeTR('Türkiye Güneş Paneli Enerji ve Yatırım Raporu'), 20, 33);
  doc.setFontSize(10);
  doc.text(`${normalizeTR(state.cityName || 'Bilinmiyor')} — ${new Date().toLocaleDateString('tr-TR')}`, 20, 41);
  doc.setFontSize(8); doc.setTextColor(245, 158, 11);
  doc.text(normalizeTR(`Metodoloji: ${r.methodologyVersion || '—'} | Hesap modu: ${r.calculationMode || '—'} | Kaynak tarihi: ${r.tariffModel?.sourceDate || '—'}`), 20, 48);
  doc.setTextColor(148, 163, 184);
  doc.text(normalizeTR('On fizibilite raporudur; kesin teklif, statik proje veya resmi izin belgesi yerine gecmez.'), 20, 53);

  // Ayırıcı çizgi
  doc.setDrawColor(245, 158, 11); doc.setLineWidth(0.5);
  doc.line(20, 58, 190, 58);

  // KPI özet
  doc.setTextColor(241, 245, 249); doc.setFontSize(11); doc.setFont('helvetica', 'bold');
  const kpis = [
    [normalizeTR('Yıllık Üretim'), r.annualEnergy.toLocaleString('tr-TR') + ' kWh'],
    [normalizeTR('Yıllık Tasarruf'), money(r.annualSavings)],
    [normalizeTR('Sistem Gücü'), r.systemPower.toFixed(2) + ' kWp'],
    [normalizeTR('Toplam Maliyet'), money(r.totalCost)],
    [normalizeTR('Basit Geri Ödeme'), (r.simplePaybackYear || '>25') + ' yıl'],
    [normalizeTR('İskontolu Geri Ödeme'), (r.discountedPaybackYear || '>25') + ' yıl'],
    [normalizeTR('NPV (25 yıl)'), money(r.npvTotal)],
    ['IRR', r.irr + '%'],
    ['LCOE', moneyRate(r.lcoe, 'kWh')],
    ['ROI', r.roi + '%'],
    [normalizeTR('CO₂ Tasarrufu'), r.co2Savings + ' ton/yıl'],
  ];

  let y = 68;
  doc.setFontSize(9);
  kpis.forEach(([lbl, val]) => {
    doc.setTextColor(148, 163, 184); doc.setFont('helvetica', 'normal');
    doc.text(lbl, 25, y);
    doc.setTextColor(241, 245, 249); doc.setFont('helvetica', 'bold');
    doc.text(val, 100, y);
    y += 8;
  });

  // Sayfa 2 — Sistem Tasarımı
  doc.addPage();
  doc.setFillColor(15, 23, 42); doc.rect(0, 0, 210, 297, 'F');
  doc.setTextColor(245, 158, 11); doc.setFontSize(14); doc.setFont('helvetica', 'bold');
  doc.text(normalizeTR('Sistem Tasarımı'), 20, 20);
  doc.setTextColor(241, 245, 249); doc.setFontSize(9); doc.setFont('helvetica', 'normal');

  const techRows = [
    ['Panel Tipi', p.name], ['Panel Sayısı', r.panelCount + ' adet'],
    ['Sistem Gücü', r.systemPower.toFixed(2) + ' kWp'],
    [normalizeTR('Çatı Eğimi'), state.tilt + '°'],
    [normalizeTR('Çatı Yönü'), normalizeTR(state.azimuthName)],
    ['PR', r.pr + '%'], ['PSH', r.psh + ' saat/gün'],
    [normalizeTR('Spesifik Verim'), r.ysp + ' kWh/kWp'],
  ];
  y = 35;
  techRows.forEach(([k, v]) => {
    doc.setTextColor(148, 163, 184); doc.text(normalizeTR(k), 25, y);
    doc.setTextColor(241, 245, 249); doc.text(normalizeTR(v), 100, y);
    y += 7;
  });

  // Maliyet kırılımı
  y += 5;
  doc.setTextColor(245, 158, 11); doc.setFontSize(11); doc.setFont('helvetica', 'bold');
  doc.text(normalizeTR('Maliyet Kırılımı'), 20, y); y += 8;
  doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  const cb = r.costBreakdown;
  const costRows = [
    ['Panel', cb.panel], ['İnverter', cb.inverter],
    [normalizeTR('Montaj'), cb.mounting], ['DC Kablo', cb.dcCable],
    ['AC Tesisat', cb.acElec], [normalizeTR('İşçilik'), cb.labor],
    ['TEDAŞ + İzin', cb.permits], [`KDV (%${Math.round((cb.kdvRate ?? 0.20) * 100)})`, cb.kdv],
    ['TOPLAM', cb.total]
  ];
  costRows.forEach(([lbl, val]) => {
    doc.setTextColor(148, 163, 184);
    doc.text(normalizeTR(lbl), 25, y);
    const w = 40;
    const barW = Math.min((val / cb.total) * w, w);
    doc.setFillColor(245, 158, 11); doc.rect(75, y - 3, barW * 1.2, 4, 'F');
    doc.setTextColor(241, 245, 249);
    doc.text(money(Math.round(val)), 165, y);
    y += 7;
  });

  // Sayfa 3 — 25 Yıl Tablo
  doc.addPage();
  doc.setFillColor(15, 23, 42); doc.rect(0, 0, 210, 297, 'F');
  doc.setTextColor(245, 158, 11); doc.setFontSize(11); doc.setFont('helvetica', 'bold');
  doc.text(normalizeTR('25 Yıl Projeksiyon'), 20, 15);

  doc.setFontSize(7); doc.setFont('helvetica', 'bold');
  doc.setTextColor(148, 163, 184);
  const headers7 = ['Yıl','Üretim','Tarife','Tasarruf','Gider','Net','Kümülatif'];
  const xCols = [15, 30, 55, 75, 100, 125, 150, 178];
  headers7.forEach((h, i) => doc.text(normalizeTR(h), xCols[i], 25));
  doc.setLineWidth(0.2); doc.setDrawColor(71, 85, 105);
  doc.line(15, 27, 195, 27);

  let row = 32;
  doc.setFont('helvetica', 'normal');
  r.yearlyTable.slice(0, 25).forEach(yr => {
    if (row > 275) { doc.addPage(); doc.setFillColor(15,23,42); doc.rect(0,0,210,297,'F'); row = 15; }
    if (yr.year === r.paybackYear) { doc.setFillColor(16,185,129,50); doc.rect(13, row-4, 182, 6, 'F'); }
    doc.setTextColor(241, 245, 249);
    const vals = [yr.year+'', yr.energy.toLocaleString('tr-TR'), moneyRate(yr.rate, 'kWh'),
      money(yr.savings), money(yr.expenses),
      money(yr.netCashFlow), money(yr.cumulative)];
    vals.forEach((v, i) => doc.text(v, xCols[i], row));
    row += 6;
  });

  doc.save(`guneshesap-${normalizeTR(state.cityName || 'rapor')}-${new Date().getFullYear()}.pdf`);
  window.showToast('PDF rapor indirildi.', 'success');
}

export function downloadTechnicalPDF() {
  const state = window.state;
  if (!state.results) return;
  const { jsPDF } = window.jspdf || {};
  if (!jsPDF) {
    window.showToast?.('PDF kütüphanesi yüklenemedi. İnternet bağlantısını kontrol edin.', 'error');
    return;
  }

  if (window.renderEngReport) window.renderEngReport();
  const body = document.getElementById('eng-report-body');
  const reportText = body?.innerText?.trim();
  if (!reportText) {
    window.showToast?.('Teknik rapor içeriği üretilemedi.', 'error');
    return;
  }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const r = state.results;
  let y = 18;
  const marginX = 16;
  const lineHeight = 5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(normalizeTR('GüneşHesap Teknik Hesap Raporu'), marginX, y);
  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(normalizeTR(`Metodoloji: ${r.methodologyVersion || '—'} | Hesap modu: ${r.calculationMode || '—'} | PVGIS loss=${r.pvgisLossParam ?? '—'}`), marginX, y);
  y += 8;

  const lines = reportText
    .split('\n')
    .map(line => normalizeTR(line.trim()))
    .filter(Boolean)
    .flatMap(line => doc.splitTextToSize ? doc.splitTextToSize(line, 178) : [line]);

  doc.setFontSize(7);
  lines.forEach(line => {
    if (y > 285) {
      doc.addPage();
      y = 16;
    }
    doc.text(line, marginX, y);
    y += lineHeight;
  });

  doc.save(`guneshesap-teknik-${normalizeTR(state.cityName || 'rapor')}-${new Date().getFullYear()}.pdf`);
  window.showToast('Teknik PDF rapor indirildi.', 'success');
}

export function shareResults() {
  const state = window.state;
  const { results, ...stateSnapshot } = state;
  const params = { v: 2, state: stateSnapshot };
  const encoded = btoa(encodeURIComponent(JSON.stringify(params)));
  const url = window.location.origin + window.location.pathname + '#' + encoded;
  navigator.clipboard.writeText(url).then(() => {
    window.showToast('Paylaşım bağlantısı kopyalandı!', 'success');
  }).catch(() => {
    prompt('Bağlantıyı kopyalayın:', url);
  });
}

export function loadFromHash() {
  const state = window.state;
  try {
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    const params = JSON.parse(decodeURIComponent(atob(hash)));
    if (params.v >= 2 && params.state) {
      Object.assign(state, params.state, { results: null, step: 1 });
      if (params.state.cityName) document.getElementById('city-search').value = params.state.cityName;
      if (params.state.roofArea) document.getElementById('roof-area').value = params.state.roofArea;
      if (params.state.tilt !== undefined) { document.getElementById('tilt-slider').value = params.state.tilt; window.updateTilt(params.state.tilt); }
      if (params.state.shadingFactor !== undefined) { document.getElementById('shading-slider').value = params.state.shadingFactor; window.updateShading(params.state.shadingFactor); }
      if (params.state.soilingFactor !== undefined) { document.getElementById('soiling-slider').value = params.state.soilingFactor; window.updateSoiling(params.state.soilingFactor); }
      if (params.state.tariff !== undefined) document.getElementById('tariff-input').value = params.state.tariff;
      if (params.state.exportTariff !== undefined && document.getElementById('export-tariff-input')) document.getElementById('export-tariff-input').value = params.state.exportTariff;
      if (params.state.tariffRegime !== undefined && document.getElementById('tariff-regime')) document.getElementById('tariff-regime').value = params.state.tariffRegime;
      if (params.state.skttTariff !== undefined && document.getElementById('sktt-tariff-input')) document.getElementById('sktt-tariff-input').value = params.state.skttTariff;
      if (params.state.contractedTariff !== undefined && document.getElementById('contracted-tariff-input')) document.getElementById('contracted-tariff-input').value = params.state.contractedTariff;
      if (params.state.contractedPowerKw !== undefined && document.getElementById('contracted-power-input')) document.getElementById('contracted-power-input').value = params.state.contractedPowerKw;
      if (params.state.usdToTry !== undefined && document.getElementById('usd-try-input')) document.getElementById('usd-try-input').value = params.state.usdToTry;
      if (params.state.displayCurrency && document.getElementById('display-currency')) document.getElementById('display-currency').value = params.state.displayCurrency;
      if (params.state.annualPriceIncrease !== undefined && document.getElementById('price-increase-input')) document.getElementById('price-increase-input').value = (params.state.annualPriceIncrease * 100).toFixed(0);
      if (params.state.discountRate !== undefined && document.getElementById('discount-rate-input')) document.getElementById('discount-rate-input').value = (params.state.discountRate * 100).toFixed(0);
      if (params.state.tariffType && document.getElementById('tariff-type')) document.getElementById('tariff-type').value = params.state.tariffType;
      if (window.map && state.lat && state.lon) window.map.setView([state.lat, state.lon], 9);
      if (window.marker && state.lat && state.lon) window.marker.setLatLng([state.lat, state.lon]);
      if (state.cityName) {
        document.getElementById('selected-loc-text').textContent =
          `${state.cityName} — ${parseFloat(state.lat).toFixed(4)}°K, ${parseFloat(state.lon).toFixed(4)}°D (GHI: ${state.ghi})`;
      }
      window.buildPanelCards();
      window.buildInverterCards();
      window.showToast('Paylaşılan tam hesap yüklendi.', 'info');
      return;
    }
    if (params.lat) {
      state.lat = params.lat; state.lon = params.lon;
      state.cityName = params.city; state.ghi = params.ghi;
      if (params.city) document.getElementById('city-search').value = params.city;
      document.getElementById('selected-loc-text').textContent =
        `${params.city} — ${parseFloat(params.lat).toFixed(4)}°K`;
      if (window.map) window.map.setView([params.lat, params.lon], 9);
      if (window.marker) window.marker.setLatLng([params.lat, params.lon]);
    }
    if (params.area) { state.roofArea = params.area; document.getElementById('roof-area').value = params.area; }
    if (params.tilt !== undefined) { state.tilt = params.tilt; document.getElementById('tilt-slider').value = params.tilt; window.updateTilt(params.tilt); }
    if (params.az !== undefined) {
      const dir = COMPASS_DIRS.find(d => d.azimuth === params.az);
      if (dir) window.selectDirection(dir);
    }
    if (params.sh !== undefined) { state.shadingFactor = params.sh; document.getElementById('shading-slider').value = params.sh; window.updateShading(params.sh); }
    if (params.pt) { state.panelType = params.pt; window.buildPanelCards(); }
    window.showToast('Paylaşılan hesap yüklendi.', 'info');
  } catch (e) { /* invalid hash */ }
}

// window'a expose et
window.renderResults = renderResults;
window.renderMonthlyChart = renderMonthlyChart;
window.downloadPDF = downloadPDF;
window.downloadTechnicalPDF = downloadTechnicalPDF;
window.shareResults = shareResults;
window.loadFromHash = loadFromHash;
