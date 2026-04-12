// ═══════════════════════════════════════════════════════════
// DASHBOARD — Karşılaştırmalı Dashboard (Faz E2)
// GüneşHesap v2.0
// ═══════════════════════════════════════════════════════════

const MAX_SAVED = 20;
const STORAGE_KEY = 'guneshesap_saved';

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

function getSaved() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch { return []; }
}

function setSaved(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function saveCurrentCalculation() {
  const state = window.state;
  const r = state.results;
  if (!r) {
    window.showToast('Önce hesaplama yapın.', 'error');
    return;
  }

  const saved = getSaved();
  const record = {
    id: Date.now(),
    timestamp: new Date().toLocaleString('tr-TR'),
    cityName: state.cityName,
    systemPower: r.systemPower,
    panelType: state.panelType,
    annualEnergy: r.annualEnergy,
    totalCost: r.totalCost,
    paybackYear: r.paybackYear,
    roi: r.roi,
    lcoe: r.lcoe,
    npv: r.npvTotal,
    usdToTry: state.usdToTry,
    displayCurrency: state.displayCurrency,
    tilt: state.tilt,
    azimuthName: state.azimuthName
  };

  // FIFO — max 20
  saved.unshift(record);
  if (saved.length > MAX_SAVED) saved.pop();
  setSaved(saved);

  window.showToast('Hesap kaydedildi!', 'success');
  renderDashboard();
}

export function openDashboard() {
  const modal = document.getElementById('dashboard-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  renderDashboard();
}

export function closeDashboard() {
  const modal = document.getElementById('dashboard-modal');
  if (modal) modal.style.display = 'none';
}

export function updateDashboard() {
  const saved = getSaved();
  const btn = document.getElementById('dashboard-btn');
  if (btn) {
    btn.textContent = `Kayıtlı Hesaplar (${saved.length})`;
    btn.style.display = saved.length > 0 ? '' : 'none';
  }
}

function renderDashboard() {
  const saved = getSaved();
  const body = document.getElementById('dashboard-body');
  if (!body) return;

  if (saved.length === 0) {
    body.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:32px">Henüz kaydedilmiş hesap yok.</p>';
    return;
  }

  let selectedIds = [];

  body.innerHTML = `
    <div style="margin-bottom:16px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">
      <span style="font-size:0.85rem;color:var(--text-muted)">Karşılaştırmak için max 3 hesap seçin:</span>
      <button onclick="compareDashboardSelected()" style="background:var(--primary);color:#000;border:none;border-radius:8px;padding:6px 14px;cursor:pointer;font-size:0.82rem;font-weight:600">Karşılaştır</button>
      <button onclick="exportSavedRecords()" style="background:var(--surface-light);color:var(--text);border:none;border-radius:8px;padding:6px 10px;cursor:pointer;font-size:0.82rem">Dışa Aktar</button>
      <label style="background:var(--surface-light);color:var(--text);border:none;border-radius:8px;padding:6px 10px;cursor:pointer;font-size:0.82rem">
        İçe Aktar <input type="file" accept=".json" onchange="importSavedRecords(this.files?.[0])" style="display:none"/>
      </label>
      <button onclick="clearAllSaved()" style="background:var(--surface-light);color:var(--text-muted);border:none;border-radius:8px;padding:6px 10px;cursor:pointer;font-size:0.82rem">Tümünü Sil</button>
    </div>
    <div class="dashboard-list">
      ${saved.map(rec => `
        <div class="dashboard-card" id="dash-card-${rec.id}">
          <div style="display:flex;justify-content:space-between;align-items:flex-start">
            <div>
              <input type="checkbox" id="dash-chk-${rec.id}" value="${rec.id}" style="margin-right:8px;accent-color:var(--primary)"/>
              <strong style="color:var(--primary)">${rec.cityName || '—'}</strong>
              <span style="color:var(--text-muted);font-size:0.78rem;margin-left:8px">${rec.timestamp}</span>
            </div>
            <button onclick="deleteSavedRecord(${rec.id})" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:0.85rem">✕</button>
          </div>
          <div class="dashboard-card-metrics">
            <span>${rec.systemPower?.toFixed(1)} kWp</span>
            <span>${rec.annualEnergy?.toLocaleString('tr-TR')} kWh/yıl</span>
            <span>${money(rec.totalCost)}</span>
            <span>Geri ödeme: ${rec.paybackYear || '>25'} yıl</span>
            <span>LCOE: ${moneyRate(rec.lcoe, 'kWh')}</span>
            <span>ROI: ${rec.roi}%</span>
          </div>
        </div>
      `).join('')}
    </div>
    <div id="dashboard-compare-result" style="margin-top:20px"></div>
  `;

  updateDashboard();
}

export function compareDashboardSelected() {
  const checkboxes = document.querySelectorAll('[id^="dash-chk-"]:checked');
  if (checkboxes.length < 2) {
    window.showToast('En az 2 hesap seçin.', 'error');
    return;
  }

  const saved = getSaved();
  const selectedIds = Array.from(checkboxes).map(c => parseInt(c.value));
  const selected = saved.filter(r => selectedIds.includes(r.id)).slice(0, 3);

  const resultEl = document.getElementById('dashboard-compare-result');
  if (!resultEl) return;

  const metrics = [
    ['Şehir', r => r.cityName],
    ['Sistem (kWp)', r => r.systemPower?.toFixed(2)],
    ['Yıllık Üretim (kWh)', r => r.annualEnergy?.toLocaleString('tr-TR')],
    ['Toplam Maliyet', r => money(r.totalCost)],
    ['Geri Ödeme (yıl)', r => r.paybackYear || '>25'],
    ['LCOE', r => moneyRate(r.lcoe, 'kWh')],
    ['ROI (%)', r => r.roi],
    ['NPV', r => money(r.npv)],
    ['Eğim', r => r.tilt + '°'],
    ['Yön', r => r.azimuthName],
  ];

  resultEl.innerHTML = `
    <h4 style="color:var(--primary);margin-bottom:12px">Karşılaştırma Sonuçları</h4>
    <table class="comp-table">
      <thead>
        <tr>
          <th>Metrik</th>
          ${selected.map((r, i) => `<th>${r.cityName || 'Hesap ' + (i+1)}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${metrics.map(([label, fn]) => `
          <tr>
            <td>${label}</td>
            ${selected.map(r => `<td>${fn(r) || '—'}</td>`).join('')}
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

export function deleteSavedRecord(id) {
  const saved = getSaved().filter(r => r.id !== id);
  setSaved(saved);
  renderDashboard();
}

export function clearAllSaved() {
  localStorage.removeItem(STORAGE_KEY);
  renderDashboard();
}

export function exportSavedRecords() {
  const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), records: getSaved() }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'guneshesap-kayitlar.json';
  a.click();
  URL.revokeObjectURL(url);
}

export function importSavedRecords(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result || '{}'));
      const incoming = Array.isArray(parsed.records) ? parsed.records : [];
      const merged = [...incoming, ...getSaved()].slice(0, MAX_SAVED);
      setSaved(merged);
      renderDashboard();
      window.showToast?.('Kayıtlar içe aktarıldı.', 'success');
    } catch {
      window.showToast?.('Kayıt dosyası okunamadı.', 'error');
    }
  };
  reader.readAsText(file);
}

// window'a expose et
window.saveCurrentCalculation = saveCurrentCalculation;
window.openDashboard = openDashboard;
window.closeDashboard = closeDashboard;
window.updateDashboard = updateDashboard;
window.compareDashboardSelected = compareDashboardSelected;
window.deleteSavedRecord = deleteSavedRecord;
window.clearAllSaved = clearAllSaved;
window.exportSavedRecords = exportSavedRecords;
window.importSavedRecords = importSavedRecords;
