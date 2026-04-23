// ═══════════════════════════════════════════════════════════
// UI RENDER — Sonuç gösterimi, PDF, Share
// Solar Rota v2.0
// ═══════════════════════════════════════════════════════════
import { PANEL_TYPES, MONTHS, COMPASS_DIRS } from './data.js';
import { convertTry, renderExchangeRateStatus } from './exchange-rate.js';
import { i18n } from './i18n.js';
import { localeTag, localizeKnownMessage, localizeMessageList, statusLabel, tx } from './output-i18n.js';
import { createShareStateSnapshot, escapeHtml, sanitizeSharedState } from './security.js';
import { buildStructuredProposalExport } from './evidence-governance.js';
import { buildCrmLeadExport } from './crm-export.js';
import { resolvePanelSpec } from './calc-core.js';

let monthlyChart = null;

function moneyContext(state = window.state) {
  const currency = state.displayCurrency || 'TRY';
  const usdToTry = Math.max(0.0001, Number(state.usdToTry) || 38.5);
  const suffix = currency === 'USD' ? 'USD' : 'TL';
  const locale = currency === 'USD' ? 'en-US' : 'tr-TR';
  return { currency, usdToTry, suffix, locale };
}

function money(value, opts = {}) {
  const ctx = moneyContext();
  const raw = Number(value) || 0;
  const converted = convertTry(raw, ctx.currency, ctx.usdToTry);
  const digits = opts.digits ?? (ctx.currency === 'USD' ? 0 : 0);
  return converted.toLocaleString(ctx.locale, { maximumFractionDigits: digits, minimumFractionDigits: opts.minDigits ?? 0 }) + ' ' + ctx.suffix;
}

function moneyRate(value, unit = 'kWh') {
  const ctx = moneyContext();
  const raw = Number(value) || 0;
  const converted = convertTry(raw, ctx.currency, ctx.usdToTry);
  return converted.toLocaleString(ctx.locale, { maximumFractionDigits: ctx.currency === 'USD' ? 3 : 2 }) + ` ${ctx.suffix}/${unit}`;
}

function engineSummaryText(results = {}, state = window.state || {}) {
  const source = results.authoritativeEngineSource || results.engineSource || results.backendEngineSource;
  const fallback = results.authoritativeEngineFallbackReason || (state.backendEngineAvailable === false ? state.backendEngineLastError : '');
  if (fallback) return 'Canlı veri geçici olarak alınamadı; yerel tahmin modeli kullanıldı.';
  return source?.pvlibBacked || source?.source
    ? 'Canlı güneş verisiyle desteklenen hesaplama kullanıldı.'
    : 'Yerel tahmin modeliyle hesaplama yapıldı.';
}

function backendEngineText(results = {}, state = window.state || {}) {
  const source = results.authoritativeEngineSource || results.engineSource || results.backendEngineSource || results.backendEngineResponse?.engineSource;
  if (source) {
    const backed = source.pvlibBacked ? 'pvlib-backed' : source.fallbackUsed || results.authoritativeEngineFallbackReason ? i18n.t('engine.fallback') : i18n.t('engine.primary');
    const annual = results.authoritativeEngineResponse?.production?.annualEnergyKwh || results.backendEngineResponse?.production?.annualEnergyKwh || results.annualEnergy;
    const energy = annual ? ` / ${Number(annual).toLocaleString('tr-TR')} kWh/yıl` : '';
    return `${source.provider || 'engine'} / ${source.source || results.calculationMode || '—'} / ${backed}${energy}`;
  }
  return state.backendEngineAvailable === false
    ? `${i18n.t('engine.fallbackActive')} / ${state.backendEngineLastError || i18n.t('engine.backendUnavailable')}`
    : i18n.t('engine.browserActive');
}

export function renderResults() {
  const state = window.state;
  const r = state.results;
  const p = PANEL_TYPES[state.panelType];
  renderExchangeRateStatus();

  window.animateCounter('kpi-energy', r.annualEnergy, v => Math.round(v).toLocaleString('tr-TR'));
  // Faz-4 Fix-15: P50/P90 confidence band below the annual energy KPI
  const bandEl = document.getElementById('kpi-energy-band');
  if (bandEl && r.energyP90 && r.energyP10) {
    bandEl.textContent = `P90: ${r.energyP90.toLocaleString('tr-TR')} – P10: ${r.energyP10.toLocaleString('tr-TR')} kWh`;
    bandEl.style.display = '';
  } else if (bandEl) {
    bandEl.style.display = 'none';
  }
  window.animateCounter('kpi-savings', r.annualSavings, v => money(v));
  window.animateCounter('kpi-power', r.systemPower, v => v.toFixed(2));
  window.animateCounter('kpi-co2', parseFloat(r.co2Savings), v => v.toFixed(2));
  document.getElementById('kpi-panels-sub').textContent = `${r.panelCount} ${i18n.t('units.panelUnit')}`;
  document.getElementById('kpi-tree-sub').textContent = `≈ ${r.trees} ${i18n.t('units.treeEquivalent')}`;
  const scenarioLabel = document.getElementById('result-scenario-label');
  const scenarioFrame = document.getElementById('result-scenario-frame');
  const engineSource = document.getElementById('result-engine-source');
  if (scenarioLabel) scenarioLabel.textContent = state.scenarioContext?.label || 'On-Grid';
  if (scenarioFrame) {
    scenarioFrame.innerHTML = `
      <span class="result-context-main">${escapeHtml(state.scenarioContext?.resultFrame || 'Grid-connected savings and proposal readiness')}</span>
      <span class="result-context-caution">${escapeHtml(state.scenarioContext?.resultCaution || i18n.t('report.preFeasibilityDisclaimer'))}</span>
    `;
  }
  if (engineSource) engineSource.textContent = engineSummaryText(r, state);
  let trustNote = document.getElementById('result-trust-note');
  if (!trustNote && scenarioFrame) {
    trustNote = document.createElement('div');
    trustNote.id = 'result-trust-note';
    trustNote.className = 'result-trust-note';
    scenarioFrame.closest('.result-context-strip')?.insertAdjacentElement('afterend', trustNote);
  }
  if (trustNote) {
    const status = statusLabel(r.quoteReadiness?.status || r.confidenceLevel || '—');
    trustNote.innerHTML = `
      <strong>${escapeHtml(i18n.t('report.trustNoteTitle'))}: ${escapeHtml(status)}</strong>
      <span>${escapeHtml(state.scenarioContext?.nextAction || i18n.t('onGridResult.commercialNextAction'))}</span>
    `;
  }

  const savingsUnit = document.querySelector('#step-7 .kpi-card:nth-child(2) .kpi-unit');
  if (savingsUnit) {
    savingsUnit.textContent = (state.displayCurrency === 'USD' ? `USD / ${i18n.t('units.year')}` : `TL / ${i18n.t('units.year')}`);
  }
  // Faz-2 Fix-8: When commercial tax recovery is active, show gross / KDV / net-basis
  // breakdown so the user understands which cost drives NPV/payback calculations.
  const finCostEl = document.getElementById('fin-cost');
  if (finCostEl) {
    const grossCost  = r.totalCost;
    const netBasis   = r.financialCostBasis;
    const kdvAmt     = r.costBreakdown?.kdv ?? 0;
    const taxActive  = state.taxEnabled && kdvAmt > 0 && netBasis < grossCost;
    if (taxActive) {
      finCostEl.innerHTML =
        `${money(grossCost)}<span style="display:block;font-size:0.72rem;color:var(--text-muted);margin-top:2px">` +
        `KDV: ${money(kdvAmt)} · ${i18n.t('kdv.financialBasisLabel')}: <strong>${money(netBasis)}</strong></span>`;
    } else {
      finCostEl.textContent = money(grossCost);
    }
  }
  document.getElementById('fin-payback').textContent = r.grossSimplePaybackYear ? Number(r.grossSimplePaybackYear).toFixed(1) + ` ${i18n.t('units.year')}` : `>25 ${i18n.t('units.year')}`;
  const discountedPaybackEl = document.getElementById('fin-discounted-payback');
  if (discountedPaybackEl) discountedPaybackEl.textContent = r.discountedPaybackYear != null ? r.discountedPaybackYear + ` ${i18n.t('units.year')}` : `>25 ${i18n.t('units.year')}`;
  document.getElementById('fin-total').textContent = money(r.npvTotal);
  document.getElementById('fin-roi').textContent = r.roi + '%';
  document.getElementById('fin-irr').textContent = r.irr === 'N/A' ? 'N/A' : r.irr + '%';
  document.getElementById('fin-lcoe').textContent = moneyRate(r.compensatedLcoe || r.lcoe, 'kWh');

  const omRow = document.getElementById('fin-om-row');
  const invRow = document.getElementById('fin-inverter-row');
  if (r.annualOMCost > 0 || r.annualInsurance > 0) {
    if (omRow) { omRow.style.display = ''; document.getElementById('fin-om-cost').textContent = '-' + money(r.annualOMCost + r.annualInsurance) + `/${i18n.t('units.year')}`; }
    if (invRow) { invRow.style.display = ''; document.getElementById('fin-inverter-cost').textContent = '-' + money(r.inverterReplaceCost); }
  } else {
    if (omRow) omRow.style.display = 'none';
    if (invRow) invRow.style.display = 'none';
  }
  const paybackPct = Math.min(((r.grossSimplePaybackYear || 25) / 15) * 100, 100);
  document.getElementById('payback-bar').style.width = paybackPct + '%';

  document.getElementById('eng-report-body').innerHTML = '';
  document.getElementById('eng-report-body').classList.remove('open');
  document.getElementById('eng-report-toggle').classList.remove('open');
  document.getElementById('eng-chevron').classList.remove('open');

  const tbody = document.getElementById('tech-table-body');
  tbody.innerHTML = '';
  const tt = k => i18n.t(`techTable.${k}`);
  const annualLoad = Math.round(r.hourlySummary?.annualLoad || state.dailyConsumption * 365 || 0);
  const roofAreaTotal = (Number(state.roofArea) || 0) + (state.multiRoof ? (state.roofSections || []).reduce((s, sec) => s + (Number(sec.area) || 0), 0) : 0);
  const roofUseArea = (p.areaM2 || 0) * (Number(r.panelCount) || 0);
  const coveragePct = annualLoad > 0 ? Math.min(999, (Number(r.annualEnergy || 0) / annualLoad) * 100) : 0;
  const rows = [
    [tt('summarySystemSize'), `${r.systemPower.toFixed(2)} kWp · ${r.panelCount} ${i18n.t('report.panelCountUnit')}`],
    [tt('summaryRoofUse'), roofAreaTotal > 0 ? `${roofUseArea.toFixed(1)} m² panel yerleşimi / ${roofAreaTotal.toFixed(1)} m² çatı` : '—'],
    [tt('summaryAnnualProduction'), `${Number(r.annualEnergy || 0).toLocaleString('tr-TR')} kWh/${i18n.t('units.year')}`],
    [tt('summaryMonthlyAverage'), `${Math.round((Number(r.annualEnergy || 0) / 12)).toLocaleString('tr-TR')} kWh/ay`],
    [tt('summaryConsumption'), `${annualLoad.toLocaleString('tr-TR')} kWh/${i18n.t('units.year')}`],
    [tt('summaryCoverage'), `%${coveragePct.toFixed(0)} civarı`],
    [tt('summaryOrientation'), `${state.azimuthName || '—'} · ${state.tilt}° eğim`],
    [tt('summarySavingsEffect'), money(r.annualSavings)],
    [tt('summaryPayback'), r.grossSimplePaybackYear ? `${Number(r.grossSimplePaybackYear).toFixed(1)} ${i18n.t('units.year')}` : `>25 ${i18n.t('units.year')}`],
    [tt('summarySource'), engineSummaryText(r, state)],
    [tt('summaryNextStep'), state.scenarioContext?.nextAction || i18n.t('onGridResult.commercialNextAction')],
  ];
  rows.forEach(([k, v]) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${k}</td><td>${escapeHtml(v)}</td>`;
    tbody.appendChild(tr);
  });

  // ── Çatı yüzeyleri kırılımı ───────────────────────────────────────────────
  const sectionCard = document.getElementById('section-breakdown-card');
  const sectionBody = document.getElementById('section-breakdown-body');
  if (r.sectionResults && r.sectionResults.length > 1 && sectionCard && sectionBody) {
    sectionCard.style.display = 'block';
    sectionBody.innerHTML = '';
    let totalPC = 0, totalPow = 0, totalE = 0;
    r.sectionResults.forEach((sec, i) => {
      totalPC  += sec.panelCount;
      totalPow += sec.systemPower;
      totalE   += sec.annualEnergy;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${i18n.t('techTable.sectionLabel').replace('{n}', i + 1)}</td>
        <td>${escapeHtml(sec.sectionArea)} m²</td>
        <td>${escapeHtml(sec.sectionAzimuthName)}</td>
        <td>${escapeHtml(sec.sectionTilt)}°</td>
        <td>${sec.panelCount}</td>
        <td>${sec.systemPower.toFixed(2)}</td>
        <td>${Math.round(sec.annualEnergy).toLocaleString('tr-TR')} kWh</td>`;
      sectionBody.appendChild(tr);
    });
    const totalRow = document.createElement('tr');
    totalRow.className = 'section-total-row';
    totalRow.innerHTML = `
      <td>${i18n.t('techTable.sectionTotal')}</td><td>—</td><td>—</td><td>—</td>
      <td>${totalPC}</td>
      <td>${totalPow.toFixed(2)}</td>
      <td>${Math.round(totalE).toLocaleString('tr-TR')} kWh</td>`;
    sectionBody.appendChild(totalRow);
  } else if (sectionCard) {
    sectionCard.style.display = 'none';
  }

  const avgConsumption = state.dailyConsumption ? Math.round(state.dailyConsumption * 30) : Math.round(r.annualEnergy / 12 * 0.6);
  renderMonthlyChart(r.monthlyData, avgConsumption);
  window.renderPRGauge(parseFloat(r.pr));

  renderBESSResults(r.bessMetrics);
  renderOffgridL2Results(r.offgridL2Results, state);
  renderNMResults(r.nmMetrics, state.netMeteringEnabled);
  renderOnGridResultLayers(state, r);
  renderWarningsAndAudit(state, r);
  renderBomResults(r.costBreakdown?.bom);

  // Faz B: Fatura analizi sonuçları
  if (r.billAnalysis) renderBillAnalysisResults(r.billAnalysis);
  else { const _bc = document.getElementById('bill-result-card'); if (_bc) _bc.style.display = 'none'; }

  // Faz C: EV Şarj sonuçları
  renderEVResults(r.evMetrics);

  // Faz C: Isı Pompası sonuçları
  renderHeatPumpResults(r.heatPumpMetrics);

  // Faz C: Yapısal kontrol sonuçları
  renderStructuralResults(r.structuralCheck);

  // Faz D: Vergi avantajı
  renderTaxResults(r.taxMetrics);

  // Karşılaştırmalı dashboard güncelle
  if (window.updateDashboard) window.updateDashboard();
}

function renderBESSResults(bess) {
  const section = document.getElementById('bess-result-section');
  if (!section) return;
  if (!bess) { section.style.display = 'none'; return; }
  const isOffGrid = window.state?.scenarioKey === 'off-grid';
  section.style.display = 'block';
  document.getElementById('bess-model-badge').textContent = bess.modelName || 'Batarya';
  document.getElementById('bess-independence').textContent = `${bess.gridIndependence}%`;
  document.getElementById('bess-night').textContent = `${bess.nightCoverage}%`;
  // Faz-4 Fix-14: Show autonomy metrics when available (off-grid scenario)
  const autonomyHtml = (bess.autonomousDaysPct != null)
    ? `<span>${escapeHtml(i18n.t('offGrid.autonomousDaysNote'))}: <strong>${bess.autonomousDaysPct}%</strong> (${bess.autonomousDays} gün/yıl)</span>
    <span>${escapeHtml(i18n.t('offgridL2.unmetLabel'))}: <strong>${Number(bess.unmetLoadKwh || 0).toLocaleString(localeTag())} kWh/${escapeHtml(i18n.t('units.year'))}</strong></span>`
    : '';
  const offgridPowerHtml = isOffGrid
    ? `<span>${escapeHtml(i18n.t('offgridL2.batteryPowerLimitLabel'))}: <strong>${bess.batteryMaxChargeKw || '—'} / ${bess.batteryMaxDischargeKw || '—'} kW</strong></span>
       <span>${escapeHtml(i18n.t('offgridL2.inverterLimitLabel'))}: <strong>${bess.inverterAcLimitKw || '—'} kW AC</strong></span>`
    : '';
  document.getElementById('bess-detail-row').innerHTML = `
    <span>Kullanılabilir kapasite: <strong>${bess.usableCapacity} kWh</strong></span>
    <span>Yıllık batarya deşarjı: <strong>${Number(bess.batteryStored || 0).toLocaleString(localeTag())} kWh</strong></span>
    <span>Tahmini çevrim/yıl: <strong>${bess.cyclesPerYear || '—'}</strong></span>
    <span>Batarya maliyeti: <strong>${money(bess.batteryCost)}</strong></span>
    ${offgridPowerHtml}
    ${autonomyHtml}
    ${isOffGrid ? `<div class="off-grid-honesty-note">${escapeHtml(i18n.t('offGrid.syntheticDispatchNote'))}</div><div class="off-grid-honesty-note off-grid-honesty-warn">${escapeHtml(i18n.t('offGrid.notFeasibilityAnalysis'))}</div>` : ''}
  `;
}

function renderOffgridL2Results(offgridL2Results, state) {
  const section = document.getElementById('offgrid-l2-result-section');
  if (!section) return;

  if (state?.scenarioKey !== 'off-grid' || !offgridL2Results) {
    section.style.display = 'none';
    return;
  }
  section.style.display = 'block';

  const L = offgridL2Results;
  const locale = localeTag();
  const accuracy = L.accuracyAssessment || null;
  const uncertainty = accuracy?.expectedUncertaintyPct || L.expectedUncertaintyPct || null;
  const uncertaintyText = uncertainty
    ? `±${Number(uncertainty.lowPct || 0).toFixed(0)}-${Number(uncertainty.highPct || 0).toFixed(0)}%`
    : '—';
  const accuracyColor = (L.accuracyScore || 0) >= 80 ? '#22C55E'
    : (L.accuracyScore || 0) >= 60 ? '#F59E0B'
    : '#EF4444';

  // Dispatch özeti kartları
  const dispatchGrid = document.getElementById('offgrid-dispatch-grid');
  if (dispatchGrid) {
    const items = [
      { label: i18n.t('offgridL2.directPvLabel'),  value: `${Math.round(L.directPvKwh).toLocaleString(locale)} kWh`, color: '#F59E0B' },
      { label: i18n.t('offgridL2.batteryLabel'),   value: `${Math.round(L.batteryKwh).toLocaleString(locale)} kWh`, color: '#8B5CF6' },
      { label: i18n.t('offgridL2.curtailedLabel'), value: `${Math.round(L.curtailedPvKwh).toLocaleString(locale)} kWh`, color: '#94A3B8' },
      { label: i18n.t('offgridL2.unmetLabel'),     value: `${Math.round(L.unmetLoadKwh).toLocaleString(locale)} kWh`, color: '#EF4444' },
    ];
    if (L.generatorEnabled) {
      items.splice(2, 0, { label: i18n.t('offgridL2.generatorLabel'), value: `${Math.round(L.generatorKwh).toLocaleString(locale)} kWh`, color: '#F59E0B' });
    }
    dispatchGrid.innerHTML = items.map(it => `
      <div style="text-align:center;background:rgba(30,41,59,0.5);border:1px solid rgba(148,163,184,0.15);border-radius:8px;padding:10px">
        <div style="font-family:var(--font-display,inherit);font-size:1.05rem;font-weight:700;color:${it.color}">${escapeHtml(it.value)}</div>
        <div style="font-size:0.68rem;color:var(--text-muted);margin-top:2px">${escapeHtml(it.label)}</div>
      </div>`).join('');
  }

  // Kapsama metrikleri
  const totalCovEl = document.getElementById('offgrid-total-coverage');
  const critCovEl = document.getElementById('offgrid-critical-coverage');
  if (totalCovEl) totalCovEl.textContent = `${(L.totalLoadCoverage * 100).toFixed(1)}%`;
  if (critCovEl) critCovEl.textContent = `${(L.criticalLoadCoverage * 100).toFixed(1)}%`;

  // Jeneratör analizi (enhanced with narrative)
  const genResultWrap = document.getElementById('offgrid-generator-result-wrap');
  const genResultDetails = document.getElementById('offgrid-generator-result-details');
  if (genResultWrap && genResultDetails) {
    if (L.generatorEnabled) {
      genResultWrap.style.display = '';
      const hoursStr = Math.round(L.generatorRunHoursPerYear).toLocaleString(locale);
      const kwhStr   = Math.round(L.generatorKwh).toLocaleString(locale);
      const narrative = i18n.t('offgridL2.genNarrativeActive')
        .replace('{hours}', hoursStr).replace('{kwh}', kwhStr)
        .replace('{cost}', Math.round(L.generatorFuelCostAnnual).toLocaleString(locale));
      genResultDetails.innerHTML = [
        `<span style="color:var(--text-muted)">${escapeHtml(i18n.t('offgridL2.genRunHours'))}: <strong style="color:var(--text)">${hoursStr} h/yıl</strong></span>`,
        `<span style="color:var(--text-muted)">${escapeHtml(i18n.t('offgridL2.genFuelCost'))}: <strong style="color:var(--text)">${money(L.generatorFuelCostAnnual)} / yıl</strong></span>`,
        `<span style="color:var(--text-muted)">${escapeHtml(i18n.t('offgridL2.genKwh'))}: <strong style="color:var(--text)">${kwhStr} kWh/yıl</strong></span>`,
        L.generatorMaintenanceCostAnnual ? `<span style="color:var(--text-muted)">Servis gideri: <strong style="color:var(--text)">${money(L.generatorMaintenanceCostAnnual)} / yıl</strong></span>` : '',
        L.generatorStrategy ? `<span style="color:var(--text-muted)">Strateji: <strong style="color:var(--text)">${escapeHtml(String(L.generatorStrategy))}</strong></span>` : '',
        `<span style="color:var(--text-muted)">${escapeHtml(i18n.t('offgridL2.generatorCapex'))}: <strong style="color:var(--text)">${money(L.generatorCapex || 0)}</strong></span>`,
        L.generatorCapexMissing ? `<span style="color:#F59E0B">${escapeHtml(i18n.t('offgridL2.generatorCapexMissing'))}</span>` : '',
        `<div style="margin-top:6px;font-size:0.72rem;color:var(--text-muted);font-style:italic;width:100%">${escapeHtml(narrative)}</div>`,
      ].filter(Boolean).join('');
    } else {
      genResultWrap.style.display = 'none';
    }
  }

  // Kötü hava senaryosu (enhanced with narrative)
  const bwWrap = document.getElementById('offgrid-badweather-result-wrap');
  const bwDetails = document.getElementById('offgrid-badweather-result-details');
  if (bwWrap && bwDetails) {
    const bw = L.badWeatherScenario;
    if (bw) {
      bwWrap.style.display = '';
      const levelKey = 'offgridL2.badWeather_' + bw.weatherLevel;
      const critDrop = bw.criticalCoverageDropPct.toFixed(1);
      const totalDrop = bw.totalCoverageDropPct.toFixed(1);
      const days = bw.consecutiveDays || 0;
      const resilient = bw.criticalCoverageDropPct < 10
        ? i18n.t('offgridL2.badWeatherResilientYes')
        : i18n.t('offgridL2.badWeatherResilientNo');
      const risk = bw.criticalCoverageDropPct < 15
        ? i18n.t('offgridL2.badWeatherRiskLow')
        : i18n.t('offgridL2.badWeatherRiskHigh');
      const narrativeKey = `offgridL2.badWeatherNarrative${bw.weatherLevel.charAt(0).toUpperCase() + bw.weatherLevel.slice(1)}`;
      const narrative = i18n.t(narrativeKey)
        .replace('{days}', days).replace('{critDrop}', critDrop)
        .replace('{totalDrop}', totalDrop).replace('{resilient}', resilient)
        .replace('{risk}', risk);
      const windowDay = bw.worstWindowDayOfYear;
      const windowCoveragePart = Number.isFinite(Number(bw.windowCoverage))
        ? `<span>${escapeHtml(i18n.t('offgridL2.badWeatherWindowCoverage'))}: <strong style="color:var(--text)">${(Number(bw.windowCoverage) * 100).toFixed(1)}%</strong></span>`
        : '';
      const windowCriticalCoveragePart = Number.isFinite(Number(bw.windowCriticalCoverage))
        ? `<span>${escapeHtml(i18n.t('offgridL2.badWeatherWindowCriticalCoverage'))}: <strong style="color:var(--text)">${(Number(bw.windowCriticalCoverage) * 100).toFixed(1)}%</strong></span>`
        : '';
      const windowPart = windowDay
        ? `<span style="color:var(--text-muted);font-size:0.72rem">${escapeHtml(i18n.t('offgridL2.badWeatherWindowDay') || 'En kötü pencere: gün')} ${windowDay}</span>`
        : '';
      const addGenPart = bw.additionalGeneratorKwh > 0
        ? `<div style="margin-top:4px">${escapeHtml(i18n.t('offgridL2.addGenKwh'))}: <strong>${Math.round(bw.additionalGeneratorKwh).toLocaleString(locale)} kWh</strong></div>`
        : '';
      bwDetails.innerHTML = `
        <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:6px">
          <span>${escapeHtml(i18n.t('offgridL2.badWeatherLevel'))}: <strong style="color:var(--text)">${escapeHtml(i18n.t(levelKey))}</strong></span>
          <span>${escapeHtml(i18n.t('offgridL2.criticalDropLabel'))}: <strong style="color:#EF4444">−${critDrop}%</strong></span>
          <span>${escapeHtml(i18n.t('offgridL2.totalDropLabel'))}: <strong style="color:#F59E0B">−${totalDrop}%</strong></span>
          ${windowCoveragePart}
          ${windowCriticalCoveragePart}
          ${windowPart}
        </div>
        <div style="font-size:0.72rem;color:var(--text-muted);font-style:italic">${escapeHtml(narrative)}</div>
        ${addGenPart}
      `;
    } else {
      bwWrap.style.display = 'none';
    }
  }

  // Yaşam döngüsü maliyeti
  const lcWrap = document.getElementById('offgrid-lifecycle-details');
  if (lcWrap) {
    lcWrap.innerHTML = `${escapeHtml(i18n.t('offgridL2.lifecycleAnnual'))}: <strong>${money(L.lifecycleCostAnnual)} / ${escapeHtml(i18n.t('units.year'))}</strong>`;
  }

  // Genişletilmiş dispatch metrikleri
  const extMetricsEl = document.getElementById('offgrid-extended-metrics');
  const extMetricsBody = document.getElementById('offgrid-extended-metrics-body');
  if (extMetricsEl && extMetricsBody) {
    extMetricsEl.style.display = '';
    const stat = (label, val, color) =>
      `<span style="color:var(--text-muted);font-size:0.75rem">${escapeHtml(label)}: <strong style="color:${color||'var(--text)'}">${escapeHtml(val)}</strong></span>`;
    const items = [
      stat(i18n.t('offgridL2.resultTotalLoad'), `${Math.round(L.annualTotalLoadKwh || 0).toLocaleString(locale)} kWh/yıl`, 'var(--text)'),
      L.annualCriticalLoadKwh > 0 ? stat(i18n.t('offgridL2.resultCriticalLoad'), `${Math.round(L.annualCriticalLoadKwh).toLocaleString(locale)} kWh/yıl`, '#EF4444') : '',
      L.accuracyScore != null ? stat(i18n.t('offgridL2.accuracyScoreLabel'), `${L.accuracyScore}/100 · ${uncertaintyText}`, accuracyColor) : '',
      stat(i18n.t('offgridL2.pvBessCoverageLabel'), `${((L.pvBatteryLoadCoverage ?? L.totalLoadCoverage) * 100).toFixed(1)}%`, '#22C55E'),
      stat(i18n.t('offgridL2.pvBessCriticalCoverageLabel'), `${((L.pvBatteryCriticalCoverage ?? L.criticalLoadCoverage) * 100).toFixed(1)}%`, '#22C55E'),
      stat(i18n.t('offgridL2.directPvLabel'), `${Math.round(L.directPvKwh || 0).toLocaleString(locale)} kWh/yıl`, '#F59E0B'),
      stat(i18n.t('offgridL2.batteryLabel'), `${Math.round(L.batteryKwh || 0).toLocaleString(locale)} kWh/yıl`, '#8B5CF6'),
      L.minimumSoc != null ? stat(i18n.t('offgridL2.minSocLabel'), `${(L.minimumSoc * 100).toFixed(1)}%`, '#94A3B8') : '',
      L.averageSoc != null ? stat(i18n.t('offgridL2.avgSocLabel'), `${(L.averageSoc * 100).toFixed(1)}%`, '#94A3B8') : '',
      L.inverterAcLimitKw != null ? stat(i18n.t('offgridL2.inverterLimitLabel'), `${Number(L.inverterAcLimitKw).toFixed(1)} kW AC`, '#F59E0B') : '',
      L.batteryMaxChargeKw != null || L.batteryMaxDischargeKw != null ? stat(i18n.t('offgridL2.batteryPowerLimitLabel'), `${L.batteryMaxChargeKw ?? '—'} / ${L.batteryMaxDischargeKw ?? '—'} kW`, '#8B5CF6') : '',
      (L.inverterPowerLimitedKwh || 0) > 0 ? stat(i18n.t('offgridL2.powerLimitedLabel'), `${Math.round(L.inverterPowerLimitedKwh).toLocaleString(locale)} kWh (${L.inverterPowerLimitHours || 0} h)`, '#EF4444') : '',
      L.autonomousDays != null ? stat(i18n.t('offgridL2.resultAutonomousDays'), `${L.autonomousDays} gün (${L.autonomousDaysPct != null ? L.autonomousDaysPct.toFixed(1) : '—'}%)`, '#22C55E') : '',
      L.generatorEnabled && L.autonomousDaysWithGenerator != null ? stat(i18n.t('offgridL2.resultAutonomousDaysWithGenerator'), `${L.autonomousDaysWithGenerator} gün (${L.autonomousDaysWithGeneratorPct != null ? L.autonomousDaysWithGeneratorPct.toFixed(1) : '—'}%)`, '#F59E0B') : '',
      L.cyclesPerYear != null ? stat(i18n.t('offgridL2.resultCyclesPerYear'), L.cyclesPerYear.toFixed(0), 'var(--text-muted)') : '',
    ].filter(Boolean);
    extMetricsBody.innerHTML = items.join('');
  }

  // Cihaz özet metrikleri (cihaz listesi modunda)
  const deviceMetricsEl = document.getElementById('offgrid-device-metrics');
  if (deviceMetricsEl) {
    if (L.loadMode === 'device-list' && L.deviceCount > 0) {
      const totalWh = L.annualTotalLoadKwh > 0 ? (L.annualTotalLoadKwh / 365 * 1000).toFixed(0) : '—';
      const critWh  = L.annualCriticalLoadKwh > 0 ? (L.annualCriticalLoadKwh / 365 * 1000).toFixed(0) : '0';
      deviceMetricsEl.style.display = '';
      deviceMetricsEl.innerHTML = `
        <div style="display:flex;flex-wrap:wrap;gap:10px;font-size:0.75rem">
          <span style="color:var(--text-muted)">${escapeHtml(i18n.t('offgridL2.deviceCount'))}: <strong style="color:var(--text)">${L.deviceCount}</strong></span>
          <span style="color:var(--text-muted)">${escapeHtml(i18n.t('offgridL2.totalDailyWh'))}: <strong style="color:var(--text)">${totalWh} Wh/gün</strong></span>
          <span style="color:var(--text-muted)">${escapeHtml(i18n.t('offgridL2.criticalDailyWh'))}: <strong style="color:#EF4444">${critWh} Wh/gün</strong></span>
          <span style="color:var(--text-muted)">${escapeHtml(i18n.t('offgridL2.criticalDeviceCount'))}: <strong style="color:#EF4444">${L.criticalDeviceCount || 0}</strong></span>
        </div>`;
    } else {
      if (L.loadMode === 'hourly-8760') {
        deviceMetricsEl.style.display = '';
        deviceMetricsEl.innerHTML = `<div style="font-size:0.75rem;color:var(--text-muted)">${escapeHtml(i18n.t('offgridL2.loadSourceHourly'))}</div>`;
      } else {
        deviceMetricsEl.style.display = 'none';
      }
    }
  }

  // Karşılanamayan yük uyarısı
  const unmetWarnEl = document.getElementById('offgrid-unmet-warn');
  if (unmetWarnEl) {
    const unmetKwh = Math.round(L.unmetLoadKwh || 0);
    if (unmetKwh > 10) {
      const msg = i18n.t(L.generatorEnabled
        ? 'offgridL2.genNarrativeUnmetWithGenerator'
        : 'offgridL2.honestUnmetWarning')
        .replace('{unmet}', unmetKwh.toLocaleString(locale));
      unmetWarnEl.style.display = '';
      unmetWarnEl.textContent = msg;
    } else {
      unmetWarnEl.style.display = 'none';
    }
  }

  // Kaynak şeffaflığı (üretim + yük kaynağı)
  const sourceTransEl = document.getElementById('offgrid-source-transparency');
  if (sourceTransEl) {
    const prodSource = L.productionSourceLabel || (L.productionFallback ? i18n.t('pvgis.fallbackUsed') : i18n.t('pvgis.liveSuccess'));
    const loadSrc = L.loadMode === 'hourly-8760'
      ? i18n.t('offgridL2.loadSourceHourly')
      : (L.loadMode === 'device-list' ? i18n.t('offgridL2.loadSourceDeviceList') : i18n.t('offgridL2.loadSourceSimple'));
    const dispatchLabel = L.dispatchType === 'hourly-8760-dispatch'
      ? i18n.t('offgridL2.dispatchHourly')
      : i18n.t('offgridL2.syntheticDispatch');
    const productionDispatchText = L.productionDispatchProfile === 'real-hourly-pv-8760'
      ? i18n.t('offgridL2.productionDispatchReal')
      : i18n.t('offgridL2.productionDispatchSynthetic');
    const parityText = L.parityAvailable
      ? `<span style="color:#22C55E">✓ ${escapeHtml(i18n.t('offgridL2.parityAvailable'))}</span>`
      : `<span style="color:#94A3B8">${escapeHtml(i18n.t('offgridL2.parityNotAvailable'))}</span>`;
    const fallbackBadge = L.productionFallback
      ? `<span style="background:rgba(245,158,11,0.15);color:#F59E0B;border:1px solid rgba(245,158,11,0.3);border-radius:4px;padding:1px 6px;font-size:0.68rem;margin-left:4px">${escapeHtml(i18n.t('offgridL2.fallbackUsed'))}</span>`
      : `<span style="background:rgba(34,197,94,0.12);color:#22C55E;border:1px solid rgba(34,197,94,0.25);border-radius:4px;padding:1px 6px;font-size:0.68rem;margin-left:4px">${escapeHtml(i18n.t('offgridL2.liveData'))}</span>`;
    const tierLabel = i18n.t(`offgridL2.accuracyTier_${accuracy?.tier || L.accuracyTier || 'basic-synthetic'}`);
    const modeLabel = i18n.t(`offgridL2.calculationMode_${accuracy?.calculationMode || L.calculationMode || 'basic'}`);
    const mainAccuracyBlocker = accuracy?.blockers?.[0] || '';
    sourceTransEl.style.display = '';
    sourceTransEl.innerHTML = `
      ${accuracy ? `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;margin-bottom:8px">
        <div style="background:rgba(15,23,42,0.35);border:1px solid rgba(148,163,184,0.14);border-radius:8px;padding:8px">
          <div style="font-size:0.66rem;color:var(--text-muted)">${escapeHtml(i18n.t('offgridL2.accuracyScoreLabel'))}</div>
          <div style="font-size:1rem;font-weight:800;color:${accuracyColor}">${L.accuracyScore}/100</div>
        </div>
        <div style="background:rgba(15,23,42,0.35);border:1px solid rgba(148,163,184,0.14);border-radius:8px;padding:8px">
          <div style="font-size:0.66rem;color:var(--text-muted)">${escapeHtml(i18n.t('offgridL2.expectedUncertaintyLabel'))}</div>
          <div style="font-size:1rem;font-weight:800;color:${accuracyColor}">${escapeHtml(uncertaintyText)}</div>
        </div>
        <div style="background:rgba(15,23,42,0.35);border:1px solid rgba(148,163,184,0.14);border-radius:8px;padding:8px">
          <div style="font-size:0.66rem;color:var(--text-muted)">${escapeHtml(i18n.t('offgridL2.calculationModeLabel'))}</div>
          <div style="font-size:0.82rem;font-weight:700;color:var(--text)">${escapeHtml(modeLabel)} · ${escapeHtml(tierLabel)}</div>
        </div>
      </div>
      <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:8px;line-height:1.45">
        ${escapeHtml(accuracy.interpretation || i18n.t('offgridL2.accuracyInterpretationFallback'))}
        ${mainAccuracyBlocker ? `<br><span style="color:#F59E0B">${escapeHtml(mainAccuracyBlocker)}</span>` : ''}
      </div>` : ''}
      <div style="font-size:0.72rem;color:var(--text-muted);display:flex;flex-wrap:wrap;gap:10px;align-items:center">
        <span>${escapeHtml(i18n.t('offgridL2.productionSource'))}: <strong style="color:var(--text)">${escapeHtml(prodSource)}</strong>${fallbackBadge}</span>
        <span>${escapeHtml(productionDispatchText)}</span>
        <span>${escapeHtml(i18n.t('offgridL2.loadSourceLabel'))}: <strong style="color:var(--text)">${escapeHtml(loadSrc)}</strong></span>
        <span>${escapeHtml(i18n.t('offgridL2.dispatchLabel'))}: <strong style="color:var(--text)">${escapeHtml(dispatchLabel)}</strong></span>
        ${parityText}
      </div>
      ${L.fieldGuaranteeReadiness ? `
      <div style="margin-top:6px;font-size:0.68rem;color:${L.fieldGuaranteeReadiness.phase1Ready ? '#22C55E' : '#F59E0B'}">
        ${escapeHtml(i18n.t('offgridL2.fieldGuaranteeStatus'))}: <strong>${escapeHtml(i18n.t(L.fieldGuaranteeReadiness.phase1Ready ? 'offgridL2.fieldGuaranteePhase1Ready' : 'offgridL2.fieldGuaranteeBlocked'))}</strong>
        ${L.fieldGuaranteeReadiness.blockers?.length ? ` — ${escapeHtml(L.fieldGuaranteeReadiness.blockers[0])}` : ''}
      </div>` : ''}
      ${L.fieldEvidenceGate ? `
      <div style="margin-top:6px;font-size:0.68rem;color:${L.fieldEvidenceGate.phase2Ready ? '#22C55E' : '#F59E0B'}">
        ${escapeHtml(i18n.t('offgridL2.fieldEvidenceStatus'))}: <strong>${escapeHtml(i18n.t(L.fieldEvidenceGate.phase2Ready ? 'offgridL2.fieldEvidenceReady' : 'offgridL2.fieldEvidenceBlocked'))}</strong>
        ${L.fieldEvidenceGate.blockers?.length ? ` — ${escapeHtml(L.fieldEvidenceGate.blockers[0])}` : ''}
      </div>` : ''}
      ${L.fieldModelMaturityGate ? `
      <div style="margin-top:6px;font-size:0.68rem;color:${L.fieldModelMaturityGate.phase3Ready ? '#22C55E' : '#F59E0B'}">
        ${escapeHtml(i18n.t('offgridL2.fieldModelStatus'))}: <strong>${escapeHtml(i18n.t(L.fieldModelMaturityGate.phase3Ready ? 'offgridL2.fieldModelReady' : 'offgridL2.fieldModelBlocked'))}</strong>
        ${L.fieldModelMaturityGate.blockers?.length ? ` — ${escapeHtml(L.fieldModelMaturityGate.blockers[0])}` : ''}
      </div>` : ''}
      ${L.fieldAcceptanceGate ? `
      <div style="margin-top:6px;font-size:0.68rem;color:${L.fieldAcceptanceGate.phase4Ready ? '#22C55E' : '#F59E0B'}">
        ${escapeHtml(i18n.t('offgridL2.fieldAcceptanceStatus'))}: <strong>${escapeHtml(i18n.t(L.fieldAcceptanceGate.phase4Ready ? 'offgridL2.fieldAcceptanceReady' : 'offgridL2.fieldAcceptanceBlocked'))}</strong>
        ${L.fieldAcceptanceGate.blockers?.length ? ` — ${escapeHtml(L.fieldAcceptanceGate.blockers[0])}` : ''}
      </div>` : ''}
      ${L.fieldOperationGate ? `
      <div style="margin-top:6px;font-size:0.68rem;color:${L.fieldOperationGate.phase5Ready ? '#22C55E' : '#F59E0B'}">
        ${escapeHtml(i18n.t('offgridL2.fieldOperationStatus'))}: <strong>${escapeHtml(i18n.t(L.fieldOperationGate.phase5Ready ? 'offgridL2.fieldOperationReady' : 'offgridL2.fieldOperationBlocked'))}</strong>
        ${L.fieldOperationGate.blockers?.length ? ` — ${escapeHtml(L.fieldOperationGate.blockers[0])}` : ''}
      </div>` : ''}
      ${L.fieldRevalidationGate ? `
      <div style="margin-top:6px;font-size:0.68rem;color:${L.fieldRevalidationGate.phase6Ready ? '#22C55E' : '#F59E0B'}">
        ${escapeHtml(i18n.t('offgridL2.fieldRevalidationStatus'))}: <strong>${escapeHtml(i18n.t(L.fieldRevalidationGate.phase6Ready ? 'offgridL2.fieldRevalidationReady' : 'offgridL2.fieldRevalidationBlocked'))}</strong>
        ${L.fieldRevalidationGate.blockers?.length ? ` — ${escapeHtml(L.fieldRevalidationGate.blockers[0])}` : ''}
      </div>` : ''}
      <div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:8px;font-size:0.68rem;color:var(--text-muted)">
        <span>⚗ ${escapeHtml(i18n.t('offgridL2.honestSyntheticNote'))}</span>
        <span>📊 ${escapeHtml(i18n.t('offgridL2.honestPreFeasibility'))}</span>
        <span>🏗 ${escapeHtml(i18n.t('offgridL2.honestSiteRequired'))}</span>
      </div>`;
  }

  // Versiyon damgası ve yük modu
  const versionEl = document.getElementById('offgrid-l2-version');
  if (versionEl) versionEl.textContent = L.dispatchVersion || '';
  const loadModeEl = document.getElementById('offgrid-l2-load-mode');
  if (loadModeEl) {
    const modeKey = L.loadMode === 'hourly-8760'
      ? 'offgridL2.loadModeHourly'
      : (L.loadMode === 'device-list' ? 'offgridL2.loadModeDeviceList' : 'offgridL2.loadModeSimple');
    loadModeEl.textContent = i18n.t(modeKey);
  }
}

function renderNMResults(nm, enabled) {
  const section = document.getElementById('nm-result-section');
  if (!section) return;
  const scenarioAllowsExport = window.state?.scenarioContext?.visibleBlocks?.netMetering !== false;
  if (!nm || !enabled || !scenarioAllowsExport) { section.style.display = 'none'; return; }
  section.style.display = 'block';
  document.getElementById('nm-license-badge').textContent = enabled ? nm.systemType : 'Satış kapalı';
  document.getElementById('nm-export-kwh').textContent = `${nm.paidGridExport.toLocaleString('tr-TR')} / ${nm.annualGridExport.toLocaleString('tr-TR')}`;
  document.getElementById('nm-export-revenue').textContent = money(nm.annualExportRevenue);
  document.getElementById('nm-self-consumption').textContent = `${nm.selfConsumptionPct}%`;
}

function onGridConfidenceAssessment(state, r) {
  const missing = [];
  // Core data blockers
  if (!Array.isArray(state.hourlyConsumption8760) || state.hourlyConsumption8760.length !== 8760) missing.push(i18n.t('onGridResult.missingHourly'));
  if (state.exportSettlementMode === 'auto' && !state.settlementDate) missing.push(i18n.t('onGridResult.missingSettlementDate'));
  if (!state.roofGeometry) missing.push(i18n.t('onGridResult.missingRoofGeometry'));
  if (!state.hasSignedCustomerBillData && state.evidence?.customerBill?.status !== 'verified') missing.push(i18n.t('onGridResult.missingBillEvidence'));
  if (!state.tariffSourceCheckedAt) missing.push(i18n.t('onGridResult.missingTariffCheck'));

  // Shadow quality
  const shadowQuality = r.shadowQuality || state.shadingQuality || 'user-estimate';
  if (shadowQuality === 'unknown') missing.push(i18n.t('onGridResult.missingShading'));
  else if (!state.osmShadowEnabled && shadowQuality !== 'site-verified' && shadowQuality !== 'map-assisted') missing.push(i18n.t('onGridResult.missingShading'));

  // Cost confidence
  const costSourceType = r.costSourceType || state.costSourceType || 'catalog';
  if (costSourceType !== 'bom-verified') missing.push(i18n.t('onGridResult.missingCostOverride'));

  // Tariff source quality
  const tariffSourceType = r.tariffSourceType || state.tariffSourceType || 'manual';
  const tariffIsBlocker = tariffSourceType !== 'official';
  if (tariffIsBlocker) missing.push(i18n.t('warnings.manualTariff'));

  let score = 100 - missing.length * 10;
  if (r.usedFallback) score -= 25;
  if (r.authoritativeEngineSource?.pvlibBacked) score += 5;
  // Graduated deductions for soft-warnings (don't add to missing list)
  if ((r.hourlyProfileSource || state.hourlyProfileSource) === 'synthetic') score -= 5;
  const productionProfileSource = r.productionProfileSource || 'monthly-derived-synthetic-pv';
  const hasHourlyPvProfile = productionProfileSource === 'backend-pvlib-hourly'
    || productionProfileSource === 'pvgis-seriescalc-hourly'
    || productionProfileSource === 'user-hourly-pv-normalized-to-authoritative-annual';
  if (!hasHourlyPvProfile) score -= 5;
  if (shadowQuality === 'user-estimate') score -= 5;
  score = Math.max(0, Math.min(100, score));

  // quoteCandidate requires: no fallback, score ≥ 82, ≤1 missing, bom-verified cost, official/manual tariff, shadow ≠ unknown
  const isQuoteCandidate = !r.usedFallback && score >= 82 && missing.length <= 1
    && costSourceType === 'bom-verified'
    && tariffSourceType === 'official'
    && hasHourlyPvProfile
    && shadowQuality !== 'unknown'
    && shadowQuality !== 'user-estimate';

  const level = r.usedFallback || score < 55
    ? 'rough'
    : isQuoteCandidate
      ? 'quoteCandidate'
      : 'engineering';
  return { score, level, missing, shadowQuality, costSourceType, tariffSourceType };
}

function renderOnGridResultLayers(state, r) {
  const wrap = document.getElementById('on-grid-result-layers');
  if (!wrap) return;
  if (state.scenarioKey !== 'on-grid') {
    wrap.style.display = 'none';
    wrap.innerHTML = '';
    return;
  }
  const assessment = onGridConfidenceAssessment(state, r);
  const levelLabels = {
    rough: i18n.t('onGridResult.roughEstimate'),
    engineering: i18n.t('onGridResult.engineeringEstimate'),
    quoteCandidate: i18n.t('onGridResult.quoteReadyCandidate')
  };
  const roofAreaTotal = (Number(state.roofArea) || 0) + (state.multiRoof ? (state.roofSections || []).reduce((s, sec) => s + (Number(sec.area) || 0), 0) : 0);
  const panelSpec = resolvePanelSpec(state, state.panelType);
  const panelArea = (panelSpec.areaM2 || 0) * (Number(r.panelCount) || 0);
  const roofUsePct = roofAreaTotal > 0 ? Math.min(100, panelArea / roofAreaTotal * 100) : 0;
  const comp = r.compensationSummary || {};
  const exportText = `${Math.round(r.nmMetrics?.paidGridExport || 0).toLocaleString(localeTag())} / ${Math.round(r.nmMetrics?.annualGridExport || 0).toLocaleString(localeTag())} kWh`;
  const readinessStatus = statusLabel(r.quoteReadiness?.status || 'not-quote-ready');
  const blockers = localizeMessageList(r.quoteReadiness?.blockers || []).slice(0, 4);
  const missingHtml = assessment.missing.length
    ? assessment.missing.map(item => `<li>${escapeHtml(item)}</li>`).join('')
    : `<li>${escapeHtml(i18n.t('onGridResult.noMajorMissingData'))}</li>`;
  const multiRoofNote = state.multiRoof && Array.isArray(r.sectionResults) && r.sectionResults.length > 1
    ? `${r.sectionResults.length} ${i18n.t('onGridResult.roofSurfaces')}`
    : i18n.t('onGridResult.singleRoof');
  const usageProfileLabels = {
    'daytime-heavy': i18n.t('onGridFlow.profileDaytime'),
    balanced: i18n.t('onGridFlow.profileBalanced'),
    'evening-heavy': i18n.t('onGridFlow.profileEvening'),
    'business-hours': i18n.t('onGridFlow.profileBusiness')
  };
  const usageProfileText = usageProfileLabels[state.usageProfile] || state.usageProfile || i18n.t('onGridFlow.profileBalanced');

  // Profile source labels
  const profileSourceKey = r.hourlyProfileSource || state.hourlyProfileSource || 'synthetic';
  const profileSourceLabels = {
    'hourly-uploaded': i18n.t('onGridResult.profileSourceHourly'),
    'monthly-derived': i18n.t('onGridResult.profileSourceMonthly'),
    'synthetic': i18n.t('onGridResult.profileSourceSynthetic')
  };
  const profileSourceText = profileSourceLabels[profileSourceKey] || profileSourceLabels.synthetic;
  const profileSourceClass = profileSourceKey === 'hourly-uploaded' ? 'data-source-good' : profileSourceKey === 'monthly-derived' ? 'data-source-ok' : 'data-source-warn';
  const productionProfileSourceKey = r.productionProfileSource || 'monthly-derived-synthetic-pv';
  const productionProfileLabels = {
    'backend-pvlib-hourly': 'Canlı veriyle detaylı üretim modeli',
    'pvgis-seriescalc-hourly': 'Canlı güneş verisiyle saatlik hesap',
    'user-hourly-pv-normalized-to-authoritative-annual': 'Saatlik üretim profiline göre hesap',
    'monthly-derived-synthetic-pv': 'Aylık veriye göre hızlı üretim tahmini'
  };
  const productionProfileText = productionProfileLabels[productionProfileSourceKey] || productionProfileSourceKey;
  const productionProfileClass = productionProfileSourceKey === 'backend-pvlib-hourly' || productionProfileSourceKey === 'pvgis-seriescalc-hourly' || productionProfileSourceKey === 'user-hourly-pv-normalized-to-authoritative-annual'
    ? 'data-source-good'
    : 'data-source-warn';

  // Shadow quality display
  const shadowQuality = assessment.shadowQuality;
  const shadowLabels = {
    'site-verified': i18n.t('onGridFlow.shadingSite'),
    'map-assisted': i18n.t('onGridFlow.shadingMap'),
    'user-estimate': i18n.t('onGridFlow.shadingUser'),
    'unknown': i18n.t('onGridFlow.shadingUnknown')
  };
  const shadowText = shadowLabels[shadowQuality] || shadowQuality;
  const shadowClass = shadowQuality === 'site-verified' ? 'data-source-good' : shadowQuality === 'map-assisted' ? 'data-source-ok' : 'data-source-warn';

  // Tariff mode display
  const tariffInputMode = r.tariffInputMode || state.tariffInputMode || 'net-plus-fee';
  const tariffModeText = tariffInputMode === 'gross' ? i18n.t('onGridResult.tariffModeGross') : i18n.t('onGridResult.tariffModeNet');
  const settlementIntervalRaw = comp.settlementInterval || r.tariffModel?.exportCompensationPolicy?.interval || '—';
  const settlementIntervalLabels = {
    monthly: 'Aylık dengeleme',
    hourly: 'Saatlik dengeleme',
    annual: 'Yıllık dengeleme',
    yearly: 'Yıllık dengeleme'
  };
  const settlementBasisText = r.settlementProvisional
    ? (() => {
        const importOffsetKwh = r.compensationSummary?.importOffsetKwh ?? 0;
        const effectiveImport = (r.tariffModel?.importRate ?? 0) + (r.tariffModel?.distributionFee ?? 0);
        const exportRt = r.tariffModel?.exportRate ?? 0;
        const annualDelta = Math.round(importOffsetKwh * (effectiveImport - exportRt));
        const deltaStr = annualDelta > 0
          ? ` (aylık mod saatliğe göre yılda yaklaşık ${annualDelta.toLocaleString('tr-TR')} TL daha avantajlı)`
          : '';
        return i18n.t('onGridResult.settlementProvisional') + deltaStr;
      })()
    : `${settlementIntervalLabels[settlementIntervalRaw] || settlementIntervalRaw}${comp.annualExportCapKwh ? ` / yıllık ${Math.round(comp.annualExportCapKwh).toLocaleString(localeTag())} kWh sınır` : ''}`;

  // Tariff source display
  const tariffSourceType = assessment.tariffSourceType;
  const tariffSourceLabels = {
    'official': i18n.t('onGridFlow.tariffSourceOfficial'),
    'manual': i18n.t('onGridFlow.tariffSourceManual'),
    'estimate': i18n.t('onGridFlow.tariffSourceEstimate')
  };
  const tariffSourceText = tariffSourceLabels[tariffSourceType] || tariffSourceType;
  const tariffSourceClass = tariffSourceType === 'official' ? 'data-source-good' : tariffSourceType === 'manual' ? 'data-source-ok' : 'data-source-warn';

  // Cost source display
  const costSourceType = assessment.costSourceType;
  const costSourceLabels = {
    'bom-verified': i18n.t('onGridFlow.costSourceBom'),
    'manual': i18n.t('onGridFlow.costSourceManual'),
    'catalog': i18n.t('onGridFlow.costSourceCatalog')
  };
  const costSourceText = costSourceLabels[costSourceType] || costSourceType;
  const costSourceClass = costSourceType === 'bom-verified' ? 'data-source-good' : costSourceType === 'manual' ? 'data-source-ok' : 'data-source-warn';

  // Engine parity — intentionalDifference=true only when backend pvlib was used
  const engineMode = r.calculationMode || r.authoritativeEngineMode || '—';
  const engineModeLabels = {
    'python-pvlib-backed': 'Detaylı mühendislik hesap motoru',
    'python-backend': 'Detaylı mühendislik hesap motoru',
    'browser-pvgis': 'Canlı güneş verisiyle standart hesap',
    'pvgis-live': 'Canlı güneş verisiyle standart hesap',
    'pvlib-service': 'Detaylı mühendislik hesap motoru',
    'local-fallback': 'Yerel tahmin modeli',
    'fallback-psh': 'Yerel tahmin modeli'
  };
  const engineModeText = engineModeLabels[engineMode] || engineMode;
  const parityData = r.engineParity || null;
  const parityIsReal = parityData?.intentionalDifference === true;
  let engineParityHtml = '';
  let parityRowClass = 'data-source-ok';
  let parityRowText = '';
  if (!parityData || !parityIsReal) {
    // No backend comparison — do NOT show 0% or any numeric diff
    parityRowClass = 'data-source-warn';
    parityRowText = i18n.t('onGridResult.parityUnavailable');
    engineParityHtml = `<div class="on-grid-explain" style="font-size:.78rem;color:var(--text-muted)">${escapeHtml(i18n.t('engine.comparisonUnavailableHint'))}</div>`;
  } else {
    // Real backend comparison available — use deltaPct (correct field name)
    const diff = typeof parityData.deltaPct === 'number' ? parityData.deltaPct : 0;
    const diffAbs = Math.abs(diff);
    parityRowClass = diffAbs > 10 ? 'data-source-warn' : 'data-source-good';
    parityRowText = `${diff > 0 ? '+' : ''}${diff.toFixed(1)}% (${Math.round(parityData.deltaKwh || 0).toLocaleString(localeTag())} kWh)`;
    if (diffAbs > 10) {
      engineParityHtml = `<div class="on-grid-explain"><span class="data-source-warn">${escapeHtml(i18n.t('onGridResult.engineDiff'))}: ${parityRowText} — ${escapeHtml(i18n.t('onGridResult.engineDiffWarning'))}</span></div>`;
    }
  }

  wrap.style.display = '';
  wrap.innerHTML = `
    <section class="on-grid-result-card">
      <h3>${escapeHtml(i18n.t('onGridResult.technicalTitle'))}</h3>
      <p class="result-helper">Bu alan sistemin boyutunu, ne kadar elektrik üreteceğini ve tüketiminizle nasıl örtüştüğünü hızlıca görmeniz içindir.</p>
      <div class="on-grid-result-metrics">
        <div class="on-grid-result-metric"><strong>${Number(r.systemPower || 0).toFixed(2)} kWp</strong><span>${escapeHtml(i18n.t('onGridResult.installedPower'))}</span></div>
        <div class="on-grid-result-metric"><strong>${Number(r.panelCount || 0).toLocaleString(localeTag())}</strong><span>${escapeHtml(i18n.t('onGridResult.panelCount'))}</span></div>
        <div class="on-grid-result-metric"><strong>${Number(r.annualEnergy || 0).toLocaleString(localeTag())} kWh</strong><span>${escapeHtml(i18n.t('onGridResult.annualProduction'))}</span></div>
        <div class="on-grid-result-metric"><strong>${r.nmMetrics?.selfConsumptionPct || 0}%</strong><span>${escapeHtml(i18n.t('onGridResult.selfConsumption'))}</span></div>
        <div class="on-grid-result-metric"><strong>${Math.round(comp.directSelfConsumptionKwh || 0).toLocaleString(localeTag())} kWh</strong><span>${escapeHtml(i18n.t('onGridResult.directSelfConsumption'))}</span></div>
        <div class="on-grid-result-metric"><strong>${Math.round(comp.importOffsetKwh || 0).toLocaleString(localeTag())} kWh</strong><span>${escapeHtml(i18n.t('onGridResult.monthlyOffset'))}</span></div>
        <div class="on-grid-result-metric"><strong>${exportText}</strong><span>${escapeHtml(i18n.t('onGridResult.exportableEnergy'))}</span></div>
        <div class="on-grid-result-metric"><strong>${roofUsePct.toFixed(1)}%</strong><span>${escapeHtml(i18n.t('onGridResult.roofUse'))} · ${escapeHtml(multiRoofNote)}</span></div>
        <div class="on-grid-result-metric"><strong>${r.ysp} kWh/kWp</strong><span>${escapeHtml(i18n.t('onGridResult.specificYield'))}</span></div>
        <div class="on-grid-result-metric"><strong>${escapeHtml(usageProfileText)}</strong><span>${escapeHtml(i18n.t('onGridResult.loadProfile'))}</span></div>
        <div class="on-grid-result-metric"><strong><span class="${profileSourceClass}">${escapeHtml(profileSourceText)}</span></strong><span>${escapeHtml(i18n.t('onGridResult.profileSourceLabel'))}</span></div>
        <div class="on-grid-result-metric"><strong><span class="${productionProfileClass}">${escapeHtml(productionProfileText)}</span></strong><span>${escapeHtml(i18n.t('onGridResult.productionSourceLabel'))}</span></div>
        <div class="on-grid-result-metric"><strong><span class="${shadowClass}">${escapeHtml(shadowText)}</span></strong><span>${escapeHtml(i18n.t('onGridResult.shadowQualityLabel'))}</span></div>
      </div>
    </section>
    <section class="on-grid-result-card">
      <h3>${escapeHtml(i18n.t('onGridResult.economicTitle'))}</h3>
      <p class="result-helper">Burada yatırım bütçesi, yıllık fayda ve geri ödeme tarafı sade bir dille özetlenir.</p>
      <div class="on-grid-result-metrics">
        <div class="on-grid-result-metric"><strong>${money(r.totalCost)}</strong><span>${escapeHtml(i18n.t('onGridResult.totalCost'))}</span></div>
        <div class="on-grid-result-metric"><strong>${money(r.financialCostBasis || r.totalCost)}</strong><span>${escapeHtml(i18n.t('onGridResult.financialBasis'))}</span></div>
        <div class="on-grid-result-metric"><strong>${money(r.annualSavings)}</strong><span>${escapeHtml(i18n.t('onGridResult.annualSavings'))}</span></div>
        <div class="on-grid-result-metric"><strong>${money(r.firstYearNetCashFlow ?? 0)}</strong><span>${escapeHtml(i18n.t('onGridResult.firstYearNetCashFlow'))}</span></div>
        <div class="on-grid-result-metric"><strong>${r.grossSimplePaybackYear ? Number(r.grossSimplePaybackYear).toFixed(1) : '>25'} ${escapeHtml(i18n.t('units.year'))}</strong><span>${escapeHtml(i18n.t('finance.grossSimplePayback'))}</span></div>
        <div class="on-grid-result-metric"><strong>${money(r.npvTotal)}</strong><span>${escapeHtml(i18n.t('onGridResult.netGainPotential'))}</span></div>
        <div class="on-grid-result-metric"><strong>${r.irr === 'N/A' ? 'N/A' : r.irr + '%'}</strong><span>${escapeHtml(i18n.t('onGridResult.averageAnnualReturn'))}</span></div>
        <div class="on-grid-result-metric"><strong>${moneyRate(r.compensatedLcoe || r.lcoe, 'kWh')}</strong><span>${escapeHtml(i18n.t(r.compensatedLcoe ? 'onGridResult.compensatedLcoeLabel' : 'onGridResult.lcoeLabel'))}</span></div>
        <div class="on-grid-result-metric"><strong>${r.roi}%</strong><span>${escapeHtml(i18n.t('onGridResult.roiLabel'))}</span></div>
        <div class="on-grid-result-metric"><strong>${escapeHtml(settlementBasisText)}</strong><span>${escapeHtml(i18n.t('onGridResult.settlementBasisLabel'))}</span></div>
        <div class="on-grid-result-metric"><strong>${escapeHtml(tariffModeText)}</strong><span>${escapeHtml(i18n.t('onGridResult.pricingModeLabel'))}</span></div>
        <div class="on-grid-result-metric"><strong><span class="${costSourceClass}">${escapeHtml(costSourceText)}</span></strong><span>${escapeHtml(i18n.t('onGridResult.costConfidenceLabel'))}</span></div>
      </div>
    </section>
    <section class="on-grid-result-card">
      <h3>${escapeHtml(i18n.t('onGridResult.confidenceTitle'))}</h3>
      <p class="result-helper">Bu bölüm, sonucun hangi veri kalitesiyle üretildiğini ve teklif aşamasında ne kadar sağlam olduğunu anlatır.</p>
      <div class="confidence-pill">${escapeHtml(levelLabels[assessment.level])} · ${assessment.score}/100</div>
      <p class="on-grid-explain on-grid-question"><strong>${escapeHtml(i18n.t('onGridResult.dataSourceQuestion'))}</strong></p>
      <div class="on-grid-data-source-table">
        <div class="on-grid-ds-row"><span>${escapeHtml(i18n.t('onGridResult.engine'))}</span><span>${escapeHtml(engineModeText)}</span></div>
        <div class="on-grid-ds-row"><span>${escapeHtml(i18n.t('onGridResult.profileSourceLabel'))}</span><span class="${profileSourceClass}">${escapeHtml(profileSourceText)}</span></div>
        <div class="on-grid-ds-row"><span>${escapeHtml(i18n.t('onGridResult.productionSourceLabel'))}</span><span class="${productionProfileClass}">${escapeHtml(productionProfileText)}</span></div>
        <div class="on-grid-ds-row"><span>${escapeHtml(i18n.t('onGridResult.tariffSourceLabel'))}</span><span class="${tariffSourceClass}">${escapeHtml(tariffSourceText)}</span></div>
        <div class="on-grid-ds-row"><span>${escapeHtml(i18n.t('onGridResult.shadowQualityLabel'))}</span><span class="${shadowClass}">${escapeHtml(shadowText)}</span></div>
        <div class="on-grid-ds-row"><span>${escapeHtml(i18n.t('onGridResult.costConfidenceLabel'))}</span><span class="${costSourceClass}">${escapeHtml(costSourceText)}</span></div>
        <div class="on-grid-ds-row"><span>${escapeHtml(i18n.t('onGridResult.settlementBasisLabel'))}</span><span class="${r.settlementProvisional ? 'data-source-warn' : 'data-source-good'}">${escapeHtml(settlementBasisText)}</span></div>
        <div class="on-grid-ds-row"><span>${escapeHtml(i18n.t('onGridResult.parityLabel'))}</span><span class="${parityRowClass}">${escapeHtml(parityRowText || i18n.t('onGridResult.parityUnavailable'))}</span></div>
      </div>
      ${engineParityHtml}
      <p class="on-grid-explain on-grid-question"><strong>${escapeHtml(i18n.t('onGridResult.missingDataQuestion'))}</strong></p>
      <ul class="on-grid-missing-list">${missingHtml}</ul>
    </section>
    <section class="on-grid-result-card">
      <h3>${escapeHtml(i18n.t('onGridResult.commercialTitle'))}</h3>
      <p class="result-helper">Bir sonraki adımda teklif veya uygulama sürecine geçmek için hangi hazırlıkların gerektiğini burada görürsünüz.</p>
      <div class="confidence-pill">${escapeHtml(readinessStatus)}</div>
      <div class="on-grid-explain">${escapeHtml(state.scenarioContext?.nextAction || i18n.t('onGridResult.commercialNextAction'))}</div>
      <ul class="on-grid-missing-list">${blockers.length ? blockers.map(item => `<li>${escapeHtml(item)}</li>`).join('') : `<li>${escapeHtml(i18n.t('onGridResult.noCommercialBlockers'))}</li>`}</ul>
    </section>
  `;
}

function renderBomResults(bom) {
  const techCard = document.getElementById('tech-table-body')?.closest('.card');
  if (!techCard) return;
  let card = document.getElementById('bom-result-card');
  if (!card) {
    card = document.createElement('div');
    card.id = 'bom-result-card';
    card.className = 'card';
    card.style.marginTop = '16px';
    techCard.insertAdjacentElement('afterend', card);
  }
  if (!bom?.rows?.length) {
    card.style.display = 'none';
    return;
  }
  card.style.display = 'block';
  card.innerHTML = `
    <details class="advanced-details">
      <summary class="advanced-details-summary">Kalem kalem maliyet listesi (isteğe bağlı)</summary>
      <div class="result-helper" style="margin-bottom:12px">Bu alan teklif hazırlarken kullanılan kalem kalem maliyet listesini gösterir. İlk bakışta gerekli değilse kapalı bırakabilirsiniz.</div>
      <table class="tech-table">
        <tbody>
          ${bom.rows.map(row => `<tr><td>${escapeHtml(row.supplier)} — ${escapeHtml(row.name)}</td><td>${Number(row.quantity || 0).toFixed(row.unit === 'fixed' ? 0 : 1)} ${escapeHtml(row.unit)}</td><td>${money(row.total)}</td></tr>`).join('')}
          <tr><td colspan="2"><strong>BOM Ara Toplam</strong></td><td><strong>${money(bom.subtotal)}</strong></td></tr>
          ${window.state?.results?.proposalGovernance?.bomCommercials ? `
          <tr><td colspan="2">Kontenjan / Risk payı</td><td>${money(window.state.results.proposalGovernance.bomCommercials.contingency)}</td></tr>
          <tr><td colspan="2">Brüt marj</td><td>${money(window.state.results.proposalGovernance.bomCommercials.margin)} (${window.state.results.proposalGovernance.bomCommercials.grossMarginPct}%)</td></tr>
          <tr><td colspan="2"><strong>Önerilen satış fiyatı</strong></td><td><strong>${money(window.state.results.proposalGovernance.bomCommercials.proposedSellPrice)}</strong></td></tr>` : ''}
        </tbody>
      </table>
    </details>
  `;
}

function renderWarningsAndAudit(state, r) {
  const techCard = document.getElementById('tech-table-body')?.closest('.card');
  if (!techCard) return;

  let audit = document.getElementById('audit-panel-card');
  if (!audit) {
    audit = document.createElement('div');
    audit.id = 'audit-panel-card';
    audit.className = 'card';
    audit.style.marginTop = '16px';
    techCard.insertAdjacentElement('afterend', audit);
  }

  const warnings = localizeMessageList(Array.isArray(r.calculationWarnings) ? r.calculationWarnings : []);
  const gov = r.proposalGovernance || {};
  const confidence = gov.confidence || {};
  const approval = gov.approval || {};
  const financing = gov.financing || {};
  const maintenance = gov.maintenance || {};
  const revision = gov.revision || {};
  const evidence = r.evidenceGovernance || {};
  const tariffSource = r.tariffSourceGovernance || {};
  const ledgerRows = (gov.ledger?.entries || []).slice(0, 8).map(entry =>
    `<tr><td>${escapeHtml(entry.key)}</td><td>${escapeHtml(entry.value)}</td><td>${escapeHtml(entry.confidence)}</td><td>${escapeHtml(entry.sourceLabel || '—')}</td></tr>`
  ).join('');
  const revisionRows = (revision.diff || []).slice(0, 8).map(item =>
    `<tr><td>${escapeHtml(item.key)}</td><td>${escapeHtml(item.before ?? '—')}</td><td>${escapeHtml(item.after ?? '—')}</td></tr>`
  ).join('');
  const evidenceRows = Object.entries(evidence.registry || {}).map(([key, record]) => {
    const latestFile = (record.files || []).slice(-1)[0];
    const fileText = latestFile ? `${latestFile.name} / ${String(latestFile.sha256 || '').slice(0, 12)}` : '—';
    return `<tr><td>${escapeHtml(key)}</td><td>${escapeHtml(statusLabel(record.status))}</td><td>${escapeHtml(record.ref || '—')}</td><td>${escapeHtml(record.checkedAt || record.issuedAt || '—')}</td><td>${escapeHtml(record.validUntil || '—')}</td><td>${escapeHtml(fileText)}</td></tr>`;
  }).join('');
  const auditRows = (state.auditLog || []).slice(-10).reverse().map(entry =>
    `<tr><td>${escapeHtml(entry.timestamp || '—')}</td><td>${escapeHtml(entry.action || '—')}</td><td>${escapeHtml(entry.user?.name || '—')} (${escapeHtml(entry.user?.role || '—')})</td></tr>`
  ).join('');
  const warningHtml = warnings.length
    ? `<div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);border-radius:8px;padding:12px;margin-bottom:12px;color:#FCA5A5;font-size:0.82rem">
        <strong>${escapeHtml(i18n.t('audit.warningsTitle'))}:</strong><br>${warnings.map(w => `• ${escapeHtml(w)}`).join('<br>')}
      </div>`
    : `<div style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.25);border-radius:8px;padding:12px;margin-bottom:12px;color:#A7F3D0;font-size:0.82rem">${escapeHtml(i18n.t('audit.noCriticalAnomalies'))}</div>`;

  const quoteBlockers = localizeMessageList(r.quoteReadiness?.blockers || []).slice(0, 3);
  const approvalBlockers = localizeMessageList(approval.blockers || []);
  const gridStatus = gov.gridChecklistComplete ? i18n.t('audit.complete') : i18n.t('audit.missingDocuments');
  const tariffFreshness = tariffSource.stale ? 'STALE' : i18n.t('audit.current');
  const parity = r.engineParity || null;
  const parityHasRealComparison = parity?.intentionalDifference === true;
  const parityText = parity && parityHasRealComparison
    ? `${i18n.t('engine.authoritativeSource')}: ${parity.authoritativeSource || '—'} | ${i18n.t('engine.productionDelta')}: ${Number(parity.deltaKwh || 0).toLocaleString(localeTag())} kWh (${Number(parity.deltaPct || 0).toFixed(2)}%)`
    : i18n.t('engine.comparisonUnavailable');
  const isOffGrid = state.scenarioKey === 'off-grid';
  const offGridAuditNote = isOffGrid
    ? `<p class="audit-offgrid-note">${escapeHtml(i18n.t('offGrid.preFeasibilityOnly'))} ${escapeHtml(i18n.t('offGrid.notFeasibilityAnalysis'))}</p>`
    : '';
  const energyBalanceLabel = state.netMeteringEnabled
    ? i18n.t('audit.selfConsumptionExport')
    : isOffGrid
      ? i18n.t('audit.selfConsumptionOffGrid')
      : i18n.t('audit.selfConsumptionSurplus');
  const L2 = isOffGrid ? r.offgridL2Results : null;
  const energyBalanceValue = L2
    ? `${i18n.t('offgridL2.pvBessCoverageLabel')}: ${((L2.pvBatteryLoadCoverage ?? L2.totalLoadCoverage) * 100).toFixed(1)}% / ${i18n.t('offgridL2.accuracyScoreLabel')}: ${L2.accuracyScore ?? '—'}/100 / ${i18n.t('offgridL2.generatorLabel')}: ${Math.round(L2.generatorEnergyKwh || L2.generatorKwh || 0).toLocaleString(localeTag())} kWh / ${i18n.t('audit.unservedLoad')}: ${Math.round(L2.unmetLoadKwh || 0).toLocaleString(localeTag())} kWh / ${i18n.t('audit.curtailedPv')}: ${Math.round(L2.curtailedPvKwh || 0).toLocaleString(localeTag())} kWh`
    : state.netMeteringEnabled
    ? `${Math.round(r.nmMetrics?.directSelfConsumedEnergy || r.nmMetrics?.selfConsumedEnergy || 0).toLocaleString(localeTag())} kWh direct / offset ${Math.round(r.nmMetrics?.importOffsetEnergy || 0).toLocaleString(localeTag())} kWh / paid ${Math.round(r.nmMetrics?.paidGridExport || 0).toLocaleString(localeTag())} kWh / total ${Math.round(r.nmMetrics?.annualGridExport || 0).toLocaleString(localeTag())} kWh`
    : isOffGrid
      ? `${Math.round(r.nmMetrics?.selfConsumedEnergy || 0).toLocaleString(localeTag())} kWh / ${i18n.t('audit.unservedLoad')}: ${Math.round(r.bessMetrics?.unmetLoadKwh || 0).toLocaleString(localeTag())} kWh / ${i18n.t('audit.curtailedPv')}: ${Math.round(r.nmMetrics?.annualGridExport || 0).toLocaleString(localeTag())} kWh`
      : `${Math.round(r.nmMetrics?.selfConsumedEnergy || 0).toLocaleString(localeTag())} kWh / ${i18n.t('audit.exportRevenueDisabled')}`;

  const scrollHint = `<div class="ui-scroll-hint">${escapeHtml(i18n.t('common.scrollHint'))}</div>`;

  audit.innerHTML = `
    <details class="advanced-details">
      <summary class="advanced-details-summary">Uzman inceleme kayıtları (isteğe bağlı)</summary>
      <div class="audit-purpose-note">
        <strong>${escapeHtml(i18n.t('audit.purposeTitle'))}</strong>
        <span>${escapeHtml(i18n.t('audit.purposeBody'))}</span>
      </div>
      ${offGridAuditNote}
      ${warningHtml}
      ${scrollHint}
      <table class="tech-table">
        <tbody>
          <tr><td>${escapeHtml(i18n.t('audit.location'))}</td><td>${escapeHtml(state.cityName || '—')} (${Number(state.lat || 0).toFixed(4)}, ${Number(state.lon || 0).toFixed(4)})</td></tr>
          <tr><td>${escapeHtml(i18n.t('audit.tariff'))}</td><td>${escapeHtml(r.tariffModel?.type || state.tariffType)} | ${escapeHtml(r.tariffModel?.effectiveRegime || '—')} | ${moneyRate(r.tariff, 'kWh')} | ${escapeHtml(i18n.t('audit.source'))}: ${escapeHtml(r.tariffModel?.sourceDate || '—')}</td></tr>
          <tr><td>${escapeHtml(i18n.t('audit.regulationEngine'))}</td><td>${escapeHtml(r.tariffModel?.regulation?.effectiveRegimeBasis || '—')} | SKTT activation: ${escapeHtml(r.tariffModel?.regulation?.activationDate || '—')} | eval: ${escapeHtml(r.tariffModel?.regulation?.evaluationDate || '—')}</td></tr>
          <tr><td>${escapeHtml(i18n.t('audit.consumption'))}</td><td>${Math.round(r.hourlySummary?.annualLoad || state.dailyConsumption * 365).toLocaleString(localeTag())} kWh/${escapeHtml(i18n.t('units.year'))}</td></tr>
          <tr><td>${escapeHtml(energyBalanceLabel)}</td><td>${escapeHtml(energyBalanceValue)}</td></tr>
          <tr><td>${escapeHtml(i18n.t('audit.productionConfidenceRange'))}</td><td>${escapeHtml(i18n.t('audit.badYear'))}: ${Math.round(r.annualEnergy * 0.90).toLocaleString(localeTag())} kWh | ${escapeHtml(i18n.t('audit.baseYear'))}: ${r.annualEnergy.toLocaleString(localeTag())} kWh | ${escapeHtml(i18n.t('audit.goodYear'))}: ${Math.round(r.annualEnergy * 1.10).toLocaleString(localeTag())} kWh</td></tr>
          <tr><td>${escapeHtml(i18n.t('governance.confidenceLevel'))}</td><td>${escapeHtml(statusLabel(r.confidenceLevel))} (${escapeHtml(r.calculationMode)})</td></tr>
          <tr><td>${escapeHtml(i18n.t('scenario.label'))}</td><td>${escapeHtml(state.scenarioContext?.label || state.scenarioKey || 'On-Grid')} | ${escapeHtml(state.scenarioContext?.nextAction || '—')}</td></tr>
          <tr><td>${escapeHtml(i18n.t('engine.authoritative'))}</td><td>${escapeHtml(backendEngineText(r, state))} | ${escapeHtml(r.sourceQualityNote || '—')}</td></tr>
          <tr><td>${escapeHtml(i18n.t('engine.parity'))}</td><td>${escapeHtml(parityText)}</td></tr>
          <tr><td>${escapeHtml(i18n.t('engine.fallbackReason'))}</td><td>${escapeHtml(localizeKnownMessage(r.authoritativeEngineFallbackReason || '—'))}</td></tr>
          <tr><td>${escapeHtml(i18n.t('governance.quoteReadiness'))}</td><td>${escapeHtml(statusLabel(r.quoteReadiness?.status || '—'))}${quoteBlockers.length ? ' | ' + escapeHtml(quoteBlockers.join(' · ')) : ''}</td></tr>
          <tr><td>${escapeHtml(i18n.t('audit.regulationEngine'))}</td><td>${escapeHtml(r.quoteReadiness?.version || r.tariffModel?.exportCompensationPolicy?.version || '—')} | ${escapeHtml(r.tariffModel?.exportCompensationPolicy?.assumptionBasis || '—')}</td></tr>
          <tr><td>${escapeHtml(i18n.t('audit.tariffSourceGovernance'))}</td><td>${escapeHtml(tariffSource.sourceLabel || '—')} | ${escapeHtml(i18n.t('audit.sourceAge'))}: ${tariffSource.ageDays ?? '—'} ${escapeHtml(i18n.t('units.year')) === 'year' ? 'days' : 'gün'} | ${escapeHtml(tariffFreshness)}</td></tr>
          <tr><td>${escapeHtml(i18n.t('governance.proposalConfidence'))}</td><td>${confidence.score ?? '—'} / 100 · ${escapeHtml(statusLabel(confidence.level || '—'))}</td></tr>
          <tr><td>${escapeHtml(i18n.t('governance.approvalState'))}</td><td>${escapeHtml(statusLabel(approval.state || 'draft'))}${approval.approvalRecord ? ' | immutable: ' + escapeHtml(approval.approvalRecord.id) : ''}${approvalBlockers.length ? ' | ' + escapeHtml(approvalBlockers.join(' · ')) : ''}</td></tr>
          <tr><td>${escapeHtml(i18n.t('audit.financing'))}</td><td>${escapeHtml(i18n.t('audit.monthlyPayment'))}: ${financing.monthlyPayment ? money(financing.monthlyPayment) : '—'} | DSCR: ${financing.firstYearDebtServiceCoverage ?? '—'}</td></tr>
          <tr><td>${escapeHtml(i18n.t('audit.maintenanceContract'))}</td><td>${money(maintenance.annualBase || 0)}/${escapeHtml(i18n.t('units.year'))} | 10 ${escapeHtml(i18n.t('units.year'))}: ${money(maintenance.tenYearNominal || 0)} | ${escapeHtml(statusLabel(maintenance.contractStatus || '—'))}</td></tr>
          <tr><td>${escapeHtml(i18n.t('audit.gridApplication'))}</td><td>${escapeHtml(gridStatus)}</td></tr>
          <tr><td>${escapeHtml(i18n.t('audit.dataPrivacy'))}</td><td>${escapeHtml(i18n.t('audit.privacyLocalOnly'))}</td></tr>
        </tbody>
      </table>
      <div style="margin-top:14px;font-size:0.9rem;font-weight:700;color:var(--primary)">${escapeHtml(i18n.t('audit.assumptionLedger'))}</div>
      ${scrollHint}
      <table class="tech-table"><thead><tr><th>${escapeHtml(i18n.t('audit.assumption'))}</th><th>${escapeHtml(i18n.t('audit.value'))}</th><th>${escapeHtml(i18n.t('audit.confidence'))}</th><th>${escapeHtml(i18n.t('audit.source'))}</th></tr></thead><tbody>${ledgerRows || '<tr><td colspan="4">—</td></tr>'}</tbody></table>
      <div style="margin-top:14px;font-size:0.9rem;font-weight:700;color:var(--primary)">${escapeHtml(i18n.t('audit.evidenceRecords'))}</div>
      ${scrollHint}
      <table class="tech-table"><thead><tr><th>${escapeHtml(i18n.t('audit.evidence'))}</th><th>${escapeHtml(i18n.t('audit.status'))}</th><th>Ref</th><th>${escapeHtml(i18n.t('audit.checkedDate'))}</th><th>${escapeHtml(i18n.t('audit.validity'))}</th><th>File / SHA-256</th></tr></thead><tbody>${evidenceRows || '<tr><td colspan="6">—</td></tr>'}</tbody></table>
      <div style="margin-top:14px;font-size:0.9rem;font-weight:700;color:var(--primary)">${escapeHtml(i18n.t('audit.revisionDiff'))}</div>
      <table class="tech-table"><thead><tr><th>${escapeHtml(i18n.t('audit.field'))}</th><th>${escapeHtml(i18n.t('audit.before'))}</th><th>${escapeHtml(i18n.t('audit.after'))}</th></tr></thead><tbody>${revisionRows || `<tr><td colspan="3">${escapeHtml(i18n.t('audit.noRevisionDiff'))}</td></tr>`}</tbody></table>
      <div style="margin-top:14px;font-size:0.9rem;font-weight:700;color:var(--primary)">${escapeHtml(i18n.t('audit.auditLog'))}</div>
      <table class="tech-table"><thead><tr><th>${escapeHtml(i18n.t('audit.time'))}</th><th>${escapeHtml(i18n.t('audit.action'))}</th><th>${escapeHtml(i18n.t('audit.user'))}</th></tr></thead><tbody>${auditRows || `<tr><td colspan="3">${escapeHtml(i18n.t('audit.noAuditRecords'))}</td></tr>`}</tbody></table>
    </details>
  `;

  // Türkiye SVG haritasında şehir noktasını güncelle
  updateTurkeyMapDot(state.lat, state.lon, state.cityName);
}

function updateTurkeyMapDot(lat, lon, cityName) {
  // SVG viewBox: 0 0 800 360 — Türkiye coğrafi sınırları: lon 26–45, lat 36–42
  const svgW = 800, svgH = 360;
  const lonMin = 26, lonMax = 45, latMin = 36, latMax = 42;
  if (!lat || !lon) return;

  const x = ((lon - lonMin) / (lonMax - lonMin)) * svgW;
  const y = svgH - ((lat - latMin) / (latMax - latMin)) * svgH;

  const pulse = document.getElementById('city-pulse-dot');
  const inner = document.getElementById('city-dot-inner');
  const label = document.getElementById('city-dot-label');

  if (pulse) { pulse.setAttribute('cx', x.toFixed(0)); pulse.setAttribute('cy', y.toFixed(0)); pulse.setAttribute('opacity', '0.9'); }
  if (inner) { inner.setAttribute('cx', x.toFixed(0)); inner.setAttribute('cy', y.toFixed(0)); inner.setAttribute('opacity', '1'); }
  if (label) {
    label.setAttribute('x', x.toFixed(0));
    label.setAttribute('y', (y - 14).toFixed(0));
    label.setAttribute('opacity', '1');
    label.textContent = cityName || '';
  }
}


export function renderMonthlyChart(data, avgConsumption) {
  const canvas = document.getElementById('monthly-chart-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (monthlyChart) monthlyChart.destroy();

  // NaN/null guard — Chart.js sıfır beklediğinde null/NaN çizim bozar
  const safeData = Array.isArray(data)
    ? data.map(v => (v == null || isNaN(v) || !isFinite(v)) ? 0 : v)
    : Array(12).fill(0);

  const grad = ctx.createLinearGradient(0, 0, 0, 280);
  grad.addColorStop(0, 'rgba(245,158,11,0.88)');
  grad.addColorStop(0.55, 'rgba(245,158,11,0.4)');
  grad.addColorStop(1, 'rgba(245,158,11,0.05)');

  monthlyChart = new Chart(ctx, {
    data: {
      labels: MONTHS,
      datasets: [
        {
          type: 'bar',
          label: i18n.t('charts.monthlyProduction'),
          data: safeData,
          backgroundColor: grad,
          borderColor: 'rgba(245,158,11,0.9)',
          borderWidth: 1,
          borderRadius: 6,
          borderSkipped: false,
          order: 2
        },
        (() => {
          const billMonths = window.state?.monthlyConsumption;
          const hasBill = Array.isArray(billMonths) && billMonths.length === 12 && billMonths.some(v => v > 0);
          const consumptionData = hasBill
            ? billMonths.map(v => (v == null || isNaN(v) ? 0 : v))
            : new Array(12).fill(avgConsumption || 250);
          const consumptionLabel = hasBill
            ? 'Fatura Tüketimi (kWh)'
            : `Ortalama Tüketim (~${Math.round(avgConsumption || 250).toLocaleString('tr-TR')} kWh/ay)`;
          return {
            type: 'line',
            label: consumptionLabel,
            data: consumptionData,
            borderColor: '#06B6D4',
            borderDash: hasBill ? [] : [5, 5],
            borderWidth: hasBill ? 2.5 : 2,
            pointRadius: hasBill ? 4 : 0,
            pointBackgroundColor: '#06B6D4',
            fill: false,
            order: 1
          };
        })()
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { labels: { color: '#94A3B8', font: { family: 'Space Grotesk, Inter', size: 11 } } },
        tooltip: {
          backgroundColor: 'rgba(15,23,42,0.95)',
          borderColor: 'rgba(71,85,105,0.5)',
          borderWidth: 1,
          titleColor: '#F1F5F9',
          bodyColor: '#94A3B8',
          padding: 12,
          cornerRadius: 10,
          callbacks: {
            label: c => ' ' + (c.raw || 0).toLocaleString('tr-TR') + ' kWh'
          }
        }
      },
      scales: {
        x: {
          ticks: { color: '#94A3B8', font: { family: 'Space Grotesk, Inter' } },
          grid: { color: 'rgba(71,85,105,0.18)', drawBorder: false }
        },
        y: {
          ticks: { color: '#94A3B8', font: { family: 'Space Grotesk, Inter' } },
          grid: { color: 'rgba(71,85,105,0.18)', drawBorder: false }
        }
      }
    }
  });
}

// ── Faz C: EV Sonuçları ─────────────────────────────────────────────────────
function renderEVResults(ev) {
  const card = document.getElementById('ev-result-card');
  if (!card) return;
  if (!ev) { card.style.display = 'none'; return; }
  card.style.display = 'block';
  card.innerHTML = `
    <div class="result-card-header">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/><circle cx="7" cy="14" r="1"/><circle cx="17" cy="14" r="1"/></svg>
      <span>EV Şarj Analizi</span>
    </div>
    <div class="result-metrics-grid">
      <div class="result-metric"><div class="result-metric-val">${ev.annual_kWh.toLocaleString('tr-TR')}</div><div class="result-metric-label">kWh/yıl EV ihtiyacı</div></div>
      <div class="result-metric"><div class="result-metric-val">${ev.solarChargeRatio}%</div><div class="result-metric-label">Güneşle şarj oranı</div></div>
      <div class="result-metric"><div class="result-metric-val">${money(ev.fuelCostSaved)}</div><div class="result-metric-label">Yıllık yakıt tasarrufu</div></div>
      <div class="result-metric"><div class="result-metric-val">${money(ev.netSaving)}</div><div class="result-metric-label">Net yıllık tasarruf</div></div>
    </div>
    <p style="font-size:0.78rem;color:var(--text-muted);margin-top:8px">Ek panel ihtiyacı: ${ev.additionalPanels} adet | Güneşten şarj: ${ev.solarChargeKwh.toLocaleString('tr-TR')} kWh/yıl</p>
  `;
}

// ── Faz C: Isı Pompası Sonuçları ────────────────────────────────────────────
function renderHeatPumpResults(hp) {
  const card = document.getElementById('heatpump-result-card');
  if (!card) return;
  if (!hp) { card.style.display = 'none'; return; }
  card.style.display = 'block';
  card.innerHTML = `
    <div class="result-card-header">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#06B6D4" stroke-width="2"><path d="M12 2v6M12 22v-6M4.93 4.93l4.24 4.24M14.83 14.83l4.24 4.24M2 12h6M22 12h-6M4.93 19.07l4.24-4.24M14.83 9.17l4.24-4.24"/></svg>
      <span>Isı Pompası Analizi</span>
    </div>
    <div class="result-metrics-grid">
      <div class="result-metric"><div class="result-metric-val">${hp.annual_heat_demand.toLocaleString('tr-TR')}</div><div class="result-metric-label">kWh/yıl ısıtma talebi</div></div>
      <div class="result-metric"><div class="result-metric-val">COP ${hp.cop}</div><div class="result-metric-label">Verimlilik katsayısı</div></div>
      <div class="result-metric"><div class="result-metric-val">${money(hp.gas_cost)}</div><div class="result-metric-label">Mevcut doğalgaz maliyeti</div></div>
      <div class="result-metric"><div class="result-metric-val">${money(hp.savings)}</div><div class="result-metric-label">Yıllık tasarruf</div></div>
    </div>
    <p style="font-size:0.78rem;color:var(--text-muted);margin-top:8px">Isı pompası elektrik tüketimi: ${hp.hp_electricity.toLocaleString('tr-TR')} kWh/yıl</p>
  `;
}

// ── Faz C: Yapısal Kontrol Sonuçları ────────────────────────────────────────
function renderStructuralResults(sc) {
  const card = document.getElementById('structural-result-card');
  if (!card) return;
  if (!sc) { card.style.display = 'none'; return; }
  card.style.display = 'block';

  const snowStatus = sc.snowLoad <= 0.5 ? 'ok' : sc.snowLoad <= 1.0 ? 'warn' : 'danger';
  const windStatus = sc.windPressure <= 0.5 ? 'ok' : sc.windPressure <= 1.0 ? 'warn' : 'danger';
  const statusColors = { ok: '#10B981', warn: '#F59E0B', danger: '#EF4444' };
  const statusLabels = { ok: 'OK', warn: 'Dikkat', danger: 'Kritik' };

  card.innerHTML = `
    <div class="result-card-header">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
      <span>Yapısal Kontrol</span>
    </div>
    <div class="structural-checks">
      <div class="structural-check-row">
        <span>Kar Yükü (${sc.snowZone})</span>
        <span>${sc.snowLoad.toFixed(2)} kN/m²</span>
        <span class="status-badge" style="background:${statusColors[snowStatus]}22;color:${statusColors[snowStatus]};border:1px solid ${statusColors[snowStatus]}44;padding:2px 8px;border-radius:20px;font-size:0.75rem">${statusLabels[snowStatus]}</span>
      </div>
      <div class="structural-check-row">
        <span>Rüzgar Basıncı (${sc.windZone})</span>
        <span>${sc.windPressure.toFixed(2)} kN/m²</span>
        <span class="status-badge" style="background:${statusColors[windStatus]}22;color:${statusColors[windStatus]};border:1px solid ${statusColors[windStatus]}44;padding:2px 8px;border-radius:20px;font-size:0.75rem">${statusLabels[windStatus]}</span>
      </div>
    </div>
    <p style="font-size:0.78rem;color:var(--text-muted);margin-top:8px">${sc.recommendation}</p>
  `;
}

// ── Faz D: Vergi Sonuçları ────────────────────────────────────────────────
function renderTaxResults(tax) {
  const card = document.getElementById('tax-result-card');
  if (!card) return;
  if (!tax) { card.style.display = 'none'; return; }
  card.style.display = 'block';
  card.innerHTML = `
    <div class="result-card-header">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
      <span>Vergi Avantajı Özeti</span>
    </div>
    <div class="result-metrics-grid">
      <div class="result-metric"><div class="result-metric-val">${money(tax.taxShieldNPV)}</div><div class="result-metric-label">Amortisman vergi kalkanı (NPV)</div></div>
      <div class="result-metric"><div class="result-metric-val">${money(tax.kdv_recovery)}</div><div class="result-metric-label">KDV iadesi</div></div>
      <div class="result-metric"><div class="result-metric-val">${money(tax.totalTaxBenefit)}</div><div class="result-metric-label">Toplam vergi avantajı</div></div>
      <div class="result-metric"><div class="result-metric-val">${money(tax.effectiveCost)}</div><div class="result-metric-label">Efektif yatırım maliyeti</div></div>
    </div>
  `;
}

// ── Faz B: Fatura Analizi Sonuçları (placeholder) ────────────────────────
function renderBillAnalysisResults(ba) {
  const chartWrap = document.querySelector('.chart-wrap');
  if (!chartWrap || !ba) return;
  let card = document.getElementById('bill-result-card');
  if (!card) {
    card = document.createElement('div');
    card.id = 'bill-result-card';
    card.className = 'card';
    card.style.marginTop = '16px';
    chartWrap.insertAdjacentElement('afterend', card);
  }
  const best = ba.rows.reduce((acc, row) => Number(row.coveragePct) > Number(acc.coveragePct) ? row : acc, ba.rows[0]);
  const worst = ba.rows.reduce((acc, row) => Number(row.coveragePct) < Number(acc.coveragePct) ? row : acc, ba.rows[0]);
  card.innerHTML = `
    <div class="card-title">Fatura Analizi</div>
    <div class="result-metrics-grid">
      <div class="result-metric"><div class="result-metric-val">${ba.annualConsumption.toLocaleString('tr-TR')}</div><div class="result-metric-label">kWh/yıl tüketim</div></div>
      <div class="result-metric"><div class="result-metric-val">${ba.avgCoveragePct.toFixed(1)}%</div><div class="result-metric-label">Ortalama aylık karşılama</div></div>
      <div class="result-metric"><div class="result-metric-val">${money(ba.annualSaving)}</div><div class="result-metric-label">Yıllık eşleşme tasarrufu</div></div>
      <div class="result-metric"><div class="result-metric-val">${MONTHS[best.month]} / ${MONTHS[worst.month]}</div><div class="result-metric-label">En iyi / en zayıf ay</div></div>
    </div>
  `;
}

// ── PDF ─────────────────────────────────────────────────────────────────────
function normalizeTR(str) {
  if (!str) return '';
  return String(str)
    .replace(/ş/g,'s').replace(/Ş/g,'S')
    .replace(/ı/g,'i').replace(/İ/g,'I')
    .replace(/ğ/g,'g').replace(/Ğ/g,'G')
    .replace(/ç/g,'c').replace(/Ç/g,'C')
    .replace(/ö/g,'o').replace(/Ö/g,'O')
    .replace(/ü/g,'u').replace(/Ü/g,'U');
}

function pdfSafeText(value) {
  const text = String(value ?? '');
  // jsPDF's built-in Helvetica path is not reliably Unicode-complete for
  // Turkish glyphs. Preserve normal Latin text, and transliterate only glyphs
  // known to render poorly until a bundled Unicode font is added.
  return /[şŞıİğĞçÇöÖüÜ]/.test(text) ? normalizeTR(text) : text;
}

export function downloadPDF() {
  const state = window.state;
  if (!state.results) return;
  const { jsPDF } = window.jspdf || {};
  if (!jsPDF) {
    window.showToast?.(i18n.t('report.pdfLibraryMissing'), 'error');
    return;
  }
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const r = state.results;
  const p = PANEL_TYPES[state.panelType];
  const dateLocale = localeTag();
  const yearUnit = i18n.t('units.year');

  // Kapak Sayfası
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 297, 'F');
  doc.setTextColor(245, 158, 11);
  doc.setFontSize(22); doc.setFont('helvetica', 'bold');
  doc.text(pdfSafeText('Solar Rota'), 20, 25);
  doc.setFontSize(12); doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text(pdfSafeText(i18n.t('report.proposalTitle')), 20, 33);
  doc.setFontSize(10);
  doc.text(`${pdfSafeText(state.cityName || '—')} — ${new Date().toLocaleDateString(dateLocale)}`, 20, 41);
  doc.setFontSize(8); doc.setTextColor(245, 158, 11);
  doc.text(pdfSafeText(`${i18n.t('report.methodology')}: ${r.methodologyVersion || '—'} | ${i18n.t('report.calculationMode')}: ${r.calculationMode || '—'} | ${i18n.t('report.sourceDate')}: ${r.tariffModel?.sourceDate || '—'}`), 20, 48);
  doc.setTextColor(148, 163, 184);
  doc.text(pdfSafeText(i18n.t('report.preFeasibilityDisclaimer')), 20, 53);
  doc.text(pdfSafeText(i18n.t('report.pdfFontNote')), 20, 57);

  // Ayırıcı çizgi
  doc.setDrawColor(245, 158, 11); doc.setLineWidth(0.5);
  doc.line(20, 62, 190, 62);

  // KPI özet
  doc.setTextColor(241, 245, 249); doc.setFontSize(11); doc.setFont('helvetica', 'bold');
  const kpis = [
    [pdfSafeText(i18n.t('report.annualProduction')), r.annualEnergy.toLocaleString(dateLocale) + ' kWh'],
    [pdfSafeText(i18n.t('report.annualSavings')), money(r.annualSavings)],
    [pdfSafeText(i18n.t('onGridResult.firstYearNetCashFlow')), money(r.firstYearNetCashFlow ?? 0)],
    [pdfSafeText(i18n.t('report.systemPower')), r.systemPower.toFixed(2) + ' kWp'],
    [pdfSafeText(i18n.t('report.totalCost')), money(r.totalCost)],
    [pdfSafeText(i18n.t('finance.grossSimplePayback')), (r.grossSimplePaybackYear ? Number(r.grossSimplePaybackYear).toFixed(1) : '>25') + ` ${yearUnit}`],
    [pdfSafeText(i18n.t('report.discountedPayback')), (r.discountedPaybackYear || '>25') + ` ${yearUnit}`],
    [pdfSafeText(`NPV (25 ${yearUnit})`), money(r.npvTotal)],
    ['IRR', r.irr + '%'],
    [pdfSafeText(i18n.t(r.compensatedLcoe ? 'onGridResult.compensatedLcoeLabel' : 'onGridResult.lcoeLabel')), moneyRate(r.compensatedLcoe || r.lcoe, 'kWh')],
    ['ROI', r.roi + '%'],
    [pdfSafeText(i18n.t('report.co2Savings')), r.co2Savings + ` ${i18n.t('units.tonsCo2PerYear')}`],
  ];
  if (state.scenarioKey === 'off-grid' && r.offgridL2Results) {
    const L = r.offgridL2Results;
    kpis.push(
      [pdfSafeText(i18n.t('offgridL2.pvBessCoverageLabel')), `${((L.pvBatteryLoadCoverage ?? L.totalLoadCoverage) * 100).toFixed(1)}%`],
      [pdfSafeText(i18n.t('offgridL2.totalCoverageWithGeneratorLabel')), `${(L.totalLoadCoverage * 100).toFixed(1)}%`],
      [pdfSafeText(i18n.t('offgridL2.accuracyScoreLabel')), `${L.accuracyScore ?? '—'} / 100${L.expectedUncertaintyPct ? ` (${Number(L.expectedUncertaintyPct.lowPct || 0).toFixed(0)}-${Number(L.expectedUncertaintyPct.highPct || 0).toFixed(0)}%)` : ''}`],
      [pdfSafeText(i18n.t('offgridL2.resultAutonomousDays')), `${L.autonomousDays ?? '—'} ${yearUnit}`],
      ...(L.generatorEnabled ? [[pdfSafeText(i18n.t('offgridL2.resultAutonomousDaysWithGenerator')), `${L.autonomousDaysWithGenerator ?? '—'} ${yearUnit}`]] : []),
      [pdfSafeText(i18n.t('offgridL2.generatorLabel')), `${Math.round(L.generatorEnergyKwh || L.generatorKwh || 0).toLocaleString(dateLocale)} kWh`],
      [pdfSafeText(i18n.t('offgridL2.unmetLabel')), `${Math.round(L.unmetLoadKwh || 0).toLocaleString(dateLocale)} kWh`]
    );
  } else {
    kpis.push([pdfSafeText(i18n.t('onGridResult.settlementBasisLabel')), pdfSafeText(r.settlementProvisional ? i18n.t('onGridResult.settlementProvisional') : (r.tariffModel?.exportCompensationPolicy?.assumptionBasis || '—'))]);
  }

  let y = 72;
  doc.setFontSize(9);
  kpis.forEach(([lbl, val]) => {
    doc.setTextColor(148, 163, 184); doc.setFont('helvetica', 'normal');
    doc.text(lbl, 25, y);
    doc.setTextColor(241, 245, 249); doc.setFont('helvetica', 'bold');
    doc.text(val, 100, y);
    y += 8;
  });

  // Sayfa 2 — Sistem Tasarımı
  doc.addPage();
  doc.setFillColor(15, 23, 42); doc.rect(0, 0, 210, 297, 'F');
  doc.setTextColor(245, 158, 11); doc.setFontSize(14); doc.setFont('helvetica', 'bold');
  doc.text(pdfSafeText(i18n.t('report.systemDesign')), 20, 20);
  doc.setTextColor(241, 245, 249); doc.setFontSize(9); doc.setFont('helvetica', 'normal');

  const techRows = [
    [i18n.t('report.panelType'), p.name], [i18n.t('report.panelCount'), r.panelCount + ` ${i18n.t('report.panelCountUnit')}`],
    [i18n.t('report.systemPower'), r.systemPower.toFixed(2) + ' kWp'],
    [i18n.t('report.roofTilt'), state.tilt + '°'],
    [i18n.t('report.roofAzimuth'), state.azimuthName],
    ['PR', r.pr + '%'], ['PSH', r.psh + ` ${i18n.t('report.hoursPerDay')}`],
    [i18n.t('report.specificYield'), r.ysp + ' kWh/kWp'],
  ];
  y = 35;
  techRows.forEach(([k, v]) => {
    doc.setTextColor(148, 163, 184); doc.text(pdfSafeText(k), 25, y);
    doc.setTextColor(241, 245, 249); doc.text(pdfSafeText(v), 100, y);
    y += 7;
  });

  // Maliyet kırılımı
  y += 5;
  doc.setTextColor(245, 158, 11); doc.setFontSize(11); doc.setFont('helvetica', 'bold');
  doc.text(pdfSafeText(i18n.t('report.costBreakdown')), 20, y); y += 8;
  doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  const cb = r.costBreakdown;
  const costDenominator = cb.totalWithBatteryAndGenerator || cb.totalWithBattery || cb.total || 1;
  const costRows = [
    ['Panel', cb.panel], ['Inverter', cb.inverter],
    [i18n.t('report.mounting'), cb.mounting], ['DC Cable', cb.dcCable],
    ['AC Electrical', cb.acElec], [i18n.t('report.labor'), cb.labor],
    ['TEDAŞ + Permit', cb.permits], [`VAT/KDV (%${Math.round((cb.kdvRate ?? 0.20) * 100)})`, cb.kdv],
    ...(cb.battery ? [[i18n.t('offgridL2.batteryLabel'), cb.battery]] : []),
    ...(cb.generatorCapex ? [[i18n.t('offgridL2.generatorCapex'), cb.generatorCapex]] : []),
    [i18n.t('report.grandTotal'), costDenominator]
  ];
  costRows.forEach(([lbl, val]) => {
    doc.setTextColor(148, 163, 184);
    doc.text(pdfSafeText(lbl), 25, y);
    const w = 40;
    const barW = Math.min((val / costDenominator) * w, w);
    doc.setFillColor(245, 158, 11); doc.rect(75, y - 3, barW * 1.2, 4, 'F');
    doc.setTextColor(241, 245, 249);
    doc.text(money(Math.round(val)), 165, y);
    y += 7;
  });

  // Sayfa 3 — 25 Yıl Tablo
  doc.addPage();
  doc.setFillColor(15, 23, 42); doc.rect(0, 0, 210, 297, 'F');
  doc.setTextColor(245, 158, 11); doc.setFontSize(11); doc.setFont('helvetica', 'bold');
  doc.text(pdfSafeText(i18n.t('report.yearProjection')), 20, 15);

  doc.setFontSize(7); doc.setFont('helvetica', 'bold');
  doc.setTextColor(148, 163, 184);
  const headers7 = [i18n.t('report.year'), i18n.t('report.production'), i18n.t('report.tariff'), i18n.t('report.savings'), i18n.t('report.expenses'), 'Net', i18n.t('report.cumulative')];
  const xCols = [15, 30, 55, 75, 100, 125, 150, 178];
  headers7.forEach((h, i) => doc.text(pdfSafeText(h), xCols[i], 25));
  doc.setLineWidth(0.2); doc.setDrawColor(71, 85, 105);
  doc.line(15, 27, 195, 27);

  let row = 32;
  doc.setFont('helvetica', 'normal');
  r.yearlyTable.slice(0, 25).forEach(yr => {
    if (row > 275) { doc.addPage(); doc.setFillColor(15,23,42); doc.rect(0,0,210,297,'F'); row = 15; }
    if (yr.year === Math.round(Number(r.grossSimplePaybackYear || r.paybackYear))) { doc.setFillColor(16,185,129,50); doc.rect(13, row-4, 182, 6, 'F'); }
    doc.setTextColor(241, 245, 249);
    const vals = [yr.year+'', yr.energy.toLocaleString(dateLocale), moneyRate(yr.effectiveImportRate || yr.rate, 'kWh'),
      money(yr.savings), money(yr.expenses),
      money(yr.netCashFlow), money(yr.cumulative)];
    vals.forEach((v, i) => doc.text(v, xCols[i], row));
    row += 6;
  });

  doc.save(`solar-rota-${pdfSafeText(state.cityName || 'rapor')}-${new Date().getFullYear()}.pdf`);
  window.showToast(i18n.t('report.pdfDownloaded'), 'success');
}

export function downloadTechnicalPDF() {
  const state = window.state;
  if (!state.results) return;
  const { jsPDF } = window.jspdf || {};
  if (!jsPDF) {
    window.showToast?.(i18n.t('report.pdfLibraryMissing'), 'error');
    return;
  }

  if (window.renderEngReport) window.renderEngReport();
  const body = document.getElementById('eng-report-body');
  const reportText = body?.innerText?.trim();
  if (!reportText) {
    window.showToast?.(i18n.t('report.technicalContentMissing'), 'error');
    return;
  }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const r = state.results;
  let y = 18;
  const marginX = 16;
  const lineHeight = 5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(pdfSafeText(i18n.t('report.technicalTitle')), marginX, y);
  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(pdfSafeText(`${i18n.t('report.methodology')}: ${r.methodologyVersion || '—'} | ${i18n.t('report.calculationMode')}: ${r.calculationMode || '—'} | Engine=${r.authoritativeEngineSource?.source || r.engineSource?.source || '—'}`), marginX, y);
  y += 8;
  doc.text(pdfSafeText(i18n.t('report.pdfFontNote')), marginX, y);
  y += 6;

  const lines = reportText
    .split('\n')
    .map(line => pdfSafeText(line.trim()))
    .filter(Boolean)
    .flatMap(line => doc.splitTextToSize ? doc.splitTextToSize(line, 178) : [line]);

  doc.setFontSize(7);
  lines.forEach(line => {
    if (y > 285) {
      doc.addPage();
      y = 16;
    }
    doc.text(line, marginX, y);
    y += lineHeight;
  });

  doc.save(`solar-rota-teknik-${pdfSafeText(state.cityName || 'rapor')}-${new Date().getFullYear()}.pdf`);
  window.showToast(i18n.t('report.technicalPdfDownloaded'), 'success');
}

export function shareResults() {
  const state = window.state;
  const params = { v: 3, state: createShareStateSnapshot(state) };
  const encoded = btoa(encodeURIComponent(JSON.stringify(params)));
  const url = window.location.origin + window.location.pathname + '#' + encoded;
  navigator.clipboard.writeText(url).then(() => {
    window.showToast(i18n.t('export.shareCopied'), 'success');
  }).catch(() => {
    prompt(i18n.t('export.copyLinkPrompt'), url);
  });
}

export function loadFromHash() {
  const state = window.state;
  try {
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    if (hash.length > 200000) throw new Error('Shared state is too large');
    const params = JSON.parse(decodeURIComponent(atob(hash)));
    if (params.v >= 2 && params.state) {
      const safeState = sanitizeSharedState(params.state);
      Object.assign(state, safeState, { results: null, step: 1 });
      const multiRoofToggle = document.getElementById('multi-roof-toggle');
      if (multiRoofToggle) multiRoofToggle.checked = !!safeState.multiRoof;
      const roofSectionsExtra = document.getElementById('roof-sections-extra');
      if (roofSectionsExtra) roofSectionsExtra.style.display = safeState.multiRoof ? 'block' : 'none';
      window.renderRoofSections?.();
      window.syncMultiRoofUi?.();
      if (safeState.cityName) document.getElementById('city-search').value = safeState.cityName;
      if (safeState.roofArea) document.getElementById('roof-area').value = safeState.roofArea;
      if (safeState.tilt !== undefined) { document.getElementById('tilt-slider').value = safeState.tilt; window.updateTilt(safeState.tilt); }
      if (safeState.shadingFactor !== undefined) { document.getElementById('shading-slider').value = safeState.shadingFactor; window.updateShading(safeState.shadingFactor); }
      if (safeState.soilingFactor !== undefined) { document.getElementById('soiling-slider').value = safeState.soilingFactor; window.updateSoiling(safeState.soilingFactor); }
      if (safeState.tariff !== undefined) document.getElementById('tariff-input').value = safeState.tariff;
      if (safeState.exportTariff !== undefined && document.getElementById('export-tariff-input')) document.getElementById('export-tariff-input').value = safeState.exportTariff;
      if (safeState.tariffRegime !== undefined && document.getElementById('tariff-regime')) document.getElementById('tariff-regime').value = safeState.tariffRegime;
      if (safeState.exportSettlementMode !== undefined && document.getElementById('export-settlement-mode')) document.getElementById('export-settlement-mode').value = safeState.exportSettlementMode;
      if (safeState.skttTariff !== undefined && document.getElementById('sktt-tariff-input')) document.getElementById('sktt-tariff-input').value = safeState.skttTariff;
      if (safeState.contractedTariff !== undefined && document.getElementById('contracted-tariff-input')) document.getElementById('contracted-tariff-input').value = safeState.contractedTariff;
      if (safeState.contractedPowerKw !== undefined && document.getElementById('contracted-power-input')) document.getElementById('contracted-power-input').value = safeState.contractedPowerKw;
      if (safeState.previousYearConsumptionKwh !== undefined && document.getElementById('previous-year-consumption-input')) document.getElementById('previous-year-consumption-input').value = safeState.previousYearConsumptionKwh;
      if (safeState.currentYearConsumptionKwh !== undefined && document.getElementById('current-year-consumption-input')) document.getElementById('current-year-consumption-input').value = safeState.currentYearConsumptionKwh;
      if (safeState.sellableExportCapKwh !== undefined && document.getElementById('sellable-export-cap-input')) document.getElementById('sellable-export-cap-input').value = safeState.sellableExportCapKwh;
      if (safeState.usdToTry !== undefined && document.getElementById('usd-try-input')) document.getElementById('usd-try-input').value = safeState.usdToTry;
      if (safeState.displayCurrency && document.getElementById('display-currency')) document.getElementById('display-currency').value = safeState.displayCurrency;
      if (safeState.annualPriceIncrease !== undefined && document.getElementById('price-increase-input')) document.getElementById('price-increase-input').value = (safeState.annualPriceIncrease * 100).toFixed(0);
      if (safeState.discountRate !== undefined && document.getElementById('discount-rate-input')) document.getElementById('discount-rate-input').value = (safeState.discountRate * 100).toFixed(0);
      if (safeState.expenseEscalationRate !== undefined && document.getElementById('expense-escalation-input')) document.getElementById('expense-escalation-input').value = (safeState.expenseEscalationRate * 100).toFixed(0);
      if (document.getElementById('quote-bill-verified')) document.getElementById('quote-bill-verified').checked = !!safeState.hasSignedCustomerBillData;
      if (document.getElementById('quote-inputs-verified')) document.getElementById('quote-inputs-verified').checked = !!safeState.quoteInputsVerified;
      if (document.getElementById('quote-ready-approved')) document.getElementById('quote-ready-approved').checked = !!safeState.quoteReadyApproved;
      if (safeState.tariffType && document.getElementById('tariff-type')) document.getElementById('tariff-type').value = safeState.tariffType;
      if (window.map && state.lat && state.lon) window.map.setView([state.lat, state.lon], 9);
      if (window.marker && state.lat && state.lon) window.marker.setLatLng([state.lat, state.lon]);
      if (state.cityName) {
        document.getElementById('selected-loc-text').textContent =
          `${state.cityName} — ${parseFloat(state.lat).toFixed(4)}°K, ${parseFloat(state.lon).toFixed(4)}°D (GHI: ${state.ghi})`;
      }
      window.buildPanelCards();
      window.buildInverterCards();
      window.showToast(i18n.t('export.sharedLoaded'), 'info');
      return;
    }
    if (params.lat) {
      const legacy = sanitizeSharedState({ lat: params.lat, lon: params.lon, cityName: params.city, ghi: params.ghi });
      state.lat = legacy.lat; state.lon = legacy.lon;
      state.cityName = legacy.cityName; state.ghi = legacy.ghi;
      if (legacy.cityName) document.getElementById('city-search').value = legacy.cityName;
      document.getElementById('selected-loc-text').textContent =
        `${legacy.cityName} — ${parseFloat(legacy.lat).toFixed(4)}°K`;
      if (window.map) window.map.setView([legacy.lat, legacy.lon], 9);
      if (window.marker) window.marker.setLatLng([legacy.lat, legacy.lon]);
    }
    const legacy = sanitizeSharedState({ roofArea: params.area, tilt: params.tilt, shadingFactor: params.sh, panelType: params.pt });
    if (legacy.roofArea) { state.roofArea = legacy.roofArea; document.getElementById('roof-area').value = legacy.roofArea; }
    if (legacy.tilt !== undefined) { state.tilt = legacy.tilt; document.getElementById('tilt-slider').value = legacy.tilt; window.updateTilt(legacy.tilt); }
    if (params.az !== undefined) {
      const dir = COMPASS_DIRS.find(d => d.azimuth === params.az);
      if (dir) window.selectDirection(dir);
    }
    if (legacy.shadingFactor !== undefined) { state.shadingFactor = legacy.shadingFactor; document.getElementById('shading-slider').value = legacy.shadingFactor; window.updateShading(legacy.shadingFactor); }
    if (legacy.panelType) { state.panelType = legacy.panelType; window.buildPanelCards(); }
    window.showToast(i18n.t('export.sharedLegacyLoaded'), 'info');
  } catch (e) {
    window.showToast?.(i18n.t('export.sharedInvalid'), 'error');
  }
}

export function exportProposalHandoff() {
  const state = window.state;
  if (!state?.results) {
    window.showToast?.(i18n.t('export.calculateFirst'), 'error');
    return;
  }
  const payload = buildStructuredProposalExport(state, state.results);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `solar-rota-proposal-handoff-${(state.cityName || 'site').toString().replace(/[^a-z0-9_-]+/gi, '-')}.json`;
  a.click();
  URL.revokeObjectURL(url);
  window.showToast?.(i18n.t('export.proposalDownloaded'), 'success');
}

export function exportCrmLead() {
  const state = window.state;
  if (!state?.results) {
    window.showToast?.(i18n.t('export.calculateFirst'), 'error');
    return;
  }
  const payload = buildCrmLeadExport(state, state.results);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `solar-rota-crm-lead-${(state.cityName || 'site').toString().replace(/[^a-z0-9_-]+/gi, '-')}.json`;
  a.click();
  URL.revokeObjectURL(url);
  window.showToast?.(i18n.t('export.crmDownloaded'), 'success');
}

// window'a expose et
window.renderResults = renderResults;
window.renderMonthlyChart = renderMonthlyChart;
window.downloadPDF = downloadPDF;
window.downloadTechnicalPDF = downloadTechnicalPDF;
window.shareResults = shareResults;
window.exportProposalHandoff = exportProposalHandoff;
window.exportCrmLead = exportCrmLead;
window.loadFromHash = loadFromHash;
