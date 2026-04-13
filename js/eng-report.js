// ═══════════════════════════════════════════════════════════
// ENG REPORT — Mühendis Hesap Raporu
// GüneşHesap v2.0
// ═══════════════════════════════════════════════════════════
import { PANEL_TYPES } from './data.js';
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
  const fmt  = v => Math.round(v).toLocaleString('tr-TR');
  const money = v => {
    const currency = state.displayCurrency || 'TRY';
    const usdToTry = Math.max(0.0001, Number(state.usdToTry) || 38.5);
    const converted = currency === 'USD' ? (Number(v) || 0) / usdToTry : (Number(v) || 0);
    return converted.toLocaleString(currency === 'USD' ? 'en-US' : 'tr-TR', { maximumFractionDigits: 0 }) + ' ' + currency;
  };
  const moneyRate = (v, unit = 'kWh') => {
    const currency = state.displayCurrency || 'TRY';
    const usdToTry = Math.max(0.0001, Number(state.usdToTry) || 38.5);
    const converted = currency === 'USD' ? (Number(v) || 0) / usdToTry : (Number(v) || 0);
    return converted.toLocaleString(currency === 'USD' ? 'en-US' : 'tr-TR', { maximumFractionDigits: currency === 'USD' ? 3 : 2 }) + ` ${currency}/${unit}`;
  };

  const panelArea   = p.width * p.height;
  const usableArea  = state.roofArea * 0.75;
  const pvgisAzimut = state.azimuth - 180;
  const netEnergy   = r.annualEnergy;
  const maxRef      = r.pvgisRawEnergy || netEnergy;
  const shadingPct  = (r.shadingLoss / maxRef * 100).toFixed(1);
  const tempPct     = (r.tempLossEnergy / maxRef * 100).toFixed(1);
  const azimuthPct  = (r.azimuthLossEnergy / maxRef * 100).toFixed(1);
  const bifacialPct = (r.bifacialGainEnergy / maxRef * 100).toFixed(1);
  const soilingPct  = (r.soilingLoss / maxRef * 100).toFixed(1);
  const cablePct    = r.cableLossPct ? r.cableLossPct.toFixed(1) : '0.0';
  const cb          = r.costBreakdown;
  const totalEnergy25y = r.yearlyTable.reduce((s, y) => s + y.energy, 0);
  const gov = r.proposalGovernance || {};

  let html = `
  <div class="eng-section-header">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/></svg>
    1. Panel &amp; Sistem Tasarımı
  </div>
  <div class="formula-card">
    <div class="formula-title">Panel Boyutları ve Çatı Yerleşimi</div>
    <div class="formula-body">Panel alanı = Genişlik × Yükseklik
= ${p.width} m × ${p.height} m = ${panelArea.toFixed(4)} m²

Kullanılabilir çatı alanı = Toplam alan × 0.75
= ${state.roofArea} m² × 0.75 = ${usableArea.toFixed(1)} m²

Panel sayısı = floor(Kullanılabilir alan ÷ Panel alanı)
= floor(${usableArea.toFixed(1)} ÷ ${panelArea.toFixed(4)}) = ${r.panelCount} adet</div>
    <div class="formula-result">✓ ${r.panelCount} adet ${p.name} panel</div>
    <div class="formula-note">%75 katsayısı GüneşHesap ön fizibilite varsayımıdır. IEC 62548 uyumlu kesin yerleşim için saha keşfi, yangın kaçış yolları, bakım koridorları ve üretici montaj talimatları ayrıca doğrulanmalıdır.</div>
  </div>
  <div class="formula-card">
    <div class="formula-title">Kurulu Güç (DC — STC)</div>
    <div class="formula-body">P_dc = Panel sayısı × P_peak
= ${r.panelCount} × ${p.wattPeak} Wp = ${(r.panelCount * p.wattPeak).toLocaleString('tr-TR')} Wp = ${r.systemPower.toFixed(2)} kWp</div>
    <div class="formula-result">✓ Sistem gücü: ${r.systemPower.toFixed(2)} kWp</div>
    <div class="formula-note">STC: 1000 W/m² ışınım, 25°C hücre sıcaklığı, AM 1.5G spektrumu. Panel standartı: ${p.standard}</div>
  </div>

  <!-- 2. İnverter Bilgisi -->
  <div class="eng-section-header">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12" y2="18"/></svg>
    2. İnverter Seçimi
  </div>
  <div class="formula-card">
    <div class="formula-title">İnverter: ${r.inverterType ? r.inverterType.charAt(0).toUpperCase() + r.inverterType.slice(1) : 'String'} İnverter — Verimlilik %${r.inverterEfficiency || '97'}</div>
    <div class="formula-body">İnverter AC çıkış verimi = %${r.inverterEfficiency || '97'}
E_AC = E_DC × η_inv = ${fmt(r.annualEnergy / (r.inverterEfficiency/100 || 0.97) * (r.inverterEfficiency/100 || 0.97))} kWh × ${r.inverterEfficiency || '97'}% = ${fmt(r.annualEnergy)} kWh/yıl${r.cableLossPct > 0 ? `\n\nKablo kaybı: %${cablePct}
E_net = E_AC × (1 − %${cablePct}) = ${fmt(r.annualEnergy)} kWh/yıl` : ''}</div>
    <div class="formula-note">İnverter verimliliği katalog varsayımıdır. CEC/IEC 61683 eğrileri ve string çalışma noktaları bu ön fizibilite hesabında ayrı doğrulanmamıştır.</div>
  </div>

  <!-- 3. PVGIS -->
  <div class="eng-section-header">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/></svg>
    3. PVGIS Veri Girişi
  </div>
  <div class="formula-card">
    <div class="formula-title">PVGIS API v5.2 — JRC / EC</div>
    <div class="formula-body">Endpoint: re.jrc.ec.europa.eu/api/v5_2/PVcalc
lat=${state.lat?.toFixed(4)}  lon=${state.lon?.toFixed(4)}
peakpower=${r.systemPower.toFixed(2)} kWp   loss=${r.pvgisLossParam ?? 0}%
angle=${state.tilt}°   aspect=${pvgisAzimut}°  (Güney=0°, Batı=+90°, Doğu=-90°)

PVGIS Brüt Üretim: ${fmt(r.pvgisRawEnergy)} kWh/yıl
GHI: ${state.ghi} kWh/m²/yıl${r.usedFallback ? '\n⚠ API erişilemedi — PSH tabanlı yerel hesap kullanıldı' : ''}</div>
    <div class="formula-note">PVGIS çağrısı loss=${r.pvgisLossParam ?? 0}% ile yapılır; gölgelenme, kirlenme, bifacial, inverter ve kablo kayıpları GüneşHesap metodolojisi (${r.methodologyVersion || '—'}) içinde ayrıca uygulanır.</div>
  </div>

  <!-- 4. Loss Waterfall -->
  <div class="eng-section-header">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
    4. Enerji Kayıp Şelalesi
  </div>
  <div class="formula-card">
    <div class="formula-title">E_net = E_brüt × (1−gölge) × (1−kirlenme) × k_bifacial × η_inv${r.cableLossPct > 0 ? ' × (1−kablo)' : ''}${r.usedFallback ? ' × (1+α×ΔT) × k_yön' : ''}</div>
    <div class="loss-waterfall">
      <div class="loss-row">
        <div class="loss-label">PVGIS Brüt Üretim${r.usedFallback ? ' (Fallback)' : ''}</div>
        <div class="loss-bar-wrap"><div class="loss-bar-fill neutral" style="width:100%"></div></div>
        <div class="loss-val neutral">${fmt(r.pvgisRawEnergy)} kWh</div>
      </div>
      <div class="loss-row">
    <div class="loss-label">− Gölgelenme (%${r.effectiveShadingFactor ?? state.shadingFactor})</div>
        <div class="loss-bar-wrap"><div class="loss-bar-fill negative" style="width:${shadingPct}%"></div></div>
        <div class="loss-val negative">−${fmt(r.shadingLoss)} kWh</div>
      </div>
      <div class="loss-row">
        <div class="loss-label">− Kirlenme / Soiling (%${state.soilingFactor})</div>
        <div class="loss-bar-wrap"><div class="loss-bar-fill negative" style="width:${soilingPct}%"></div></div>
        <div class="loss-val negative">−${fmt(r.soilingLoss)} kWh</div>
      </div>
      ${r.cableLossPct > 0 ? `<div class="loss-row">
        <div class="loss-label">− Kablo Kaybı (%${cablePct})</div>
        <div class="loss-bar-wrap"><div class="loss-bar-fill negative" style="width:${cablePct}%"></div></div>
        <div class="loss-val negative">−${fmt(r.cableLoss || 0)} kWh</div>
      </div>` : ''}
      ${r.usedFallback ? `<div class="loss-row">
        <div class="loss-label">− Sıcaklık (${r.avgSummerTemp}°C, α=${(p.tempCoeff*100).toFixed(3)}%/°C)</div>
        <div class="loss-bar-wrap"><div class="loss-bar-fill negative" style="width:${tempPct}%"></div></div>
        <div class="loss-val negative">−${fmt(r.tempLossEnergy)} kWh</div>
      </div>
      <div class="loss-row">
        <div class="loss-label">− Yön kaybı (${state.azimuthName}, k=${state.azimuthCoeff.toFixed(2)})</div>
        <div class="loss-bar-wrap"><div class="loss-bar-fill negative" style="width:${azimuthPct}%"></div></div>
        <div class="loss-val negative">−${fmt(r.azimuthLossEnergy)} kWh</div>
      </div>` : `<div class="loss-row" style="opacity:0.6">
        <div class="loss-label">✔ Sıcaklık + Yön düzeltmesi PVGIS iç modelinde dahil</div>
        <div class="loss-bar-wrap"></div>
        <div class="loss-val" style="color:var(--text-muted)">—</div>
      </div>`}
      ${r.bifacialGainEnergy > 0 ? `
      <div class="loss-row">
        <div class="loss-label">+ Bifacial albedo (+${(p.bifacialGain*100).toFixed(0)}% arka yüz)</div>
        <div class="loss-bar-wrap"><div class="loss-bar-fill positive" style="width:${bifacialPct}%"></div></div>
        <div class="loss-val positive">+${fmt(r.bifacialGainEnergy)} kWh</div>
      </div>` : ''}
      <div class="loss-row" style="padding:10px 8px;background:rgba(16,185,129,0.06);border-radius:6px">
        <div class="loss-label" style="font-weight:700;color:var(--text)">= Net Yıllık Üretim</div>
        <div class="loss-bar-wrap"><div class="loss-bar-fill positive" style="width:${Math.min(netEnergy/maxRef*100,100).toFixed(1)}%"></div></div>
        <div class="loss-val positive">${fmt(netEnergy)} kWh</div>
      </div>
    </div>
  </div>

  <!-- 5. Performance -->
  <div class="eng-section-header">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>
    5. Performans Metrikleri
  </div>
  <div class="perf-badges">
    <div class="perf-badge"><div class="perf-badge-val">${r.pr}%</div><div class="perf-badge-label">Performans Oranı (PR)</div></div>
    <div class="perf-badge"><div class="perf-badge-val">${r.psh}</div><div class="perf-badge-label">PSH (saat/gün)</div></div>
    <div class="perf-badge"><div class="perf-badge-val">${r.ysp}</div><div class="perf-badge-label">Spesifik Verim (kWh/kWp)</div></div>
    <div class="perf-badge"><div class="perf-badge-val">${r.cf}%</div><div class="perf-badge-label">Kapasite Faktörü (CF)</div></div>
    <div class="perf-badge"><div class="perf-badge-val">${r.irr}%</div><div class="perf-badge-label">IRR</div></div>
    <div class="perf-badge"><div class="perf-badge-val">${Number.isFinite(lcoeValue) ? lcoeValue.toFixed(2) : '—'}</div><div class="perf-badge-label">LCOE (TL/kWh)</div></div>
  </div>
  <div class="formula-card">
    <div class="formula-title">PR — Performans Oranı (IEC 61724)</div>
    <div class="formula-body">PR = E_net ÷ (P_stc × POA)
= ${fmt(netEnergy)} kWh ÷ (${r.systemPower.toFixed(2)} kWp × ${r.pvgisPoa || state.ghi || 'N/A'} kWh/m²) = ${r.pr}%

P_stc birim: kWp, POA birim: kWh/m²/yıl → Sonuç boyutsuz oran</div>
    <div class="formula-note">POA değeri PVGIS eğimli düzlem ışınımından alınır; fallback modunda PSH tabanlı yaklaşık değer kullanılır.</div>
  </div>
  <div class="formula-card">
    <div class="formula-title">LCOE — İskonto Edilmiş Normalleştirilmiş Enerji Maliyeti</div>
    <div class="formula-body">LCOE = Σ(Cost_t/(1+d)ᵗ) ÷ Σ(E_t/(1+d)ᵗ)

Toplam maliyet (yıl 0): ${money(r.totalCost)}
25 yıl O&M + sigorta giderleri: ${money(r.totalExpenses25y)}
İskonto oranı: %${(r.discountRate*100).toFixed(0)}

LCOE = ${moneyRate(r.lcoe, 'kWh')}</div>
    <div class="formula-note">Kullanıcı tarifesi: ${moneyRate(r.tariff, 'kWh')} (${escapeHtml(state.tariffType)}). LCOE karşılaştırması sadece ön fizibilite göstergesidir; resmi teklif, finansman ve vergi koşulları ayrıca doğrulanmalıdır.${Number.isFinite(lcoeValue) ? ` Fark: ${moneyRate(r.tariff - lcoeValue, 'kWh')}.` : ''}</div>
  </div>
  <div class="formula-card">
    <div class="formula-title">IRR — İç Getiri Oranı (Bisection kök arama)</div>
    <div class="formula-body">NPV(r) = −C₀ + Σₜ [NCFₜ ÷ (1+r)ᵗ] = 0  çözülür
C₀ = ${money(r.totalCost)}   (ilk yatırım)
NCFₜ = Tasarrufₜ − Giderₜ
Eₜ = E₁ × (1−LID) × (1−δ)ⁿ⁻¹   LID=${r.lidFactor}%, δ=${(p.degradation*100).toFixed(2)}%/yıl
Pₜ = P₀ × (1+g)ᵗ⁻¹   g=${(r.annualPriceIncrease*100).toFixed(0)}%/yıl
IRR = ${r.irr === 'N/A' ? 'Hesaplanamadı' : r.irr + '%'}</div>
    <div class="formula-note">IRR > iskonto oranı (%${(r.discountRate*100).toFixed(0)}) ise proje pozitif NPV üretir.</div>
  </div>

  <!-- 6. Maliyet -->
  <div class="eng-section-header">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
    6. 2026 Maliyet Kırılımı
  </div>
  <div class="formula-card">
    <div class="formula-title">Maliyet Analizi — 2026 Q1 Türkiye Piyasası</div>
    <table class="cost-breakdown-table">
      <thead><tr><th>Kalem</th><th>Birim Fiyat</th><th>Miktar</th><th>Tutar</th></tr></thead>
      <tbody>
        <tr><td>Panel (${p.name})</td><td>${moneyRate(p.pricePerWatt, 'Wp')}</td><td>${fmt(r.systemPower * 1000)} Wp</td><td>${money(cb.panel)}</td></tr>
        <tr><td>İnverter (${r.inverterType || 'String'})</td><td>${moneyRate(cb.invUnit, 'kWp')}</td><td>${r.systemPower.toFixed(2)} kWp</td><td>${money(cb.inverter)}</td></tr>
        <tr><td>Montaj Sistemi</td><td>${moneyRate(2200, 'kWp')}</td><td>${r.systemPower.toFixed(2)} kWp</td><td>${money(cb.mounting)}</td></tr>
        <tr><td>DC Kablo + MC4</td><td>${moneyRate(600, 'kWp')}</td><td>${r.systemPower.toFixed(2)} kWp</td><td>${money(cb.dcCable)}</td></tr>
        <tr><td>AC Tesisat</td><td>${moneyRate(900, 'kWp')}</td><td>${r.systemPower.toFixed(2)} kWp</td><td>${money(cb.acElec)}</td></tr>
        <tr><td>İşçilik</td><td>${moneyRate(1800, 'kWp')}</td><td>${r.systemPower.toFixed(2)} kWp</td><td>${money(cb.labor)}</td></tr>
        <tr><td>TEDAŞ Bağlantı</td><td>sabit</td><td>1 adet</td><td>${money(cb.permits)}</td></tr>
        <tr><td colspan="3">Ara Toplam (KDV hariç)</td><td>${money(cb.subtotal)}</td></tr>
        <tr><td colspan="3">KDV (%${Math.round((cb.kdvRate ?? 0.20) * 100)})</td><td>${money(cb.kdv)}</td></tr>
        <tr class="total-row"><td colspan="3"><strong>GENEL TOPLAM</strong></td><td><strong>${money(cb.total)}</strong></td></tr>
        ${r.annualOMCost > 0 ? `<tr style="border-top:2px solid var(--border)"><td colspan="3">Yıllık Bakım (O&M) — %${state.omRate}</td><td>${money(r.annualOMCost)}/yıl</td></tr>` : ''}
        ${r.annualInsurance > 0 ? `<tr><td colspan="3">Yıllık Sigorta — %${state.insuranceRate}</td><td>${money(r.annualInsurance)}/yıl</td></tr>` : ''}
        ${r.inverterReplaceCost > 0 ? `<tr><td colspan="3">İnverter Yenileme (Yıl ${r.inverterLifetime || 12})</td><td>${money(r.inverterReplaceCost)}</td></tr>` : ''}
      </tbody>
    </table>
  </div>

  <!-- 7. 25 Yıl Tablo -->
  <div class="eng-section-header">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
    7. 25 Yıl Projeksiyon Tablosu
  </div>
  <div class="formula-card">
    <div class="formula-title">Yıllık Hesap Formülleri</div>
    <div class="formula-body">Eₜ = E₁ × (1−LID) × (1−δ)ⁿ⁻¹    LID=${r.lidFactor}% (ilk yıl), δ=${(p.degradation*100).toFixed(2)}%/yıl
Pₜ = P₀ × (1 + g)ᵗ⁻¹   g=${(r.annualPriceIncrease*100).toFixed(0)}%/yıl tarife artışı, P₀=${r.tariff} TL/kWh
Gelirₜ = Öz tüketimₜ × ithalat tarifesiₜ + ücretli ihracatₜ × ihracat tarifesiₜ
Giderₜ = O&M + Sigorta
NCFₜ = Gelirₜ − Giderₜ
NPVₜ = NCFₜ ÷ (1+d)ᵗ    d=${(r.discountRate*100).toFixed(0)}%
25 Yıl Toplam Üretim: ${fmt(totalEnergy25y)} kWh</div>
    <div class="year-table-wrap">
      <table class="year-table">
        <thead><tr><th>Yıl</th><th>Üretim (kWh)</th><th>Tarife</th><th>Tasarruf</th><th>Gider</th><th>Net</th><th>Kümülatif</th><th>NPV</th></tr></thead>
        <tbody>
          ${r.yearlyTable.map(y => `
          <tr ${y.year === r.paybackYear ? 'class="payback-row"' : ''}>
            <td>${y.year}${y.year === r.paybackYear ? ' ✓' : ''}</td>
            <td>${fmt(y.energy)}</td>
            <td>${y.rate}</td>
            <td>${money(y.savings)}</td>
            <td style="color:var(--danger)">${y.expenses > 0 ? '-' + money(y.expenses) : '0'}</td>
            <td>${money(y.netCashFlow)}</td>
            <td>${money(y.cumulative)}</td>
            <td>${money(y.npv)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <div class="formula-note">Yeşil satır (✓) geri ödeme yılını gösterir. Yıllık giderler: O&M ${money(r.annualOMCost)} + Sigorta ${money(r.annualInsurance)} = ${money(r.annualOMCost + r.annualInsurance)}/yıl.</div>
  </div>`;

  if (gov.confidence) {
    const evidence = r.evidenceGovernance || {};
    const tariffSource = r.tariffSourceGovernance || {};
    const evidenceFileCount = Object.values(evidence.registry || {}).reduce((sum, record) => sum + ((record.files || []).length), 0);
    html += `
  <div class="eng-section-header">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12l2 2 4-4"/><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
    Proposal Governance
  </div>
  <div class="formula-card">
    <div class="formula-title">Teklif Hazırlığı ve Varsayım İzlenebilirliği</div>
    <div class="formula-body">Güven skoru: ${gov.confidence.score}/100
Seviye: ${gov.confidence.level}
Onay durumu: ${gov.approval?.state || 'draft'}
Onay kaydı: ${gov.approval?.approvalRecord?.id || '—'}
Şebeke başvuru kontrol listesi: ${gov.gridChecklistComplete ? 'tamamlandı' : 'eksik'}
Regülasyon versiyonu: ${r.quoteReadiness?.version || r.tariffModel?.exportCompensationPolicy?.version || '—'}
Revizyon: ${gov.revision?.id || '—'}
Kanıt durumu: ${evidence.validation?.status || '—'}
Kanıt dosyası sayısı: ${evidenceFileCount}
Audit log kayıt sayısı: ${(state.auditLog || []).length}
Tarife kaynak yaşı: ${tariffSource.ageDays ?? '—'} gün${tariffSource.stale ? ' (STALE)' : ''}</div>
    <div class="formula-note">Quote-ready çıktı yalnızca onay, fatura kanıtı, tedarikçi teklifi, tarife kanıtı, şebeke başvuru kanıtı, çatı doğrulaması ve kritik blocker bulunmaması durumunda müşteri teklifi olarak kullanılmalıdır. Bu rapor statik proje, hukuki görüş veya resmi başvuru belgesi yerine geçmez.</div>
  </div>`;
  }

  // ── 8. BESS Analizi ────────────────────────────────────────────────────────
  if (r.bessMetrics) {
    const bm = r.bessMetrics;
    html += `
  <div class="eng-section-header">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-4 0v2"/></svg>
    8. Batarya Depolama (BESS) Analizi
  </div>
  <div class="formula-card">
    <div class="formula-title">${bm.modelName} — Günlük Enerji Dengesi</div>
    <div class="formula-body">Günlük üretim = ${fmt(r.annualEnergy)} ÷ 365 = ${bm.dailyProduction} kWh/gün
Günlük tüketim = ${state.dailyConsumption} kWh/gün
Kullanılabilir kapasite = ${state.battery.capacity} kWh × ${(state.battery.dod*100).toFixed(0)}% DoD = ${bm.usableCapacity} kWh

Şebeke Bağımsızlığı = ${bm.gridIndependence}%
Gece Kapsamı = ${bm.nightCoverage}%
Batarya kurulu maliyet (seçili model varsayımı): ${money(bm.batteryCost)}</div>
    <div class="formula-result">✓ Şebeke bağımsızlığı: %${bm.gridIndependence} | Gece kapsamı: %${bm.nightCoverage}</div>
  </div>`;
  }

  // ── 9. Saatlik mahsuplaşma ─────────────────────────────────────────────────
  if (r.nmMetrics) {
    const nm = r.nmMetrics;
    const sectionNum = r.bessMetrics ? 9 : 8;
    html += `
  <div class="eng-section-header">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8h1a4 4 0 010 8h-1"/><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/></svg>
    ${sectionNum}. Şebeke İhracatı / Saatlik Mahsuplaşma
  </div>
  <div class="formula-card">
    <div class="formula-title">${nm.systemType}</div>
    <div class="formula-body">Yıllık üretim: ${fmt(r.annualEnergy)} kWh
Yıllık tüketim: ${fmt(r.hourlySummary?.annualLoad || state.dailyConsumption * 365)} kWh
Öz tüketim oranı = ${nm.selfConsumptionPct}%
Yıllık ihracat = ${fmt(nm.annualGridExport)} kWh
Ödeme hesabına alınan ihracat = ${fmt(nm.paidGridExport || 0)} kWh
Sınır dışında kalan ihracat = ${fmt(nm.unpaidGridExport || 0)} kWh

Saatlik mahsuplaşma:
İhracat geliri = ${money(nm.annualExportRevenue)}/yıl</div>
    <div class="formula-result">✓ ${money(nm.annualExportRevenue)}/yıl ek şebeke geliri</div>
  </div>`;
  }

  body.innerHTML = html;
}

// ─── Bilimsel gösterim formatı ───────────────────────────────────────────────
function formatSci(n, digits = 3) {
  if (!Number.isFinite(n) || n === 0) return '0';
  const exp = Math.floor(Math.log10(Math.abs(n)));
  const coeff = (n / Math.pow(10, exp)).toFixed(digits);
  return `${coeff} × 10<sup>${exp}</sup>`;
}

// ─── Step-4 Özet Hesap Paneli ────────────────────────────────────────────────
export function renderEngCalcPanel() {
  const state = window.state;
  const r = state?.results;
  const panel = document.getElementById('eng-calc-panel');
  if (!panel || !r) return;

  const p = PANEL_TYPES[state.panelType];
  if (!p) return;

  const currency = state.displayCurrency || 'TRY';
  const usdToTry = Math.max(0.0001, Number(state.usdToTry) || 38.5);
  const moneyFmt = v => {
    const converted = currency === 'USD' ? (Number(v) || 0) / usdToTry : (Number(v) || 0);
    return converted.toLocaleString(currency === 'USD' ? 'en-US' : 'tr-TR', { maximumFractionDigits: 0 }) + ' ' + currency;
  };
  const lcoeValue = Number.parseFloat(r.lcoe);
  const co2Value = Number.parseFloat(r.co2Savings);
  const paybackValue = Number(r.simplePaybackYear || r.paybackYear || 0);

  panel.style.display = 'block';
  panel.innerHTML = `
    <div style="background:rgba(245,158,11,0.04);border:1px solid rgba(245,158,11,0.2);border-radius:10px;padding:16px;margin-top:16px">
      <div style="font-family:var(--font-display);font-weight:700;font-size:0.9rem;margin-bottom:12px;display:flex;align-items:center;gap:8px">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"/></svg>
        Temel Fizik Hesapları
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px;font-size:0.8rem">
        <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border-subtle);border-radius:8px;padding:10px">
          <div style="color:var(--text-muted);margin-bottom:4px">Kurulu güç (P<sub>dc</sub>)</div>
          <div style="font-family:monospace;font-size:0.85rem">${r.panelCount} × ${p.wattPeak} Wp = <strong style="color:var(--accent)">${(r.systemPower * 1000).toFixed(0)} W<sub>p</sub></strong></div>
          <div style="color:var(--text-muted);font-size:0.75rem;margin-top:3px">${formatSci(r.systemPower * 1000, 3)} W</div>
        </div>
        <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border-subtle);border-radius:8px;padding:10px">
          <div style="color:var(--text-muted);margin-bottom:4px">Yıllık enerji üretimi (E<sub>yıl</sub>)</div>
          <div style="font-family:monospace;font-size:0.85rem"><strong style="color:var(--primary)">${r.annualEnergy.toLocaleString('tr-TR')} kWh/yıl</strong></div>
          <div style="color:var(--text-muted);font-size:0.75rem;margin-top:3px">${formatSci(r.annualEnergy * 3.6e6, 3)} J/yıl</div>
        </div>
        <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border-subtle);border-radius:8px;padding:10px">
          <div style="color:var(--text-muted);margin-bottom:4px">25 yıllık kümülatif enerji</div>
          <div style="font-family:monospace;font-size:0.85rem"><strong style="color:var(--primary)">${r.yearlyTable.reduce((s,y)=>s+y.energy,0).toLocaleString('tr-TR')} kWh</strong></div>
          <div style="color:var(--text-muted);font-size:0.75rem;margin-top:3px">${formatSci(r.yearlyTable.reduce((s,y)=>s+y.energy,0) * 3.6e6, 3)} J</div>
        </div>
        <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border-subtle);border-radius:8px;padding:10px">
          <div style="color:var(--text-muted);margin-bottom:4px">Toplam yatırım</div>
          <div style="font-family:monospace;font-size:0.85rem"><strong style="color:var(--text)">${moneyFmt(r.totalCost)}</strong></div>
          <div style="color:var(--text-muted);font-size:0.75rem;margin-top:3px">${formatSci(r.totalCost, 3)} TL</div>
        </div>
        <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border-subtle);border-radius:8px;padding:10px">
          <div style="color:var(--text-muted);margin-bottom:4px">LCOE (Eşleşik Enerji Maliyeti)</div>
          <div style="font-family:monospace;font-size:0.85rem"><strong style="color:var(--accent)">${Number.isFinite(lcoeValue) ? lcoeValue.toFixed(2) : '—'} TL/kWh</strong></div>
          <div style="color:var(--text-muted);font-size:0.75rem;margin-top:3px">Tüm ömür giderler ÷ toplam enerji</div>
        </div>
        <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border-subtle);border-radius:8px;padding:10px">
          <div style="color:var(--text-muted);margin-bottom:4px">Performans Oranı (PR)</div>
          <div style="font-family:monospace;font-size:0.85rem"><strong style="color:var(--success)">${r.pr}%</strong></div>
          <div style="color:var(--text-muted);font-size:0.75rem;margin-top:3px">IEC 61724-1 metriği</div>
        </div>
        <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border-subtle);border-radius:8px;padding:10px">
          <div style="color:var(--text-muted);margin-bottom:4px">CO₂ tasarrufu (yıllık)</div>
          <div style="font-family:monospace;font-size:0.85rem"><strong style="color:var(--success)">${Number.isFinite(co2Value) ? co2Value.toFixed(1) : '—'} t CO₂</strong></div>
          <div style="color:var(--text-muted);font-size:0.75rem;margin-top:3px">${formatSci((Number.isFinite(co2Value) ? co2Value : 0) * 1000, 3)} kg CO₂/yıl</div>
        </div>
        <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border-subtle);border-radius:8px;padding:10px">
          <div style="color:var(--text-muted);margin-bottom:4px">Geri ödeme süresi</div>
          <div style="font-family:monospace;font-size:0.85rem"><strong style="color:var(--text)">${paybackValue ? paybackValue.toFixed(1) : '>25'} yıl</strong></div>
          <div style="color:var(--text-muted);font-size:0.75rem;margin-top:3px">Basit geri ödeme (vergi öncesi)</div>
        </div>
      </div>
    </div>`;
}

// window'a expose et
window.toggleEngReport = toggleEngReport;
window.renderEngReport = renderEngReport;
window.renderEngCalcPanel = renderEngCalcPanel;
