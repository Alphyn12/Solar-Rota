// ═══════════════════════════════════════════════════════════
// HEAT PUMP — Isı Pompası Entegrasyonu (Faz C3)
// GüneşHesap v2.0
// ═══════════════════════════════════════════════════════════
import { HEAT_PUMP_DATA } from './data.js';

export function toggleHeatPumpBlock() {
  const tog = document.getElementById('hp-toggle');
  if (tog) { tog.checked = !tog.checked; onHeatPumpToggle(tog.checked); }
}

export function onHeatPumpToggle(checked) {
  const state = window.state;
  state.heatPumpEnabled = checked;
  const block = document.getElementById('hp-block');
  if (block) block.style.display = checked ? 'block' : 'none';
  if (checked && !state.heatPump) {
    state.heatPump = {
      area: 120,
      insulation: 'avg',
      heatingType: 'both',
      currentHeating: 'gas'
    };
    updateHeatPumpPreview();
  }
}

export function updateHeatPumpInput() {
  const state = window.state;
  if (!state.heatPump) state.heatPump = {};

  state.heatPump.area = parseFloat(document.getElementById('hp-area')?.value) || 120;
  state.heatPump.insulation = document.getElementById('hp-insulation')?.value || 'avg';
  state.heatPump.heatingType = document.getElementById('hp-type')?.value || 'both';
  state.heatPump.currentHeating = document.getElementById('hp-current')?.value || 'gas';

  updateHeatPumpPreview();
}

function updateHeatPumpPreview() {
  const state = window.state;
  const hp = state.heatPump;
  if (!hp) return;

  const heatLoad = HEAT_PUMP_DATA.heat_load[hp.insulation] || 80;
  const annualDemand = hp.area * heatLoad;
  const cop = HEAT_PUMP_DATA.cop_heating[hp.insulation] || 3.5;
  const elecNeeded = Math.round(annualDemand / cop);

  const prevEl = document.getElementById('hp-preview');
  if (prevEl) {
    prevEl.textContent = `Yıllık ısıtma talebi: ${Math.round(annualDemand).toLocaleString('tr-TR')} kWh | COP: ${cop} | Elektrik ihtiyacı: ${elecNeeded.toLocaleString('tr-TR')} kWh/yıl`;
  }
}

// window'a expose et
window.toggleHeatPumpBlock = toggleHeatPumpBlock;
window.onHeatPumpToggle = onHeatPumpToggle;
window.updateHeatPumpInput = updateHeatPumpInput;
