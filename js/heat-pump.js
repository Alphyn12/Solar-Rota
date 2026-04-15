// ═══════════════════════════════════════════════════════════
// HEAT PUMP — Isı Pompası Entegrasyonu (Faz C3)
// Solar Rota v2.0
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

  const ins = hp.insulation || 'avg';
  const heatLoad = HEAT_PUMP_DATA.heat_load[ins] || 70;          // W/m²
  const spfH = HEAT_PUMP_DATA.spf_heating[ins] || 3.2;           // Seasonal PF heating
  const spfC = HEAT_PUMP_DATA.spf_cooling[ins] || 3.5;           // Seasonal PF cooling
  const heatingMonths = HEAT_PUMP_DATA.heating_season_months;
  const coolingMonths = HEAT_PUMP_DATA.cooling_season_months;

  // Yıllık ısıtma talebi (kWh) = alan × yük × günlük_saat × ay_sayısı × gün
  const annualHeatDemand = hp.area * heatLoad * 8 * heatingMonths * 30 / 1000; // kWh
  const annualCoolDemand = hp.area * (heatLoad * 0.7) * 8 * coolingMonths * 30 / 1000;

  const doHeating = hp.heatingType === 'heat' || hp.heatingType === 'both';
  const doCooling = hp.heatingType === 'cool' || hp.heatingType === 'both';

  const elecHeating = doHeating ? Math.round(annualHeatDemand / spfH) : 0;
  const elecCooling = doCooling ? Math.round(annualCoolDemand / spfC) : 0;
  const totalElec = elecHeating + elecCooling;

  // Mevcut yakıt maliyeti
  let currentCost = 0;
  const elecPrice = HEAT_PUMP_DATA.electric_price;
  if (hp.currentHeating === 'gas' && doHeating) {
    const gasM3 = annualHeatDemand / HEAT_PUMP_DATA.gas_kwh_per_m3;
    currentCost = gasM3 * HEAT_PUMP_DATA.gas_price;
  } else if (hp.currentHeating === 'fueloil' && doHeating) {
    const liters = annualHeatDemand / HEAT_PUMP_DATA.fuel_oil_kwh_per_liter;
    currentCost = liters * HEAT_PUMP_DATA.fuel_oil_price;
  } else if (hp.currentHeating === 'electric') {
    currentCost = annualHeatDemand * elecPrice;
  }

  const hpElecCost = totalElec * elecPrice;
  const annualSaving = Math.round(currentCost - hpElecCost);

  // CO₂ azaltımı (doğalgaz: 0.202 kg CO₂/kWh termal, elektrik şebeke: 0.420 kg CO₂/kWh)
  const co2Before = doHeating ? (annualHeatDemand * 0.202) / 1000 : 0; // ton
  const co2After = (totalElec * 0.420) / 1000; // ton
  const co2Saved = Math.max(0, co2Before - co2After).toFixed(1);

  const prevEl = document.getElementById('hp-preview');
  if (prevEl) {
    prevEl.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-top:10px">
        <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border-subtle);border-radius:8px;padding:10px;text-align:center">
          <div style="font-size:1.1rem;font-weight:700;color:var(--accent)">${totalElec.toLocaleString('tr-TR')} kWh</div>
          <div style="font-size:0.7rem;color:var(--text-muted)">Yıllık elektrik ihtiyacı</div>
        </div>
        <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border-subtle);border-radius:8px;padding:10px;text-align:center">
          <div style="font-size:1.1rem;font-weight:700;color:var(--text)">SPF ${spfH.toFixed(1)} / ${spfC.toFixed(1)}</div>
          <div style="font-size:0.7rem;color:var(--text-muted)">Isıtma / soğutma SPF</div>
        </div>
        <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border-subtle);border-radius:8px;padding:10px;text-align:center">
          <div style="font-size:1.1rem;font-weight:700;color:${annualSaving >= 0 ? 'var(--success)' : '#EF4444'}">${annualSaving >= 0 ? '+' : ''}${annualSaving.toLocaleString('tr-TR')} ₺</div>
          <div style="font-size:0.7rem;color:var(--text-muted)">Yıllık yakıt tasarrufu</div>
        </div>
        <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border-subtle);border-radius:8px;padding:10px;text-align:center">
          <div style="font-size:1.1rem;font-weight:700;color:var(--success)">${co2Saved} t</div>
          <div style="font-size:0.7rem;color:var(--text-muted)">CO₂ azaltımı (yıllık)</div>
        </div>
      </div>
      <div style="font-size:0.75rem;color:var(--text-muted);margin-top:8px;padding:8px;background:rgba(255,255,255,0.02);border-radius:6px">
        Isıtma talebi: <strong>${Math.round(annualHeatDemand).toLocaleString('tr-TR')} kWh/yıl</strong>
        ${doCooling ? ` | Soğutma: <strong>${Math.round(annualCoolDemand).toLocaleString('tr-TR')} kWh/yıl</strong>` : ''}
        | Mevcut yakıt maliyeti: <strong>${Math.round(currentCost).toLocaleString('tr-TR')} ₺/yıl</strong>
      </div>`;
  }
}

// window'a expose et
window.toggleHeatPumpBlock = toggleHeatPumpBlock;
window.onHeatPumpToggle = onHeatPumpToggle;
window.updateHeatPumpInput = updateHeatPumpInput;
