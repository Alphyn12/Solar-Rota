// ═══════════════════════════════════════════════════════════
// INVERTER — Çoklu İnverter Seçimi (Faz B3)
// GüneşHesap v2.0
// ═══════════════════════════════════════════════════════════
import { INVERTER_TYPES } from './data.js';
import { convertTry } from './exchange-rate.js';

const inverterDescriptions = {
  string:    'Tüm panellerin enerjisini merkezi bir cihaz dönüştürür. Gölge ve yön sorunu yoksa en ekonomik çözüm.',
  micro:     'Her panele ayrı inverter. Gölgeli veya farklı yönlü çatılarda üstün performans ve panel düzeyinde izleme.',
  optimizer: 'Her panelde DC optimizör + merkezi string inverter. Yüksek gölge toleransı, mikro inverterden daha düşük maliyet.'
};

export function buildInverterCards() {
  const wrap = document.getElementById('inverter-cards-wrap');
  if (!wrap) return;

  const state = window.state;
  const selected = state.inverterType || 'string';
  const cur = state?.displayCurrency || 'TRY';
  const rate = state?.usdToTry || 40;

  wrap.innerHTML = Object.entries(INVERTER_TYPES).map(([key, inv]) => {
    const price10 = convertTry(inv.pricePerKWp.lt10, cur, rate);
    const priceStr = cur === 'USD'
      ? `$${price10.toLocaleString('en-US', { maximumFractionDigits: 0 })}/kWp`
      : `${inv.pricePerKWp.lt10.toLocaleString('tr-TR')} ₺/kWp`;
    return `
    <div class="inverter-card${selected === key ? ' selected' : ''}" id="inv-card-${key}" onclick="selectInverter('${key}')">
      <div class="inverter-check">✓</div>
      <div class="inverter-card-title">${inv.name}</div>
      <div style="font-size:0.71rem;color:var(--text-muted);line-height:1.5;margin:6px 4px 10px;text-align:center">${inverterDescriptions[key]}</div>
      <div class="inverter-card-eff">${(inv.efficiency * 100).toFixed(1)}%</div>
      <div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px">Verimlilik</div>
      <div class="inverter-card-stats">
        <div class="inverter-stat">
          <span class="inverter-stat-label">Gölge Toleransı</span>
          <span style="color:${inv.shadeTolerance >= 0.85 ? '#10B981' : inv.shadeTolerance >= 0.70 ? '#F59E0B' : '#EF4444'}">${(inv.shadeTolerance * 100).toFixed(0)}%</span>
        </div>
        <div class="inverter-stat">
          <span class="inverter-stat-label">Ömür</span>
          <span>${inv.lifetime} yıl</span>
        </div>
        <div class="inverter-stat">
          <span class="inverter-stat-label">Fiyat (≤10 kWp)</span>
          <span>${priceStr}</span>
        </div>
      </div>
      <div class="inverter-card-pros">
        ${inv.advantages.map(a => `<div class="inv-pro">✓ ${a}</div>`).join('')}
      </div>
      <div class="inverter-card-cons">
        ${inv.disadvantages.map(d => `<div class="inv-con">✗ ${d}</div>`).join('')}
      </div>
    </div>
  `;
  }).join('');
}

export function selectInverter(key) {
  const state = window.state;
  state.inverterType = key;

  document.querySelectorAll('.inverter-card').forEach(c => c.classList.remove('selected'));
  const card = document.getElementById(`inv-card-${key}`);
  if (card) card.classList.add('selected');

  const inv = INVERTER_TYPES[key];
  const infoEl = document.getElementById('inverter-info');
  if (infoEl) {
    infoEl.innerHTML = `
      <div class="inverter-selected-info">
        <span style="color:var(--primary);font-weight:600">${inv.name}</span> seçildi —
        Verimlilik: <strong>${(inv.efficiency * 100).toFixed(1)}%</strong> |
        Ömür: <strong>${inv.lifetime} yıl</strong> |
        Gölge Toleransı: <strong>${(inv.shadeTolerance * 100).toFixed(0)}%</strong>
      </div>`;
  }
}

// window'a expose et
window.buildInverterCards = buildInverterCards;
window.selectInverter = selectInverter;
