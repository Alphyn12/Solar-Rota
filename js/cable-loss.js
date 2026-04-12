// ═══════════════════════════════════════════════════════════
// CABLE LOSS — Kablo Kayıp Hesabı (Faz B4)
// GüneşHesap v2.0
// ═══════════════════════════════════════════════════════════

import { calculateSystemLayout } from './calc-core.js';

const RHO_CU = 0.0175; // Bakır özdirenç (Ω·mm²/m) @ 20°C

export function calculateCableLoss(dcLength, dcSection, acLength, systemPowerKWp, acSection = 6, phaseMode = 'three', cosPhi = 0.98, tempC = 40) {
  const P_stc = systemPowerKWp * 1000; // W
  const V_mpp = 600; // tipik string voltajı (V)
  const I_dc = P_stc / V_mpp;
  const tempFactor = 1 + 0.00393 * (tempC - 20);
  const rho = RHO_CU * tempFactor;

  // DC kablo direnci (gidiş-dönüş)
  const R_dc = rho * dcLength * 2 / dcSection;
  const P_loss_dc = I_dc * I_dc * R_dc;
  const dcLossPct = (P_loss_dc / P_stc * 100);

  const isThreePhase = phaseMode === 'three';
  const V_ac = isThreePhase ? 400 : 230;
  const I_ac = isThreePhase
    ? P_stc / (Math.sqrt(3) * V_ac * cosPhi)
    : P_stc / (V_ac * cosPhi);
  const R_ac = rho * acLength * (isThreePhase ? 1 : 2) / acSection;
  const P_loss_ac = isThreePhase ? 3 * I_ac * I_ac * R_ac : I_ac * I_ac * R_ac;
  const acLossPct = (P_loss_ac / P_stc * 100);

  const totalLossPctRaw = dcLossPct + acLossPct;
  const warnings = [];
  if (totalLossPctRaw > 3) warnings.push('Toplam kablo kaybı %3 üzerinde; kesit veya güzergah revize edilmeli.');
  if (totalLossPctRaw > 5) warnings.push('Toplam kablo kaybı %5 üzerinde; bu değer hesapta kırpılmadı, tasarım hatası olabilir.');

  return {
    R_dc: R_dc.toFixed(4),
    I_dc: I_dc.toFixed(2),
    P_loss_dc: P_loss_dc.toFixed(1),
    dcLossPct: dcLossPct.toFixed(2),
    V_ac,
    I_ac: I_ac.toFixed(2),
    phaseMode,
    cosPhi,
    tempC,
    P_loss_ac: P_loss_ac.toFixed(1),
    acLossPct: acLossPct.toFixed(2),
    totalLossPct: totalLossPctRaw.toFixed(2),
    warnings
  };
}

export function updateCableLoss() {
  const state = window.state;
  const dcLength = parseFloat(document.getElementById('cable-dc-length')?.value) || 0;
  const dcSection = parseFloat(document.getElementById('cable-dc-section')?.value) || 6;
  const acLength = parseFloat(document.getElementById('cable-ac-length')?.value) || 0;
  const acSection = parseFloat(document.getElementById('cable-ac-section')?.value) || 6;
  const phaseMode = document.getElementById('cable-phase-mode')?.value || (state.roofArea >= 10 ? 'three' : 'single');
  const cosPhi = parseFloat(document.getElementById('cable-cosphi')?.value) || 0.98;
  const tempC = parseFloat(document.getElementById('cable-temp')?.value) || 40;

  if (dcLength <= 0) {
    const resultEl = document.getElementById('cable-loss-result');
    if (resultEl) resultEl.style.display = 'none';
    state.cableLoss = null;
    return;
  }

  const systemPower = calculateSystemLayout(state).systemPower || 5;

  const loss = calculateCableLoss(dcLength, dcSection, acLength, systemPower, acSection, phaseMode, cosPhi, tempC);
  state.cableLoss = loss;
  state.cableLossEnabled = true;

  const resultEl = document.getElementById('cable-loss-result');
  if (resultEl) {
    resultEl.style.display = 'block';
    resultEl.innerHTML = `
      <div class="cable-loss-grid">
        <div class="cable-loss-item">
          <span class="cable-loss-label">DC Direnç</span>
          <span class="cable-loss-val">${loss.R_dc} Ω</span>
        </div>
        <div class="cable-loss-item">
          <span class="cable-loss-label">DC Akım</span>
          <span class="cable-loss-val">${loss.I_dc} A</span>
        </div>
        <div class="cable-loss-item">
          <span class="cable-loss-label">DC Kayıp</span>
          <span class="cable-loss-val" style="color:var(--danger)">%${loss.dcLossPct}</span>
        </div>
        <div class="cable-loss-item">
          <span class="cable-loss-label">AC Kayıp</span>
          <span class="cable-loss-val" style="color:var(--danger)">%${loss.acLossPct}</span>
        </div>
        <div class="cable-loss-item">
          <span class="cable-loss-label">AC Faz / Gerilim</span>
          <span class="cable-loss-val">${loss.phaseMode === 'three' ? '3 Faz' : '1 Faz'} / ${loss.V_ac} V</span>
        </div>
        <div class="cable-loss-item">
          <span class="cable-loss-label">AC Akım</span>
          <span class="cable-loss-val">${loss.I_ac} A</span>
        </div>
        <div class="cable-loss-item" style="grid-column:1/-1">
          <span class="cable-loss-label">Toplam Kablo Kaybı</span>
          <span class="cable-loss-val" style="color:${parseFloat(loss.totalLossPct) > 2 ? 'var(--danger)' : '#F59E0B'};font-size:1rem;font-weight:700">%${loss.totalLossPct}</span>
        </div>
      </div>
      ${loss.warnings.length ? `<div style="font-size:0.75rem;color:var(--danger);margin-top:8px">${loss.warnings.join('<br>')}</div>` : ''}
      <div style="font-size:0.75rem;color:var(--text-muted);margin-top:8px">
        ρ_Cu = ${RHO_CU} Ω·mm²/m @20°C | Sıcaklık: ${loss.tempC}°C | cosφ=${loss.cosPhi} | Sistem gücü: ${systemPower.toFixed(2)} kWp
      </div>
    `;
  }
}

export function toggleCableLossBlock() {
  const tog = document.getElementById('cable-toggle');
  if (tog) { tog.checked = !tog.checked; onCableLossToggle(tog.checked); }
}

export function onCableLossToggle(checked) {
  const state = window.state;
  state.cableLossEnabled = checked;
  const block = document.getElementById('cable-loss-block');
  if (block) block.style.display = checked ? 'block' : 'none';
  if (!checked) state.cableLoss = null;
}

// window'a expose et
window.updateCableLoss = updateCableLoss;
window.toggleCableLossBlock = toggleCableLossBlock;
window.onCableLossToggle = onCableLossToggle;
