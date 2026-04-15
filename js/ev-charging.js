// ═══════════════════════════════════════════════════════════
// EV CHARGING — Elektrikli Araç Şarj Entegrasyonu (Faz C2)
// Solar Rota v2.0
// ═══════════════════════════════════════════════════════════
import { EV_MODELS } from './data.js';

export function buildEVModels() {
  const sel = document.getElementById('ev-type');
  if (!sel) return;
  sel.innerHTML = Object.entries(EV_MODELS).map(([key, m]) =>
    `<option value="${key}">${m.brand} — ${m.name} (${m.kwh100} kWh/100km)</option>`
  ).join('');
  // Varsayılan olarak ilk modeli yükle
  onEVModelChange();
}

export function onEVModelChange() {
  const sel = document.getElementById('ev-type');
  const key = sel?.value;
  const model = EV_MODELS[key];
  if (!model) return;

  const customGroup = document.getElementById('ev-custom-group');
  if (customGroup) customGroup.style.display = key === 'custom' ? 'block' : 'none';

  // Otomatik tüketim ve bilgi doldur
  const kwhEl = document.getElementById('ev-kwh100');
  if (kwhEl) kwhEl.value = model.kwh100;

  const chargeKwEl = document.getElementById('ev-charge-kw');
  if (chargeKwEl) chargeKwEl.value = model.chargeKw;

  const infoEl = document.getElementById('ev-model-info');
  if (infoEl && key !== 'custom') {
    const chargeHours = (model.batteryKwh / model.chargeKw).toFixed(1);
    infoEl.innerHTML = `
      <div style="display:flex;gap:12px;flex-wrap:wrap;font-size:0.78rem;color:var(--text-muted);margin-top:8px">
        <span>Batarya: <strong style="color:var(--text)">${model.batteryKwh} kWh</strong></span>
        <span>Şarj gücü: <strong style="color:var(--text)">${model.chargeKw} kW AC</strong></span>
        <span>Tam şarj: <strong style="color:var(--text)">~${chargeHours} saat</strong></span>
        <span>Menzil: <strong style="color:var(--text)">${model.range} km</strong></span>
      </div>`;
  } else if (infoEl) {
    infoEl.innerHTML = '';
  }

  updateEVPreview();
}

export function toggleEVBlock() {
  const tog = document.getElementById('ev-toggle');
  if (tog) { tog.checked = !tog.checked; onEVToggle(tog.checked); }
}

export function onEVToggle(checked) {
  const state = window.state;
  state.evEnabled = checked;
  const block = document.getElementById('ev-block');
  if (block) block.style.display = checked ? 'block' : 'none';
  if (checked) {
    if (!state.ev) state.ev = {};
    buildEVModels();
    updateEVInput();
  }
}

export function updateEVInput() {
  const state = window.state;
  if (!state.ev) state.ev = {};

  const dailyKm = parseFloat(document.getElementById('ev-daily-km')?.value) || 50;
  const key = document.getElementById('ev-type')?.value || 'togg_t10f';
  const model = EV_MODELS[key] || EV_MODELS['custom'];

  let kwh100 = model.kwh100;
  if (key === 'custom') {
    kwh100 = parseFloat(document.getElementById('ev-kwh100')?.value) || 18;
  }

  const chargeTime = document.getElementById('ev-charge-time')?.value || 'day';
  const fuelPrice = parseFloat(document.getElementById('ev-fuel-price')?.value) || 45;
  const fuelL100 = parseFloat(document.getElementById('ev-fuel-l100')?.value) || 8;

  state.ev.dailyKm = dailyKm;
  state.ev.vehicleType = key;
  state.ev.consumptionPer100km = kwh100;
  state.ev.chargeTime = chargeTime;
  state.ev.fuelPricePerLiter = fuelPrice;
  state.ev.fuelConsumptionL100km = fuelL100;
  state.ev.chargeKw = parseFloat(document.getElementById('ev-charge-kw')?.value) || model.chargeKw;

  updateEVPreview();
}

function updateEVPreview() {
  const state = window.state;
  const ev = state.ev;
  if (!ev) return;

  const daily_kWh = ev.dailyKm * ev.consumptionPer100km / 100;
  const annual_kWh = daily_kWh * 365;
  const fuelSaved_L = ev.dailyKm / 100 * ev.fuelConsumptionL100km * 365;
  const fuelSaved_TL = Math.round(fuelSaved_L * (ev.fuelPricePerLiter || 45));
  const co2Saved = (fuelSaved_L * 2.31 / 1000).toFixed(1); // ton CO₂/yıl (benzin: 2.31 kg/L)

  const prevEl = document.getElementById('ev-preview');
  if (prevEl) {
    prevEl.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px;margin-top:10px">
        <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border-subtle);border-radius:8px;padding:10px;text-align:center">
          <div style="font-size:1.2rem;font-weight:700;color:var(--accent)">${daily_kWh.toFixed(1)} kWh</div>
          <div style="font-size:0.72rem;color:var(--text-muted)">Günlük şarj ihtiyacı</div>
        </div>
        <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border-subtle);border-radius:8px;padding:10px;text-align:center">
          <div style="font-size:1.2rem;font-weight:700;color:var(--accent)">${Math.round(annual_kWh).toLocaleString('tr-TR')} kWh</div>
          <div style="font-size:0.72rem;color:var(--text-muted)">Yıllık şarj tüketimi</div>
        </div>
        <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border-subtle);border-radius:8px;padding:10px;text-align:center">
          <div style="font-size:1.2rem;font-weight:700;color:var(--success)">${fuelSaved_TL.toLocaleString('tr-TR')} ₺</div>
          <div style="font-size:0.72rem;color:var(--text-muted)">Yıllık yakıt tasarrufu</div>
        </div>
        <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border-subtle);border-radius:8px;padding:10px;text-align:center">
          <div style="font-size:1.2rem;font-weight:700;color:var(--success)">${co2Saved} t</div>
          <div style="font-size:0.72rem;color:var(--text-muted)">CO₂ azaltımı (yıllık)</div>
        </div>
      </div>`;
  }
}

// window'a expose et
window.toggleEVBlock = toggleEVBlock;
window.onEVToggle = onEVToggle;
window.updateEVInput = updateEVInput;
window.onEVModelChange = onEVModelChange;
window.buildEVModels = buildEVModels;
