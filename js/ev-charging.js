// ═══════════════════════════════════════════════════════════
// EV CHARGING — Elektrikli Araç Şarj Entegrasyonu (Faz C2)
// GüneşHesap v2.0
// ═══════════════════════════════════════════════════════════

export function toggleEVBlock() {
  const tog = document.getElementById('ev-toggle');
  if (tog) { tog.checked = !tog.checked; onEVToggle(tog.checked); }
}

export function onEVToggle(checked) {
  const state = window.state;
  state.evEnabled = checked;
  const block = document.getElementById('ev-block');
  if (block) block.style.display = checked ? 'block' : 'none';
  if (checked && !state.ev) {
    state.ev = {
      dailyKm: 50,
      vehicleType: 'sedan',
      consumptionPer100km: 18,
      chargeTime: 'day',
      fuelPricePerLiter: 45,
      fuelConsumptionL100km: 8
    };
    updateEVPreview();
  }
}

export function updateEVInput() {
  const state = window.state;
  if (!state.ev) state.ev = {};

  const dailyKm = parseFloat(document.getElementById('ev-daily-km')?.value) || 50;
  const vtype = document.getElementById('ev-type')?.value || 'sedan';
  const chargeTime = document.getElementById('ev-charge-time')?.value || 'day';

  const consumption = { sedan: 18, suv: 22, custom: parseFloat(document.getElementById('ev-custom-kwh')?.value) || 18 };
  const customEl = document.getElementById('ev-custom-group');
  if (customEl) customEl.style.display = vtype === 'custom' ? 'block' : 'none';

  state.ev.dailyKm = dailyKm;
  state.ev.vehicleType = vtype;
  state.ev.consumptionPer100km = consumption[vtype] || 18;
  state.ev.chargeTime = chargeTime;

  updateEVPreview();
}

function updateEVPreview() {
  const state = window.state;
  const ev = state.ev;
  if (!ev) return;

  const daily_kWh = ev.dailyKm * ev.consumptionPer100km / 100;
  const annual_kWh = daily_kWh * 365;

  const prevEl = document.getElementById('ev-preview');
  if (prevEl) {
    prevEl.textContent = `Günlük EV ihtiyacı: ${daily_kWh.toFixed(1)} kWh | Yıllık: ${Math.round(annual_kWh).toLocaleString('tr-TR')} kWh`;
  }
}

// window'a expose et
window.toggleEVBlock = toggleEVBlock;
window.onEVToggle = onEVToggle;
window.updateEVInput = updateEVInput;
