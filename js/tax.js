// ═══════════════════════════════════════════════════════════
// TAX — Vergi Avantajı Hesabı (Faz D3)
// GüneşHesap v2.0
// ═══════════════════════════════════════════════════════════

export function toggleTaxBlock() {
  const tog = document.getElementById('tax-toggle');
  if (tog) { tog.checked = !tog.checked; onTaxToggle(tog.checked); }
}

export function onTaxToggle(checked) {
  const state = window.state;
  state.taxEnabled = checked;
  const block = document.getElementById('tax-block');
  if (block) block.style.display = checked ? 'block' : 'none';
  if (checked && !state.tax) {
    state.tax = {
      corporateTaxRate: 25,
      amortizationYears: 10,
      kdvRecovery: true,
      investmentDeduction: false
    };
    updateTaxPreview();
  }
}

export function updateTaxInput() {
  const state = window.state;
  if (!state.tax) state.tax = {};

  state.tax.corporateTaxRate = parseFloat(document.getElementById('tax-rate')?.value) || 25;
  state.tax.amortizationYears = parseInt(document.getElementById('tax-amort')?.value) || 10;
  state.tax.kdvRecovery = document.getElementById('tax-kdv')?.checked ?? true;
  state.tax.investmentDeduction = document.getElementById('tax-invest')?.checked ?? false;

  updateTaxPreview();
}

function updateTaxPreview() {
  const state = window.state;
  const tax = state.tax;
  if (!tax || !state.results) return;

  const totalCost = state.results.totalCost;
  const annual_dep = Math.round(totalCost / tax.amortizationYears);
  const tax_shield = Math.round(annual_dep * tax.corporateTaxRate / 100);
  const kdv = tax.kdvRecovery ? Math.round(totalCost * 0.20) : 0;

  const prevEl = document.getElementById('tax-preview');
  if (prevEl) {
    prevEl.textContent = `Yıllık amortisman: ${annual_dep.toLocaleString('tr-TR')} TL | Yıllık vergi kalkanı: ${tax_shield.toLocaleString('tr-TR')} TL | KDV iadesi: ${kdv.toLocaleString('tr-TR')} TL`;
  }
}

// window'a expose et
window.toggleTaxBlock = toggleTaxBlock;
window.onTaxToggle = onTaxToggle;
window.updateTaxInput = updateTaxInput;
