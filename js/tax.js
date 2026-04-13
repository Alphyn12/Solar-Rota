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
      investmentContribution: 0,
      hasIncentiveCert: false
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
  state.tax.investmentContribution = parseFloat(document.getElementById('tax-invest-rate')?.value) || 0;
  state.tax.hasIncentiveCert = document.getElementById('tax-incentive-cert')?.checked ?? false;

  updateTaxPreview();
}

function updateTaxPreview() {
  const state = window.state;
  const tax = state.tax;
  if (!tax || !state.results) return;

  const totalCost = state.results.totalCost || 0;
  if (totalCost <= 0) return;

  const amortYears = tax.amortizationYears || 10;
  const kvRate = (tax.corporateTaxRate || 25) / 100;
  const annual_dep = totalCost / amortYears;
  const annual_shield = annual_dep * kvRate;
  const kdv = tax.kdvRecovery ? totalCost * 0.20 : 0;
  const investContrib = tax.hasIncentiveCert ? totalCost * ((tax.investmentContribution || 0) / 100) : 0;
  const cumulative10 = annual_shield * amortYears + kdv + investContrib;

  // Yıl bazlı tablo (10 yıl)
  const rows = Array.from({ length: amortYears }, (_, i) => {
    const year = i + 1;
    const cumShield = annual_shield * year;
    return `<tr>
      <td style="padding:5px 10px;border-bottom:1px solid rgba(71,85,105,0.2)">${year}</td>
      <td style="padding:5px 10px;border-bottom:1px solid rgba(71,85,105,0.2)">${Math.round(annual_dep).toLocaleString('tr-TR')} ₺</td>
      <td style="padding:5px 10px;border-bottom:1px solid rgba(71,85,105,0.2)">${Math.round(annual_shield).toLocaleString('tr-TR')} ₺</td>
      <td style="padding:5px 10px;border-bottom:1px solid rgba(71,85,105,0.2);color:var(--success)">${Math.round(cumShield).toLocaleString('tr-TR')} ₺</td>
    </tr>`;
  }).join('');

  const prevEl = document.getElementById('tax-preview');
  if (prevEl) {
    prevEl.innerHTML = `
      <div style="background:rgba(245,158,11,0.05);border:1px solid rgba(245,158,11,0.2);border-radius:8px;padding:12px;margin-bottom:12px;font-size:0.78rem;line-height:1.7">
        <div style="font-weight:600;color:var(--primary);margin-bottom:6px">Mevzuat Dayanakları</div>
        <div>• <strong>KDV İadesi</strong> → 3065 Sayılı KDV Kanunu Md. 13/ı (yenilenebilir enerji istisnası)</div>
        <div>• <strong>Amortisman</strong> → 213 Sayılı VUK + Amort. Listesi No. 3-b (yenilenebilir enerji tesisi, 10 yıl)</div>
        <div>• <strong>Yatırım Katkısı</strong> → 5520 Sayılı KVK Md. 32/A — Yatırım Teşvik Belgesi ile Bölge 1–6 arası %15–45</div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px;margin-bottom:14px">
        <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border-subtle);border-radius:8px;padding:10px;text-align:center">
          <div style="font-size:1.1rem;font-weight:700;color:var(--success)">${Math.round(kdv).toLocaleString('tr-TR')} ₺</div>
          <div style="font-size:0.7rem;color:var(--text-muted)">KDV iadesi (tek seferlik)</div>
        </div>
        <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border-subtle);border-radius:8px;padding:10px;text-align:center">
          <div style="font-size:1.1rem;font-weight:700;color:var(--accent)">${Math.round(annual_shield).toLocaleString('tr-TR')} ₺</div>
          <div style="font-size:0.7rem;color:var(--text-muted)">Yıllık vergi kalkanı</div>
        </div>
        <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border-subtle);border-radius:8px;padding:10px;text-align:center">
          <div style="font-size:1.1rem;font-weight:700;color:var(--primary)">${Math.round(investContrib).toLocaleString('tr-TR')} ₺</div>
          <div style="font-size:0.7rem;color:var(--text-muted)">Yatırım katkı payı</div>
        </div>
        <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border-subtle);border-radius:8px;padding:10px;text-align:center">
          <div style="font-size:1.1rem;font-weight:700;color:var(--success)">${Math.round(cumulative10).toLocaleString('tr-TR')} ₺</div>
          <div style="font-size:0.7rem;color:var(--text-muted)">${amortYears} yıl kümülatif avantaj</div>
        </div>
      </div>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:0.78rem">
          <thead>
            <tr style="background:var(--surface)">
              <th style="text-align:left;padding:6px 10px;border-bottom:1px solid var(--border);color:var(--text-muted);font-weight:500">Yıl</th>
              <th style="text-align:left;padding:6px 10px;border-bottom:1px solid var(--border);color:var(--text-muted);font-weight:500">Amortisman</th>
              <th style="text-align:left;padding:6px 10px;border-bottom:1px solid var(--border);color:var(--text-muted);font-weight:500">Vergi Kalkanı</th>
              <th style="text-align:left;padding:6px 10px;border-bottom:1px solid var(--border);color:var(--text-muted);font-weight:500">Kümülatif</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }
}

// window'a expose et
window.toggleTaxBlock = toggleTaxBlock;
window.onTaxToggle = onTaxToggle;
window.updateTaxInput = updateTaxInput;
