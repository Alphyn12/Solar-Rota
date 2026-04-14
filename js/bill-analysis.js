// ═══════════════════════════════════════════════════════════
// BILL ANALYSIS — Elektrik Fatura Analizi (Faz B2)
// GüneşHesap v2.0
// ═══════════════════════════════════════════════════════════
import { MONTHS } from './data.js';
import { COMMON_YEAR_MONTH_DAYS } from './calc-core.js';

const SEASON_WEIGHTS = [0.7, 0.75, 0.9, 1.0, 1.1, 1.2, 1.25, 1.2, 1.0, 0.9, 0.75, 0.65];

export function initBillAnalysis() {
  const state = window.state;
  const wrap = document.getElementById('bill-inputs-wrap');
  if (!wrap) return;

  wrap.innerHTML = `
    <div class="bill-grid">
      ${MONTHS.map((m, i) => `
        <div class="bill-month-input">
          <label>${m}</label>
          <input type="number" id="bill-${i}" min="0" max="5000" placeholder="kWh"
            value="${state.monthlyConsumption ? state.monthlyConsumption[i] : ''}"
            oninput="onBillInput()"
            style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:6px 10px;color:var(--text);width:100%;font-size:0.85rem"/>
        </div>
      `).join('')}
    </div>
    <div style="display:flex;gap:10px;margin-top:12px;align-items:center">
      <label style="font-size:0.85rem;color:var(--text-muted)">Hızlı Doldur:</label>
      <input type="number" id="bill-avg-input" placeholder="Aylık ort. kWh" min="0" max="5000"
        style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:6px 10px;color:var(--text);width:130px;font-size:0.85rem"/>
      <button onclick="billQuickFill()" style="background:var(--primary);color:#000;border:none;border-radius:8px;padding:6px 14px;cursor:pointer;font-size:0.82rem;font-weight:600">Dağıt</button>
      <button onclick="billClear()" style="background:var(--surface-light);color:var(--text-muted);border:none;border-radius:8px;padding:6px 10px;cursor:pointer;font-size:0.82rem">Temizle</button>
    </div>
    <div id="bill-summary" style="margin-top:10px;font-size:0.82rem;color:var(--text-muted)"></div>
    <div style="margin-top:12px;border-top:1px solid var(--border);padding-top:12px">
      <label style="font-size:0.85rem;color:var(--text-muted);display:block;margin-bottom:6px">8760 Saat CSV Yükle (tek sütun kWh veya virgüllü/satırlı değerler)</label>
      <input type="file" id="load-8760-input" accept=".csv,.txt" onchange="import8760Csv(this.files?.[0])"
        style="font-size:0.8rem;color:var(--text-muted);max-width:100%"/>
    </div>
  `;

  onBillInput();
}

export function import8760Csv(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const text = String(reader.result || '');
    const values = text
      .split(/[\s,;]+/)
      .map(v => Number(String(v).replace(',', '.')))
      .filter(v => Number.isFinite(v) && v >= 0);
    if (values.length !== 8760) {
      window.showToast?.(`CSV tam 8760 saatlik tüketim değeri içermeli. Bulunan: ${values.length.toLocaleString('tr-TR')}.`, 'error');
      return;
    }
    if (values.reduce((a, b) => a + b, 0) <= 0) {
      window.showToast?.('CSV tüketim profili sıfırdan büyük toplam kWh içermeli.', 'error');
      return;
    }
    let cursor = 0;
    const monthly = COMMON_YEAR_MONTH_DAYS.map(days => {
      const hours = days * 24;
      const sum = values.slice(cursor, cursor + hours).reduce((a, b) => a + b, 0);
      cursor += hours;
      return Math.round(sum);
    });
    window.state.monthlyConsumption = monthly;
    window.state.hourlyConsumption8760 = values;
    window.state.dailyConsumption = monthly.reduce((a, b) => a + b, 0) / 365;
    MONTHS.forEach((_, i) => {
      const el = document.getElementById(`bill-${i}`);
      if (el) el.value = monthly[i] || 0;
    });
    onBillInput({ preserveHourly: true });
    window.showToast?.('8760 saatlik tüketim profili içe aktarıldı.', 'success');
  };
  reader.readAsText(file);
}

export function onBillInput({ preserveHourly = false } = {}) {
  const state = window.state;
  let hasAnyInput = false;
  const values = MONTHS.map((_, i) => {
    const el = document.getElementById(`bill-${i}`);
    if (el && String(el.value).trim() !== '') hasAnyInput = true;
    return el ? (parseFloat(el.value) || 0) : 0;
  });
  const total = values.reduce((a, b) => a + b, 0);
  state.monthlyConsumption = hasAnyInput && total > 0 ? values : null;
  if (!preserveHourly) state.hourlyConsumption8760 = null;

  const daily = total > 0 ? (total / 365).toFixed(2) : 0;

  const summaryEl = document.getElementById('bill-summary');
  if (summaryEl && total > 0) {
    summaryEl.textContent = `Toplam: ${total.toLocaleString('tr-TR')} kWh/yıl | Ortalama: ${daily} kWh/gün`;
    // Günlük tüketimi güncelle
    if (daily > 0) {
      state.dailyConsumption = parseFloat(daily);
      const consEl = document.getElementById('consumption-val');
      if (consEl) consEl.textContent = daily + ' kWh/gün';
    }
  } else if (summaryEl) {
    summaryEl.textContent = '';
  }
}

export function billQuickFill() {
  const avg = parseFloat(document.getElementById('bill-avg-input')?.value) || 0;
  if (avg <= 0) return;

  MONTHS.forEach((_, i) => {
    const el = document.getElementById(`bill-${i}`);
    if (el) el.value = Math.round(avg * SEASON_WEIGHTS[i]);
  });
  onBillInput();
}

export function billClear() {
  MONTHS.forEach((_, i) => {
    const el = document.getElementById(`bill-${i}`);
    if (el) el.value = '';
  });
  const state = window.state;
  state.monthlyConsumption = null;
  state.hourlyConsumption8760 = null;
  const summaryEl = document.getElementById('bill-summary');
  if (summaryEl) summaryEl.textContent = '';
}

export function toggleBillBlock() {
  const tog = document.getElementById('bill-toggle');
  if (tog) { tog.checked = !tog.checked; onBillToggle(tog.checked); }
}

export function onBillToggle(checked) {
  const state = window.state;
  state.billAnalysisEnabled = checked;
  const block = document.getElementById('bill-inputs-block');
  if (block) block.style.display = checked ? 'block' : 'none';
  if (checked) initBillAnalysis();
}

// window'a expose et
window.toggleBillBlock = toggleBillBlock;
window.onBillToggle = onBillToggle;
window.onBillInput = onBillInput;
window.billQuickFill = billQuickFill;
window.billClear = billClear;
window.import8760Csv = import8760Csv;
