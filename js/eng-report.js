// ═══════════════════════════════════════════════════════════
// ENG REPORT — Engineering calculation report
// Solar Rota v2.0
// ═══════════════════════════════════════════════════════════
import { PANEL_TYPES } from './data.js';
import { i18n } from './i18n.js';
import { localeTag, localizeKnownMessage, statusLabel, tx } from './output-i18n.js';
import { escapeHtml } from './security.js';

export function toggleEngReport() {
  const body    = document.getElementById('eng-report-body');
  const header  = document.getElementById('eng-report-toggle');
  const chevron = document.getElementById('eng-chevron');
  const isOpen  = body.classList.contains('open');
  body.classList.toggle('open', !isOpen);
  header.classList.toggle('open', !isOpen);
  chevron.classList.toggle('open', !isOpen);
  if (!isOpen && body.innerHTML.trim() === '') renderEngReport();
}

export function renderEngReport() {
  const state = window.state;
  const r = state.results;
  if (!r) return;
  const p   = PANEL_TYPES[state.panelType];
  const body = document.getElementById('eng-report-body');
  const lcoeValue = Number.parseFloat(r.lcoe);
  const activeLocale = localeTag();
  const fmt  = v => Math.round(v).toLocaleString(activeLocale);
  const money = v => {
    const currency = state.displayCurrency || 'TRY';
    const usdToTry = Math.max(0.0001, Number(state.usdToTry) || 38.5);
    const converted = currency === 'USD' ? (Number(v) || 0) / usdToTry : (Number(v) || 0);
    return converted.toLocaleString(currency === 'USD' ? 'en-US' : activeLocale, { maximumFractionDigits: 0 }) + ' ' + currency;
  };
  const moneyRate = (v, unit = 'kWh') => {
    const currency = state.displayCurrency || 'TRY';
    const usdToTry = Math.max(0.0001, Number(state.usdToTry) || 38.5);
    const converted = currency === 'USD' ? (Number(v) || 0) / usdToTry : (Number(v) || 0);
    return converted.toLocaleString(currency === 'USD' ? 'en-US' : activeLocale, { maximumFractionDigits: currency === 'USD' ? 3 : 2 }) + ` ${currency}/${unit}`;
  };

  const panelArea   = p.width * p.height;
  const usableArea  = state.roofArea * 0.75;
  const pvgisAzimut = state.azimuth - 180;
  const netEnergy   = r.annualEnergy;
  const authoritativeSource = r.authoritativeEngineSource || r.engineSource || {};
  const authoritativeTitle = authoritativeSource.pvlibBacked ? 'Python pvlib-backed production engine' : authoritativeSource.source || r.calculationMode || 'Browser PVGIS/JS engine';
  const fallbackReason = r.authoritativeEngineFallbackReason ? localizeKnownMessage(r.authoritativeEngineFallbackReason) : null;
  const maxRef      = r.pvgisRawEnergy || netEnergy;
  const shadingPct  = (r.shadingLoss / maxRef * 100).toFixed(1);
  const tempPct     = (r.tempLossEnergy / maxRef * 100).toFixed(1);
  const azimuthPct  = (r.azimuthLossEnergy / maxRef * 100).toFixed(1);
  const bifacialPct = (r.bifacialGainEnergy / maxRef * 100).toFixed(1);
  const soilingPct  = (r.soilingLoss / maxRef * 100).toFixed(1);
  const cb          = r.costBreakdown;
  const totalEnergy25y = r.yearlyTable.reduce((s, y) => s + y.energy, 0);
  const gov = r.proposalGovernance || {};
  const report = key => i18n.t(`report.${key}`);
  const yearUnit = i18n.t('units.year');
  const dayUnit = report('days');
  const panelUnit = report('panelCountUnit');
  const statusText = value => statusLabel(value);
  const financialRate = Number(r.financialSavingsRate || r.tariff || 0);
  const comp = r.compensationSummary || {};

  let html = `
  <div class="eng-section-header">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>
    ${escapeHtml(i18n.t('report.authoritativeProductionEngine'))}
  </div>
  <div class="formula-card">
    <div class="formula-title">${escapeHtml(authoritativeTitle)}</div>
    <div class="formula-body">${escapeHtml(i18n.t('report.engineProvider'))}: ${escapeHtml(authoritativeSource.provider || '—')}
${escapeHtml(i18n.t('report.engineQuality'))}: ${escapeHtml(statusLabel(authoritativeSource.engineQuality || authoritativeSource.confidence || '—'))}
${escapeHtml(i18n.t('report.calculationMode'))}: ${escapeHtml(r.authoritativeEngineMode || r.calculationMode || '—')}
${escapeHtml(i18n.t('report.annualProductionUsed'))}: ${fmt(r.annualEnergy)} kWh/${escapeHtml(yearUnit)}
${fallbackReason ? `${escapeHtml(i18n.t('engine.fallbackReason'))}: ${escapeHtml(fallbackReason)}` : `${escapeHtml(i18n.t('engine.fallbackReason'))}: —`}</div>
    <div class="formula-note">${escapeHtml(i18n.t('report.sameAuthoritativeSource'))}</div>
  </div>
  <div class="eng-section-header">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/></svg>
    1. ${escapeHtml(i18n.t('report.panelSystemDesign'))}
  </div>
  <div class="formula-card">
    <div class="formula-title">${escapeHtml(i18n.t('report.panelLayout'))}</div>
    <div class="formula-body">${escapeHtml(report('areaFormula'))}
= ${p.width} m × ${p.height} m = ${panelArea.toFixed(4)} m²

${escapeHtml(report('usableRoofArea'))} = ${escapeHtml(report('totalRoofArea'))} × 0.75
= ${state.roofArea} m² × 0.75 = ${usableArea.toFixed(1)} m²

${escapeHtml(report('panelCountFormula'))}
= floor(${usableArea.toFixed(1)} ÷ ${panelArea.toFixed(4)}) = ${r.panelCount} ${escapeHtml(panelUnit)}</div>
    <div class="formula-result">✓ ${r.panelCount} ${escapeHtml(panelUnit)} ${escapeHtml(p.name)}</div>
    <div class="formula-note">${escapeHtml(report('layoutNote'))}</div>
  </div>
  <div class="formula-card">
    <div class="formula-title">${escapeHtml(i18n.t('report.installedPower'))} (DC — STC)</div>
    <div class="formula-body">P_dc = ${escapeHtml(i18n.t('report.panelCount'))} × P_peak
= ${r.panelCount} × ${p.wattPeak} Wp = ${(r.panelCount * p.wattPeak).toLocaleString(activeLocale)} Wp = ${r.systemPower.toFixed(2)} kWp</div>
    <div class="formula-result">✓ ${escapeHtml(report('installedPowerResult'))}: ${r.systemPower.toFixed(2)} kWp</div>
    <div class="formula-note">${escapeHtml(report('stcNote'))}: ${escapeHtml(p.standard)}</div>
  </div>

  <!-- 2. Inverter -->
  <div class="eng-section-header">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12" y2="18"/></svg>
    2. ${escapeHtml(i18n.t('report.inverterSelection'))}
  </div>
  <div class="formula-card">
    <div class="formula-title">${escapeHtml(report('inverterTitle'))}: ${escapeHtml(r.inverterType ? r.inverterType.charAt(0).toUpperCase() + r.inverterType.slice(1) : 'String')} — ${escapeHtml(report('inverterEfficiency'))} %${r.inverterEfficiency || '97'}</div>
    <div class="formula-body">${escapeHtml(report('inverterEfficiency'))} = %${r.inverterEfficiency || '97'}
E_AC = E_DC × η_inv = ${fmt(r.annualEnergy / (r.inverterEfficiency/100 || 0.97) * (r.inverterEfficiency/100 || 0.97))} kWh × ${r.inverterEfficiency || '97'}% = ${fmt(r.annualEnergy)} kWh/${escapeHtml(yearUnit)}</div>
    <div class="formula-note">${escapeHtml(report('inverterNote'))}</div>
  </div>

  <!-- 3. PVGIS -->
  <div class="eng-section-header">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/></svg>
    3. ${authoritativeSource.pvlibBacked ? 'pvlib Model Chain' : escapeHtml(i18n.t('report.productionInput'))}
  </div>
  <div class="formula-card">
    <div class="formula-title">${authoritativeSource.pvlibBacked ? 'pvlib solar position / POA / temperature / PVWatts MVP' : 'PVGIS API v5.2 — JRC / EC'}</div>
    <div class="formula-body">${escapeHtml(authoritativeSource.pvlibBacked ? report('backendEngine') : report('pvgisEndpoint'))}
lat=${state.lat?.toFixed(4)}  lon=${state.lon?.toFixed(4)}
peakpower=${r.systemPower.toFixed(2)} kWp   loss=${r.pvgisLossParam ?? 0}%
angle=${state.tilt}°   aspect=${pvgisAzimut}°  (${escapeHtml(report('aspectNote'))})

${authoritativeSource.pvlibBacked ? 'pvlib DC/POA reference' : escapeHtml(report('pvgisGrossProduction'))}: ${fmt(r.pvgisRawEnergy)} kWh/${escapeHtml(yearUnit)}
GHI: ${state.ghi} kWh/m²/${escapeHtml(yearUnit)}${r.usedFallback ? `\n⚠ ${escapeHtml(report('pvgisFallbackUsed'))}` : ''}</div>
    <div class="formula-note">${escapeHtml(authoritativeSource.pvlibBacked ? report('pvlibNote') : tx('report.pvgisNote', { loss: r.pvgisLossParam ?? 0, version: r.methodologyVersion || '—' }))}</div>
  </div>

  <!-- 4. Loss Waterfall -->
  <div class="eng-section-header">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
    4. ${escapeHtml(i18n.t('report.lossWaterfall'))}
  </div>
  <div class="formula-card">
    <div class="formula-title">${escapeHtml(report('lossEquationTitle'))}: E_net = E_gross × (1−shading) × (1−soiling) × k_bifacial × η_inv${r.usedFallback ? ' × (1+α×ΔT) × k_azimuth' : ''}</div>
    <div class="loss-waterfall">
      <div class="loss-row">
        <div class="loss-label">${escapeHtml(report('pvgisGrossProduction'))}${r.usedFallback ? ' (Fallback)' : ''}</div>
        <div class="loss-bar-wrap"><div class="loss-bar-fill neutral" style="width:100%"></div></div>
        <div class="loss-val neutral">${fmt(r.pvgisRawEnergy)} kWh</div>
      </div>
      <div class="loss-row">
    <div class="loss-label">− ${escapeHtml(report('shadingLoss'))} (%${r.effectiveShadingFactor ?? state.shadingFactor})</div>
        <div class="loss-bar-wrap"><div class="loss-bar-fill negative" style="width:${shadingPct}%"></div></div>
        <div class="loss-val negative">−${fmt(r.shadingLoss)} kWh</div>
      </div>
      <div class="loss-row">
        <div class="loss-label">− ${escapeHtml(report('soilingLoss'))} (%${state.soilingFactor})</div>
        <div class="loss-bar-wrap"><div class="loss-bar-fill negative" style="width:${soilingPct}%"></div></div>
        <div class="loss-val negative">−${fmt(r.soilingLoss)} kWh</div>
      </div>
      ${r.usedFallback ? `<div class="loss-row">
        <div class="loss-label">− ${escapeHtml(report('temperatureLoss'))} (${r.avgSummerTemp}°C, α=${(p.tempCoeff*100).toFixed(3)}%/°C)</div>
        <div class="loss-bar-wrap"><div class="loss-bar-fill negative" style="width:${tempPct}%"></div></div>
        <div class="loss-val negative">−${fmt(r.tempLossEnergy)} kWh</div>
      </div>
      <div class="loss-row">
        <div class="loss-label">− ${escapeHtml(report('azimuthLoss'))} (${escapeHtml(state.azimuthName)}, k=${state.azimuthCoeff.toFixed(2)})</div>
        <div class="loss-bar-wrap"><div class="loss-bar-fill negative" style="width:${azimuthPct}%"></div></div>
        <div class="loss-val negative">−${fmt(r.azimuthLossEnergy)} kWh</div>
      </div>` : `<div class="loss-row" style="opacity:0.6">
        <div class="loss-label">✔ ${escapeHtml(report('pvgisIncludesTempAzimuth'))}</div>
        <div class="loss-bar-wrap"></div>
        <div class="loss-val" style="color:var(--text-muted)">—</div>
      </div>`}
      ${r.bifacialGainEnergy > 0 ? `
      <div class="loss-row">
        <div class="loss-label">+ ${escapeHtml(report('bifacialGain'))} (+${(p.bifacialGain*100).toFixed(0)}% ${escapeHtml(report('rearSide'))})</div>
        <div class="loss-bar-wrap"><div class="loss-bar-fill positive" style="width:${bifacialPct}%"></div></div>
        <div class="loss-val positive">+${fmt(r.bifacialGainEnergy)} kWh</div>
      </div>` : ''}
      <div class="loss-row" style="padding:10px 8px;background:rgba(16,185,129,0.06);border-radius:6px">
        <div class="loss-label" style="font-weight:700;color:var(--text)">= ${escapeHtml(report('netAnnualProduction'))}</div>
        <div class="loss-bar-wrap"><div class="loss-bar-fill positive" style="width:${Math.min(netEnergy/maxRef*100,100).toFixed(1)}%"></div></div>
        <div class="loss-val positive">${fmt(netEnergy)} kWh</div>
      </div>
    </div>
  </div>

  <!-- 5. Performance -->
  <div class="eng-section-header">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>
    5. ${escapeHtml(i18n.t('report.performanceMetrics'))}
  </div>
  <div class="perf-badges">
    <div class="perf-badge"><div class="perf-badge-val">${r.pr}%</div><div class="perf-badge-label">${escapeHtml(report('performanceRatio'))} (PR)</div></div>
    <div class="perf-badge"><div class="perf-badge-val">${r.psh}</div><div class="perf-badge-label">${escapeHtml(report('psh'))} (${escapeHtml(report('hoursPerDay'))})</div></div>
    <div class="perf-badge"><div class="perf-badge-val">${r.ysp}</div><div class="perf-badge-label">${escapeHtml(i18n.t('report.specificYield'))} (kWh/kWp)</div></div>
    <div class="perf-badge"><div class="perf-badge-val">${r.cf}%</div><div class="perf-badge-label">${escapeHtml(report('capacityFactor'))} (CF)</div></div>
    <div class="perf-badge"><div class="perf-badge-val">${r.irr}%</div><div class="perf-badge-label">IRR</div></div>
    <div class="perf-badge"><div class="perf-badge-val">${Number.isFinite(lcoeValue) ? lcoeValue.toFixed(2) : '—'}</div><div class="perf-badge-label">LCOE (TL/kWh)</div></div>
  </div>
  <div class="formula-card">
    <div class="formula-title">PR — ${escapeHtml(report('performanceRatio'))} (IEC 61724)</div>
    <div class="formula-body">PR = E_net ÷ (P_stc × POA)
= ${fmt(netEnergy)} kWh ÷ (${r.systemPower.toFixed(2)} kWp × ${r.pvgisPoa || state.ghi || 'N/A'} kWh/m²) = ${r.pr}%

P_stc: kWp, POA: kWh/m²/${escapeHtml(yearUnit)} → ${escapeHtml(report('dimensionlessResult'))}</div>
    <div class="formula-note">${escapeHtml(report('prFormulaNote'))}</div>
  </div>
  <div class="formula-card">
    <div class="formula-title">LCOE — ${escapeHtml(report('lcoeTitle'))}</div>
    <div class="formula-body">LCOE = Σ(Cost_t/(1+d)ᵗ) ÷ Σ(E_t/(1+d)ᵗ)

${escapeHtml(i18n.t('report.totalCost'))} (${escapeHtml(report('year'))} 0): ${money(r.totalCost)}
${escapeHtml(i18n.t('onGridResult.financialBasis'))}: ${money(r.financialCostBasis || r.totalCost)}
${escapeHtml(report('totalLifetimeExpenses'))}: ${money(r.totalExpenses25y)}
${escapeHtml(report('discountRate'))}: %${(r.discountRate*100).toFixed(0)}

LCOE = ${r.compensatedLcoe ? moneyRate(r.compensatedLcoe, 'kWh') + ' (ekonomik)' : moneyRate(r.lcoe, 'kWh')}</div>
    <div class="formula-note">${escapeHtml(report('userTariff'))}: ${moneyRate(r.tariff, 'kWh')} (${escapeHtml(state.tariffType)}). ${escapeHtml(report('lcoeNote'))} ${escapeHtml(i18n.t('onGridResult.lcoeLabel'))}.${r.compensatedLcoe ? ` Tüm üretim bazlı LCOE: ${moneyRate(r.lcoe, 'kWh')}` : ''}</div>
  </div>
  <div class="formula-card">
    <div class="formula-title">IRR — ${escapeHtml(report('irrTitle'))} (${escapeHtml(report('rootSearch'))})</div>
    <div class="formula-body">NPV(r) = −C₀ + Σₜ [NCFₜ ÷ (1+r)ᵗ] = 0
C₀ = ${money(r.totalCost)}   (${escapeHtml(report('initialInvestment'))})
NCFₜ = ${escapeHtml(report('savingsMinusExpenses'))}
Eₜ = E₁ × (1−LID) × (1−δ)ⁿ⁻¹   LID=${r.lidFactor}%, δ=${(p.degradation*100).toFixed(2)}%/${escapeHtml(yearUnit)}
Pₜ = P₀ × (1+g)ᵗ⁻¹   g=${(r.annualPriceIncrease*100).toFixed(0)}%/${escapeHtml(yearUnit)}
IRR = ${r.irr === 'N/A' ? escapeHtml(report('unableToCalculate')) : r.irr + '%'}</div>
    <div class="formula-note">${escapeHtml(report('irrNote'))} (${escapeHtml(report('discountRate'))}: %${(r.discountRate*100).toFixed(0)}).</div>
  </div>

  <!-- 6. Maliyet -->
  <div class="eng-section-header">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
    6. 2026 ${escapeHtml(i18n.t('report.costBreakdown'))}
  </div>
  <div class="formula-card">
    <div class="formula-title">${escapeHtml(i18n.t('report.costAnalysis'))} — ${escapeHtml(report('marketScope'))}</div>
    <table class="cost-breakdown-table">
      <thead><tr><th>${escapeHtml(i18n.t('report.tableItem'))}</th><th>${escapeHtml(i18n.t('report.unitPrice'))}</th><th>${escapeHtml(i18n.t('report.quantity'))}</th><th>${escapeHtml(i18n.t('report.amount'))}</th></tr></thead>
      <tbody>
        <tr><td>Panel (${p.name})</td><td>${moneyRate(p.pricePerWatt, 'Wp')}</td><td>${fmt(r.systemPower * 1000)} Wp</td><td>${money(cb.panel)}</td></tr>
        <tr><td>${escapeHtml(report('inverterTitle'))} (${escapeHtml(r.inverterType || 'String')})</td><td>${moneyRate(cb.invUnit, 'kWp')}</td><td>${r.systemPower.toFixed(2)} kWp</td><td>${money(cb.inverter)}</td></tr>
        <tr><td>${escapeHtml(report('mountingSystem'))}</td><td>${moneyRate(2200, 'kWp')}</td><td>${r.systemPower.toFixed(2)} kWp</td><td>${money(cb.mounting)}</td></tr>
        <tr><td>DC Kablo + MC4</td><td>${moneyRate(600, 'kWp')}</td><td>${r.systemPower.toFixed(2)} kWp</td><td>${money(cb.dcCable)}</td></tr>
        <tr><td>${escapeHtml(report('acElectrical'))}</td><td>${moneyRate(900, 'kWp')}</td><td>${r.systemPower.toFixed(2)} kWp</td><td>${money(cb.acElec)}</td></tr>
        <tr><td>${escapeHtml(i18n.t('report.labor'))}</td><td>${moneyRate(1800, 'kWp')}</td><td>${r.systemPower.toFixed(2)} kWp</td><td>${money(cb.labor)}</td></tr>
        <tr><td>${escapeHtml(report('gridConnection'))}</td><td>${escapeHtml(report('fixed'))}</td><td>1</td><td>${money(cb.permits)}</td></tr>
        <tr><td colspan="3">${escapeHtml(i18n.t('report.subtotalExVat'))}</td><td>${money(cb.subtotal)}</td></tr>
        <tr><td colspan="3">${escapeHtml(i18n.t('kdv.note'))}</td><td>${money(cb.kdv)}</td></tr>
        <tr class="total-row"><td colspan="3"><strong>${escapeHtml(i18n.t('report.grandTotal'))}</strong></td><td><strong>${money(cb.total)}</strong></td></tr>
        ${r.annualOMCost > 0 ? `<tr style="border-top:2px solid var(--border)"><td colspan="3">${escapeHtml(report('annualMaintenance'))} (O&M) — %${state.omRate}</td><td>${money(r.annualOMCost)}/${escapeHtml(yearUnit)}</td></tr>` : ''}
        ${r.annualInsurance > 0 ? `<tr><td colspan="3">${escapeHtml(report('annualInsurance'))} — %${state.insuranceRate}</td><td>${money(r.annualInsurance)}/${escapeHtml(yearUnit)}</td></tr>` : ''}
        ${r.inverterReplaceCost > 0 ? `<tr><td colspan="3">${escapeHtml(report('inverterReplacement'))} (${escapeHtml(report('year'))} ${r.inverterLifetime || 12})</td><td>${money(r.inverterReplaceCost)}</td></tr>` : ''}
      </tbody>
    </table>
  </div>

  <!-- 7. 25-year table -->
  <div class="eng-section-header">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
    7. ${escapeHtml(i18n.t('report.yearProjectionTable'))}
  </div>
  <div class="formula-card">
    <div class="formula-title">${escapeHtml(report('annualFormulaProduction'))}</div>
    <div class="formula-body">Eₜ = E₁ × (1−LID) × (1−δ)ⁿ⁻¹    LID=${r.lidFactor}%, δ=${(p.degradation*100).toFixed(2)}%/${escapeHtml(yearUnit)}
Pₜ = P₀ × (1 + g)ᵗ⁻¹   g=${(r.annualPriceIncrease*100).toFixed(0)}%/${escapeHtml(yearUnit)}, P₀=${financialRate} TL/kWh
${escapeHtml(report(state.scenarioKey === 'off-grid' ? 'incomeFormulaOffGrid' : 'incomeFormula'))}
${escapeHtml(i18n.t('onGridResult.directSelfConsumption'))}: ${fmt(comp.directSelfConsumptionKwh || 0)} kWh; ${escapeHtml(i18n.t('onGridResult.monthlyOffset'))}: ${fmt(comp.importOffsetKwh || 0)} kWh; ${escapeHtml(i18n.t('onGridResult.paidSurplus'))}: ${fmt(comp.paidExportKwh || 0)} kWh
${escapeHtml(report('expenseFormula'))}
NCFₜ = ${escapeHtml(report('netCashFlow'))}
NPVₜ = NCFₜ ÷ (1+d)ᵗ    d=${(r.discountRate*100).toFixed(0)}%
${escapeHtml(report('totalProduction25y'))}: ${fmt(totalEnergy25y)} kWh</div>
    <div class="year-table-wrap">
      <table class="year-table">
        <thead><tr><th>${escapeHtml(report('year'))}</th><th>${escapeHtml(report('production'))} (kWh)</th><th>${escapeHtml(report('tariff'))}</th><th>${escapeHtml(report('savings'))}</th><th>${escapeHtml(report('expenses'))}</th><th>Net</th><th>${escapeHtml(report('cumulative'))}</th><th>NPV</th></tr></thead>
        <tbody>
          ${r.yearlyTable.map(y => `
          <tr ${y.year === r.paybackYear ? 'class="payback-row"' : ''}>
            <td>${y.year}${y.year === r.paybackYear ? ' ✓' : ''}</td>
            <td>${fmt(y.energy)}</td>
            <td>${y.effectiveImportRate || y.rate}</td>
            <td>${money(y.savings)}</td>
            <td style="color:var(--danger)">${y.expenses > 0 ? '-' + money(y.expenses) : '0'}</td>
            <td>${money(y.netCashFlow)}</td>
            <td>${money(y.cumulative)}</td>
            <td>${money(y.npv)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <div class="formula-note">${escapeHtml(report('paybackRowNote'))}: O&M ${money(r.annualOMCost)} + ${escapeHtml(report('annualInsurance'))} ${money(r.annualInsurance)} = ${money(r.annualOMCost + r.annualInsurance)}/${escapeHtml(yearUnit)}.</div>
  </div>`;

  if (gov.confidence) {
    const evidence = r.evidenceGovernance || {};
    const tariffSource = r.tariffSourceGovernance || {};
    const evidenceFileCount = Object.values(evidence.registry || {}).reduce((sum, record) => sum + ((record.files || []).length), 0);
    html += `
  <div class="eng-section-header">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12l2 2 4-4"/><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
    ${escapeHtml(i18n.t('report.proposalGovernance'))}
  </div>
  <div class="formula-card">
    <div class="formula-title">${escapeHtml(i18n.t('report.proposalTraceability'))}</div>
    <div class="formula-body">${escapeHtml(i18n.t('governance.proposalConfidence'))}: ${gov.confidence.score}/100
${escapeHtml(i18n.t('governance.confidenceLevel'))}: ${escapeHtml(statusText(gov.confidence.level))}
${escapeHtml(i18n.t('governance.approvalState'))}: ${escapeHtml(statusText(gov.approval?.state || 'draft'))}
${escapeHtml(report('approvalRecord'))}: ${gov.approval?.approvalRecord?.id || '—'}
${escapeHtml(report('gridChecklist'))}: ${gov.gridChecklistComplete ? escapeHtml(statusText('complete')) : escapeHtml(statusText('incomplete'))}
${escapeHtml(report('regulationVersion'))}: ${r.quoteReadiness?.version || r.tariffModel?.exportCompensationPolicy?.version || '—'}
${escapeHtml(report('revision'))}: ${gov.revision?.id || '—'}
${escapeHtml(report('evidenceStatus'))}: ${escapeHtml(statusText(evidence.validation?.status || '—'))}
${escapeHtml(report('evidenceFileCount'))}: ${evidenceFileCount}
${escapeHtml(report('auditLogCount'))}: ${(state.auditLog || []).length}
${escapeHtml(report('tariffSourceAge'))}: ${tariffSource.ageDays ?? '—'} ${escapeHtml(dayUnit)}${tariffSource.stale ? ' (STALE)' : ''}</div>
    <div class="formula-note">${escapeHtml(i18n.t('report.quoteReadyNote'))}</div>
  </div>`;
  }

  // ── 8. BESS ────────────────────────────────────────────────────────────────
  if (r.bessMetrics) {
    const bm = r.bessMetrics;
    const offGridMetricNote = state.scenarioKey === 'off-grid'
      ? `\n\n${escapeHtml(report('offGridMetricNote'))}`
      : '';
    html += `
  <div class="eng-section-header">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-4 0v2"/></svg>
    8. ${escapeHtml(report('bessAnalysis'))}
  </div>
  <div class="formula-card">
    <div class="formula-title">${escapeHtml(bm.modelName)} — ${escapeHtml(report('dailyEnergyBalance'))}</div>
    <div class="formula-body">${escapeHtml(report('dailyProduction'))} = ${fmt(r.annualEnergy)} ÷ 365 = ${bm.dailyProduction} kWh/day
${escapeHtml(report('dailyConsumption'))} = ${state.dailyConsumption} kWh/day
${escapeHtml(report('usableCapacity'))} = ${state.battery.capacity} kWh × ${(state.battery.dod*100).toFixed(0)}% DoD = ${bm.usableCapacity} kWh

${escapeHtml(report('gridIndependence'))} = ${bm.gridIndependence}%
${escapeHtml(report('nightCoverage'))} = ${bm.nightCoverage}%
${escapeHtml(report('batteryInstalledCost'))}: ${money(bm.batteryCost)}${offGridMetricNote}</div>
    <div class="formula-result">✓ ${escapeHtml(tx('report.batteryResult', { grid: bm.gridIndependence, night: bm.nightCoverage }))}</div>
  </div>`;
  }

  // ── 8b. Off-grid L2 dispatch source of truth ──────────────────────────────
  if (state.scenarioKey === 'off-grid' && r.offgridL2Results) {
    const L = r.offgridL2Results;
    html += `
  <div class="eng-section-header">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12h16"/><path d="M12 4v16"/><path d="M7 7l10 10"/><path d="M17 7L7 17"/></svg>
    9. ${escapeHtml(i18n.t('offgridL2.dispatchLabel'))}
  </div>
  <div class="formula-card">
    <div class="formula-title">${escapeHtml(i18n.t('offGrid.preFeasibilityOnly'))}</div>
    <div class="formula-body">${escapeHtml(i18n.t('offgridL2.productionSource'))}: ${escapeHtml(L.productionSourceLabel || L.productionSource || '—')}
${escapeHtml(i18n.t('offgridL2.productionDispatchSynthetic'))} (${escapeHtml(L.productionDispatchProfile || 'monthly-production-derived-synthetic-8760')})
${escapeHtml(i18n.t('offgridL2.loadSourceLabel'))}: ${escapeHtml(L.loadSource || L.loadMode || '—')}
${escapeHtml(i18n.t('offgridL2.dispatchLabel'))}: ${escapeHtml(L.dispatchType || 'synthetic-8760-dispatch')}
${escapeHtml(i18n.t('offgridL2.pvBessCoverageLabel'))}: ${((L.pvBatteryLoadCoverage ?? L.totalLoadCoverage) * 100).toFixed(1)}%
${escapeHtml(i18n.t('offgridL2.totalCoverageWithGeneratorLabel'))}: ${(L.totalLoadCoverage * 100).toFixed(1)}%
${escapeHtml(i18n.t('offgridL2.pvBessCriticalCoverageLabel'))}: ${((L.pvBatteryCriticalCoverage ?? L.criticalLoadCoverage) * 100).toFixed(1)}%
${escapeHtml(i18n.t('offgridL2.criticalCoverageWithGeneratorLabel'))}: ${(L.criticalLoadCoverage * 100).toFixed(1)}%
${escapeHtml(i18n.t('offgridL2.resultAutonomousDays'))}: ${L.autonomousDays ?? '—'} ${escapeHtml(yearUnit)}; ${escapeHtml(i18n.t('offgridL2.resultAutonomousDaysWithGenerator'))}: ${L.autonomousDaysWithGenerator ?? '—'} ${escapeHtml(yearUnit)}
${escapeHtml(i18n.t('offgridL2.unmetLabel'))}: ${fmt(L.unmetLoadKwh || 0)} kWh/${escapeHtml(yearUnit)}
${escapeHtml(i18n.t('offgridL2.curtailedLabel'))}: ${fmt(L.curtailedPvKwh || 0)} kWh/${escapeHtml(yearUnit)}
${escapeHtml(i18n.t('offgridL2.generatorLabel'))}: ${fmt(L.generatorEnergyKwh || L.generatorKwh || 0)} kWh/${escapeHtml(yearUnit)}; ${escapeHtml(i18n.t('offgridL2.generatorCapex'))}: ${money(L.generatorCapex || 0)}
${escapeHtml(i18n.t('offgridL2.minSocLabel'))}: ${L.minimumSoc != null ? (L.minimumSoc * 100).toFixed(1) + '%' : '—'}; ${escapeHtml(i18n.t('offgridL2.avgSocLabel'))}: ${L.averageSoc != null ? (L.averageSoc * 100).toFixed(1) + '%' : '—'}
${escapeHtml(i18n.t('offgridL2.inverterLimitLabel'))}: ${L.inverterAcLimitKw || '—'} kW; ${escapeHtml(i18n.t('offgridL2.batteryPowerLimitLabel'))}: ${L.batteryMaxChargeKw || '—'} / ${L.batteryMaxDischargeKw || '—'} kW
${escapeHtml(i18n.t('offgridL2.powerLimitedLabel'))}: ${fmt(L.inverterPowerLimitedKwh || 0)} kWh (${L.inverterPowerLimitHours || 0} h)
${escapeHtml(i18n.t('offgridL2.fieldGuaranteeStatus'))}: ${escapeHtml(i18n.t(L.fieldGuaranteeReadiness?.phase1Ready ? 'offgridL2.fieldGuaranteePhase1Ready' : 'offgridL2.fieldGuaranteeBlocked'))}
${(L.fieldGuaranteeReadiness?.blockers || []).slice(0, 3).map(item => `- ${escapeHtml(item)}`).join('\n')}
${escapeHtml(i18n.t('offgridL2.fieldEvidenceStatus'))}: ${escapeHtml(i18n.t(L.fieldEvidenceGate?.phase2Ready ? 'offgridL2.fieldEvidenceReady' : 'offgridL2.fieldEvidenceBlocked'))}
${(L.fieldEvidenceGate?.blockers || []).slice(0, 3).map(item => `- ${escapeHtml(item)}`).join('\n')}
${escapeHtml(i18n.t('offgridL2.fieldModelStatus'))}: ${escapeHtml(i18n.t(L.fieldModelMaturityGate?.phase3Ready ? 'offgridL2.fieldModelReady' : 'offgridL2.fieldModelBlocked'))}
${(L.fieldModelMaturityGate?.blockers || []).slice(0, 3).map(item => `- ${escapeHtml(item)}`).join('\n')}
${escapeHtml(i18n.t('offgridL2.fieldAcceptanceStatus'))}: ${escapeHtml(i18n.t(L.fieldAcceptanceGate?.phase4Ready ? 'offgridL2.fieldAcceptanceReady' : 'offgridL2.fieldAcceptanceBlocked'))}
${(L.fieldAcceptanceGate?.blockers || []).slice(0, 3).map(item => `- ${escapeHtml(item)}`).join('\n')}
${escapeHtml(i18n.t('offgridL2.fieldOperationStatus'))}: ${escapeHtml(i18n.t(L.fieldOperationGate?.phase5Ready ? 'offgridL2.fieldOperationReady' : 'offgridL2.fieldOperationBlocked'))}
${(L.fieldOperationGate?.blockers || []).slice(0, 3).map(item => `- ${escapeHtml(item)}`).join('\n')}
${escapeHtml(i18n.t('offgridL2.fieldRevalidationStatus'))}: ${escapeHtml(i18n.t(L.fieldRevalidationGate?.phase6Ready ? 'offgridL2.fieldRevalidationReady' : 'offgridL2.fieldRevalidationBlocked'))}
${(L.fieldRevalidationGate?.blockers || []).slice(0, 3).map(item => `- ${escapeHtml(item)}`).join('\n')}

${escapeHtml(i18n.t('offGrid.notFeasibilityAnalysis'))}</div>
    <div class="formula-note">${escapeHtml(i18n.t('offGrid.syntheticDispatchNote'))}</div>
  </div>`;
  }

  // ── 9. Grid export / settlement ────────────────────────────────────────────
  if (r.nmMetrics && state.netMeteringEnabled) {
    const nm = r.nmMetrics;
    const sectionNum = r.bessMetrics ? 9 : 8;
    html += `
  <div class="eng-section-header">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8h1a4 4 0 010 8h-1"/><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/></svg>
    ${sectionNum}. ${escapeHtml(report('gridExportSettlement'))}
  </div>
  <div class="formula-card">
    <div class="formula-title">${escapeHtml(nm.systemType)}</div>
    <div class="formula-body">${escapeHtml(report('annualProduction'))}: ${fmt(r.annualEnergy)} kWh
${escapeHtml(report('annualConsumption'))}: ${fmt(r.hourlySummary?.annualLoad || state.dailyConsumption * 365)} kWh
${escapeHtml(report('selfConsumptionRatio'))} = ${nm.selfConsumptionPct}%
${escapeHtml(i18n.t('onGridResult.directSelfConsumption'))} = ${fmt(comp.directSelfConsumptionKwh || nm.directSelfConsumedEnergy || nm.selfConsumedEnergy || 0)} kWh
${escapeHtml(i18n.t('onGridResult.monthlyOffset'))} = ${fmt(comp.importOffsetKwh || nm.importOffsetEnergy || 0)} kWh
${escapeHtml(report('annualExport'))} = ${fmt(nm.annualGridExport)} kWh
${escapeHtml(report('paidExport'))} = ${fmt(nm.paidGridExport || 0)} kWh
${escapeHtml(report('unpaidExport'))} = ${fmt(nm.unpaidGridExport || 0)} kWh

${escapeHtml(report('settlementBasis'))}: ${escapeHtml(nm.systemType)}${r.settlementProvisional ? `\n${escapeHtml(i18n.t('onGridResult.settlementProvisional'))}` : ''}
${escapeHtml(report('exportRevenue'))} = ${money(nm.annualExportRevenue)}/${escapeHtml(yearUnit)}</div>
    <div class="formula-result">✓ ${escapeHtml(tx('report.exportRevenueResult', { value: money(nm.annualExportRevenue) }))}</div>
  </div>`;
  }

  body.innerHTML = html;
}

// ─── Scientific notation formatting ──────────────────────────────────────────
function formatSci(n, digits = 3) {
  if (!Number.isFinite(n) || n === 0) return '0';
  const exp = Math.floor(Math.log10(Math.abs(n)));
  const coeff = (n / Math.pow(10, exp)).toFixed(digits);
  return `${coeff} × 10<sup>${exp}</sup>`;
}

// ─── Step-4 calculation summary panel ────────────────────────────────────────
export function renderEngCalcPanel() {
  const state = window.state;
  const r = state?.results;
  const panel = document.getElementById('eng-calc-panel');
  if (!panel || !r) return;

  const p = PANEL_TYPES[state.panelType];
  if (!p) return;

  const currency = state.displayCurrency || 'TRY';
  const usdToTry = Math.max(0.0001, Number(state.usdToTry) || 38.5);
  const activeLocale = localeTag();
  const report = key => i18n.t(`report.${key}`);
  const yearUnit = i18n.t('units.year');
  const moneyFmt = v => {
    const converted = currency === 'USD' ? (Number(v) || 0) / usdToTry : (Number(v) || 0);
    return converted.toLocaleString(currency === 'USD' ? 'en-US' : activeLocale, { maximumFractionDigits: 0 }) + ' ' + currency;
  };
  const lcoeValue = Number.parseFloat(r.lcoe);
  const lcoeShortNote = state.scenarioKey === 'off-grid'
    ? report('lcoeShortNoteOffGrid')
    : report('lcoeShortNote');
  const co2Value = Number.parseFloat(r.co2Savings);
  const paybackValue = Number(r.grossSimplePaybackYear || r.simplePaybackYear || r.paybackYear || 0);

  panel.style.display = 'block';
  panel.innerHTML = `
    <div style="background:rgba(245,158,11,0.04);border:1px solid rgba(245,158,11,0.2);border-radius:10px;padding:16px;margin-top:16px">
      <div style="font-family:var(--font-display);font-weight:700;font-size:0.9rem;margin-bottom:12px;display:flex;align-items:center;gap:8px">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"/></svg>
        ${escapeHtml(i18n.t('report.calcPanelTitle'))}
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px;font-size:0.8rem">
        <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border-subtle);border-radius:8px;padding:10px">
          <div style="color:var(--text-muted);margin-bottom:4px">${escapeHtml(report('physicsInstalledPower'))} (P<sub>dc</sub>)</div>
          <div style="font-family:monospace;font-size:0.85rem">${r.panelCount} × ${p.wattPeak} Wp = <strong style="color:var(--accent)">${(r.systemPower * 1000).toFixed(0)} W<sub>p</sub></strong></div>
          <div style="color:var(--text-muted);font-size:0.75rem;margin-top:3px">${formatSci(r.systemPower * 1000, 3)} W</div>
        </div>
        <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border-subtle);border-radius:8px;padding:10px">
          <div style="color:var(--text-muted);margin-bottom:4px">${escapeHtml(report('annualEnergyProduction'))} (E<sub>year</sub>)</div>
          <div style="font-family:monospace;font-size:0.85rem"><strong style="color:var(--primary)">${r.annualEnergy.toLocaleString(activeLocale)} kWh/${escapeHtml(i18n.t('units.year'))}</strong></div>
          <div style="color:var(--text-muted);font-size:0.75rem;margin-top:3px">${formatSci(r.annualEnergy * 3.6e6, 3)} J/${escapeHtml(i18n.t('units.year'))}</div>
        </div>
        <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border-subtle);border-radius:8px;padding:10px">
          <div style="color:var(--text-muted);margin-bottom:4px">${escapeHtml(report('cumulativeEnergy25y'))}</div>
          <div style="font-family:monospace;font-size:0.85rem"><strong style="color:var(--primary)">${r.yearlyTable.reduce((s,y)=>s+y.energy,0).toLocaleString(activeLocale)} kWh</strong></div>
          <div style="color:var(--text-muted);font-size:0.75rem;margin-top:3px">${formatSci(r.yearlyTable.reduce((s,y)=>s+y.energy,0) * 3.6e6, 3)} J</div>
        </div>
        <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border-subtle);border-radius:8px;padding:10px">
          <div style="color:var(--text-muted);margin-bottom:4px">${escapeHtml(report('totalInvestment'))}</div>
          <div style="font-family:monospace;font-size:0.85rem"><strong style="color:var(--text)">${moneyFmt(r.totalCost)}</strong></div>
          <div style="color:var(--text-muted);font-size:0.75rem;margin-top:3px">${formatSci(r.totalCost, 3)} TL</div>
        </div>
        <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border-subtle);border-radius:8px;padding:10px">
          <div style="color:var(--text-muted);margin-bottom:4px">LCOE (${escapeHtml(report('lcoeTitle'))})</div>
          <div style="font-family:monospace;font-size:0.85rem"><strong style="color:var(--accent)">${Number.isFinite(lcoeValue) ? lcoeValue.toFixed(2) : '—'} TL/kWh</strong></div>
          <div style="color:var(--text-muted);font-size:0.75rem;margin-top:3px">${escapeHtml(lcoeShortNote)}</div>
        </div>
        <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border-subtle);border-radius:8px;padding:10px">
          <div style="color:var(--text-muted);margin-bottom:4px">${escapeHtml(report('performanceRatio'))} (PR)</div>
          <div style="font-family:monospace;font-size:0.85rem"><strong style="color:var(--success)">${r.pr}%</strong></div>
          <div style="color:var(--text-muted);font-size:0.75rem;margin-top:3px">${escapeHtml(report('performanceRatioMetric'))}</div>
        </div>
        <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border-subtle);border-radius:8px;padding:10px">
          <div style="color:var(--text-muted);margin-bottom:4px">${escapeHtml(report('co2SavingsAnnual'))}</div>
          <div style="font-family:monospace;font-size:0.85rem"><strong style="color:var(--success)">${Number.isFinite(co2Value) ? co2Value.toFixed(1) : '—'} t CO₂</strong></div>
          <div style="color:var(--text-muted);font-size:0.75rem;margin-top:3px">${formatSci((Number.isFinite(co2Value) ? co2Value : 0) * 1000, 3)} kg CO₂/${escapeHtml(i18n.t('units.year'))}</div>
        </div>
        <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border-subtle);border-radius:8px;padding:10px">
          <div style="color:var(--text-muted);margin-bottom:4px">${escapeHtml(i18n.t('report.simplePayback'))}</div>
          <div style="font-family:monospace;font-size:0.85rem"><strong style="color:var(--text)">${paybackValue ? paybackValue.toFixed(1) : '>25'} ${escapeHtml(yearUnit)}</strong></div>
          <div style="color:var(--text-muted);font-size:0.75rem;margin-top:3px">${escapeHtml(report('simplePaybackPreTax'))}</div>
        </div>
      </div>
    </div>`;
}

// window'a expose et
window.toggleEngReport = toggleEngReport;
window.renderEngReport = renderEngReport;
window.renderEngCalcPanel = renderEngCalcPanel;
