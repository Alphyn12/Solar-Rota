// ═══════════════════════════════════════════════════════════
// APP.JS — Ana Orkestratör
// GüneşHesap v2.0 — Modüler Mimari
// ═══════════════════════════════════════════════════════════
import {
  TURKISH_CITIES, PANEL_TYPES, BATTERY_MODELS, COMPASS_DIRS,
  PSH_FALLBACK, CITY_SUMMER_TEMPS, MONTHS, MONTH_WEIGHTS,
  DEFAULT_TARIFFS, INVERTER_TYPES, HEAT_PUMP_DATA
} from './data.js';
import { showToast, animateCounter, launchConfetti, resetConfetti, renderPRGauge } from './ui-charts.js';
import { renderResults, renderMonthlyChart, downloadPDF, shareResults, loadFromHash } from './ui-render.js';
import { toggleEngReport, renderEngReport } from './eng-report.js';
import { runCalculation, calculateBatteryMetrics, calculateNMMetrics } from './calc-engine.js';
import { renderHourlyProfile, setHourlySeason } from './hourly-profile.js';
import { toggleBillBlock, onBillToggle, onBillInput, billQuickFill, billClear } from './bill-analysis.js';
import { buildInverterCards, selectInverter } from './inverter.js';
import { updateCableLoss, toggleCableLossBlock, onCableLossToggle } from './cable-loss.js';
import { calculateStructural } from './structural.js';
import { toggleEVBlock, onEVToggle, updateEVInput } from './ev-charging.js';
import { toggleHeatPumpBlock, onHeatPumpToggle, updateHeatPumpInput } from './heat-pump.js';
import { renderSunPath } from './sun-path.js';
import { renderScenarioAnalysis, onScenarioCustomChange } from './scenarios.js';
import { toggleTaxBlock, onTaxToggle, updateTaxInput } from './tax.js';
import { openComparison, closeComparison, runComparison } from './comparison.js';
import { saveCurrentCalculation, openDashboard, closeDashboard, updateDashboard, compareDashboardSelected, deleteSavedRecord, clearAllSaved } from './dashboard.js';
import { showHeatmapCard, toggleHeatmapAnimation, setHeatmapMonth } from './heatmap.js';
import { i18n, switchLanguage } from './i18n.js';

// ── Global data referansı ────────────────────────────────────────────────────
window._appData = { PANEL_TYPES, BATTERY_MODELS, COMPASS_DIRS, INVERTER_TYPES, MONTHS, HEAT_PUMP_DATA };

// ═══════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════
window.state = {
  step: 1,
  lat: null, lon: null, cityName: null, ghi: null,
  roofArea: null, tilt: 33, azimuth: 180, azimuthCoeff: 1.00,
  azimuthName: "Güney", shadingFactor: 10,
  panelType: 'mono',
  inverterType: 'string',
  results: null,
  // Çoklu çatı
  multiRoof: false,
  roofSections: [],
  // Tüketim & BESS
  dailyConsumption: 20,
  batteryEnabled: false,
  battery: { model: 'pylontech', capacity: 9.6, dod: 0.90, efficiency: 0.92 },
  // Net metering
  netMeteringEnabled: false,
  usdToTry: 38.5,
  displayCurrency: 'TRY',
  // Tarife
  tariff: 7.16,
  tariffType: 'residential',
  tariffMode: 'manual',
  exportTariff: 7.16,
  annualPriceIncrease: 0.12,
  discountRate: 0.18,
  tariffIncludesTax: true,
  tariffSourceDate: '2026-04-12',
  // Kirlenme
  soilingFactor: 3,
  // Bakım & İşletme
  omEnabled: true,
  omRate: 1.2,
  insuranceRate: 0.5,
  costOverridesEnabled: false,
  costOverrides: {},
  // Faz B
  billAnalysisEnabled: false,
  monthlyConsumption: null,
  cableLossEnabled: false,
  cableLoss: null,
  // Faz C
  evEnabled: false,
  ev: null,
  heatPumpEnabled: false,
  heatPump: null,
  // Faz D
  taxEnabled: false,
  tax: null
};

// ═══════════════════════════════════════════════════════════
// MAP INIT
// ═══════════════════════════════════════════════════════════
let map, marker;
window.map = null;
window.marker = null;

function initMap() {
  map = L.map('map').setView([39.0, 35.0], 6);
  window.map = map;
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    subdomains: 'abcd', maxZoom: 19, detectRetina: false
  }).addTo(map);

  TURKISH_CITIES.forEach(city => {
    const color = getGHIColor(city.ghi);
    L.circleMarker([city.lat, city.lon], {
      radius: 5, fillColor: color, color: '#fff',
      weight: 0.5, opacity: 0.8, fillOpacity: 0.75
    }).addTo(map).bindTooltip(`${city.name} — GHI: ${city.ghi} kWh/m²/yıl`);
  });

  const markerIcon = L.divIcon({
    html: `<div style="width:22px;height:22px;background:#F59E0B;border:2px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.5)"></div>`,
    className: '', iconSize: [22, 22], iconAnchor: [11, 11]
  });
  marker = L.marker([39.0, 35.0], { icon: markerIcon, draggable: true }).addTo(map);
  window.marker = marker;
  marker.on('dragend', e => {
    const ll = e.target.getLatLng();
    selectLocationFromLatLon(ll.lat, ll.lng, true);
  });
  map.on('click', e => selectLocationFromLatLon(e.latlng.lat, e.latlng.lng, true));

  setTimeout(() => map.invalidateSize(), 100);
  setTimeout(() => map.invalidateSize(), 600);
}

function getGHIColor(ghi) {
  if (ghi < 1300) return '#6B7280';
  if (ghi < 1450) return '#3B82F6';
  if (ghi < 1600) return '#22C55E';
  if (ghi < 1700) return '#EAB308';
  if (ghi < 1800) return '#F97316';
  return '#EF4444';
}

function selectLocationFromLatLon(lat, lon, checkBounds) {
  if (checkBounds && !isInTurkey(lat, lon)) {
    document.getElementById('location-warning').style.display = 'block';
    if (marker && window.state.lat && window.state.lon) {
      marker.setLatLng([window.state.lat, window.state.lon]);
    }
    return;
  }
  document.getElementById('location-warning').style.display = 'none';
  window.state.lat = lat; window.state.lon = lon;
  marker.setLatLng([lat, lon]);
  let nearest = null, minDist = Infinity;
  TURKISH_CITIES.forEach(c => {
    const d = Math.hypot(c.lat - lat, c.lon - lon);
    if (d < minDist) { minDist = d; nearest = c; }
  });
  if (nearest) {
    window.state.cityName = nearest.name;
    window.state.ghi = nearest.ghi;
    document.getElementById('city-search').value = nearest.name;
    document.getElementById('selected-loc-text').textContent =
      `${nearest.name} — ${lat.toFixed(4)}°K, ${lon.toFixed(4)}°D (GHI: ${nearest.ghi})`;
  } else {
    document.getElementById('selected-loc-text').textContent =
      `${lat.toFixed(4)}°K, ${lon.toFixed(4)}°D`;
  }
}

function isInTurkey(lat, lon) {
  return lat >= 35.8 && lat <= 42.2 && lon >= 25.6 && lon <= 44.8;
}

// ═══════════════════════════════════════════════════════════
// AUTOCOMPLETE
// ═══════════════════════════════════════════════════════════
let acIndex = -1;
document.addEventListener('DOMContentLoaded', () => {
  try { initMap(); } catch(e) {
    console.error('initMap hatası:', e);
    document.getElementById('map').innerHTML =
      `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#F59E0B;font-size:0.85rem;padding:20px;text-align:center">⚠ Harita yüklenemedi: ${e.message}</div>`;
  }
  buildPanelCards();
  buildCompass();
  buildInverterCards();
  loadFromHash();
  updateDashboard();

  const input = document.getElementById('city-search');
  const list = document.getElementById('autocomplete-list');

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    list.innerHTML = '';
    acIndex = -1;
    if (q.length < 1) { list.classList.remove('open'); input.setAttribute('aria-expanded','false'); return; }
    const matches = TURKISH_CITIES.filter(c => c.name.toLowerCase().includes(q)).slice(0, 8);
    if (!matches.length) { list.classList.remove('open'); input.setAttribute('aria-expanded','false'); return; }
    matches.forEach((c, i) => {
      const item = document.createElement('div');
      item.className = 'autocomplete-item';
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', 'false');
      item.innerHTML = `<span>${c.name}</span><span class="autocomplete-ghi">${c.ghi} kWh/m²</span>`;
      item.addEventListener('mousedown', () => selectCity(c));
      list.appendChild(item);
    });
    list.classList.add('open');
    input.setAttribute('aria-expanded', 'true');
  });

  input.addEventListener('keydown', e => {
    const items = list.querySelectorAll('.autocomplete-item');
    if (e.key === 'ArrowDown') { acIndex = Math.min(acIndex+1, items.length-1); highlightAC(items); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { acIndex = Math.max(acIndex-1, -1); highlightAC(items); e.preventDefault(); }
    else if (e.key === 'Enter' && acIndex >= 0) { items[acIndex].dispatchEvent(new Event('mousedown')); e.preventDefault(); }
    else if (e.key === 'Escape') { list.classList.remove('open'); }
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('.input-wrap')) {
      list.classList.remove('open');
      input.setAttribute('aria-expanded', 'false');
    }
  });

  document.querySelectorAll('#step-2 input[type=number]').forEach(el => {
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); validateStep2(); }
    });
  });

  // i18n başlat
  i18n.init().catch(() => {});
});

function highlightAC(items) {
  items.forEach((el, i) => el.classList.toggle('selected', i === acIndex));
}

function selectCity(city) {
  window.state.lat = city.lat; window.state.lon = city.lon;
  window.state.cityName = city.name; window.state.ghi = city.ghi;
  document.getElementById('city-search').value = city.name;
  document.getElementById('autocomplete-list').classList.remove('open');
  document.getElementById('location-warning').style.display = 'none';
  document.getElementById('selected-loc-text').textContent =
    `${city.name} — ${city.lat.toFixed(4)}°K, ${city.lon.toFixed(4)}°D (GHI: ${city.ghi})`;
  map.setView([city.lat, city.lon], 9, { animate: true });
  marker.setLatLng([city.lat, city.lon]);
}

function useGeolocation() {
  if (!navigator.geolocation) { showToast('Tarayıcınız konum belirlemeyi desteklemiyor.', 'error'); return; }
  const btn = document.getElementById('geolocation-btn');
  btn.disabled = true; btn.textContent = 'Konum alınıyor...';
  navigator.geolocation.getCurrentPosition(pos => {
    btn.disabled = false; btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg> Konumumu Kullan`;
    const { latitude, longitude } = pos.coords;
    if (!isInTurkey(latitude, longitude)) {
      showToast('Konumunuz Türkiye sınırları dışında.', 'error');
      document.getElementById('location-warning').style.display = 'block';
      return;
    }
    selectLocationFromLatLon(latitude, longitude, false);
    map.setView([latitude, longitude], 10, { animate: true });
  }, err => {
    btn.disabled = false;
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg> Konumumu Kullan`;
    showToast('Konum erişimi reddedildi.', 'error');
  });
}

// ═══════════════════════════════════════════════════════════
// STEP 2 — TILT & SHADING & SOILING
// ═══════════════════════════════════════════════════════════
function updateTilt(val) {
  val = parseInt(val);
  window.state.tilt = val;
  document.getElementById('tilt-val').textContent = val + '°';
  positionRangeThumb('tilt-slider', 'tilt-val', 0, 90);

  const cx = 50, cy = 80, len = 110;
  const rad = (val * Math.PI) / 180;
  const x2 = cx + len * Math.cos(Math.PI - rad);
  const y2 = cy - len * Math.sin(rad);
  document.getElementById('tilt-line').setAttribute('x1', cx);
  document.getElementById('tilt-line').setAttribute('y1', cy);
  document.getElementById('tilt-line').setAttribute('x2', x2);
  document.getElementById('tilt-line').setAttribute('y2', y2);
  document.getElementById('tilt-angle-text').textContent = val + '°';
  document.getElementById('tilt-angle-text').setAttribute('x', cx + 35);
  document.getElementById('tilt-angle-text').setAttribute('y', cy - 8);

  const info = document.getElementById('tilt-info');
  info.className = '';
  if (val >= 25 && val <= 40) {
    info.className = 'tilt-good'; info.textContent = 'Optimal açı aralığı ✓';
  } else if ((val >= 15 && val < 25) || (val > 40 && val <= 55)) {
    info.className = 'tilt-warn'; info.textContent = 'Kabul edilebilir açı aralığı';
  } else {
    info.className = 'tilt-bad'; info.textContent = 'Verimsiz açı — düzeltme önerilir';
  }
}

function updateShading(val) {
  window.state.shadingFactor = parseInt(val);
  document.getElementById('shading-val').textContent = val + '%';
  positionRangeThumb('shading-slider', 'shading-val', 0, 50);
  const desc = ['Gölge yok', 'Az gölge', 'Orta gölge', 'Ciddi gölge'];
  const idx = val == 0 ? 0 : val <= 15 ? 1 : val <= 35 ? 2 : 3;
  document.getElementById('shading-desc').textContent = desc[idx];
}

function updateSoiling(val) {
  window.state.soilingFactor = parseInt(val) || 0;
  document.getElementById('soiling-val').textContent = val + '%';
  positionRangeThumb('soiling-slider', 'soiling-val', 0, 10);
  const descs = ['Temiz panel', 'Minimal kirlenme', 'Az kirlenme', 'Orta düzey kirlenme', 'Yüksek kirlenme'];
  const idx = val == 0 ? 0 : val <= 2 ? 1 : val <= 4 ? 2 : val <= 7 ? 3 : 4;
  document.getElementById('soiling-desc').textContent = descs[idx];
}

function updateTariffType(type) {
  window.state.tariffType = type;
  window.state.tariffMode = type === 'custom' ? 'custom' : 'manual';
  const descs = {
    residential: 'EPDK/SKTT 2026: mesken yıllık limit 4.000 kWh. Birim fiyatı faturanızdan doğrulayın.',
    commercial: 'EPDK/SKTT 2026: mesken dışı yıllık limit 15.000 kWh. Birim fiyatı faturanızdan doğrulayın.',
    industrial: 'EPDK/SKTT 2026: mesken dışı yıllık limit 15.000 kWh. Birim fiyatı faturanızdan doğrulayın.',
    custom: 'Kullanıcı tanımlı tarife'
  };
  if (type !== 'custom') {
    window.state.tariff = DEFAULT_TARIFFS[type] || 7.16;
    document.getElementById('tariff-input').value = window.state.tariff;
    window.state.exportTariff = window.state.tariff;
    const exportEl = document.getElementById('export-tariff-input');
    if (exportEl) exportEl.value = window.state.exportTariff;
  }
  document.getElementById('tariff-desc').textContent = descs[type] || '';
}

function updateTariffAssumptions() {
  const s = window.state;
  s.tariff = parseFloat(document.getElementById('tariff-input')?.value) || s.tariff || 7.16;
  s.exportTariff = parseFloat(document.getElementById('export-tariff-input')?.value) || s.tariff;
  s.usdToTry = parseFloat(document.getElementById('usd-try-input')?.value) || s.usdToTry || 38.5;
  s.displayCurrency = document.getElementById('display-currency')?.value || s.displayCurrency || 'TRY';
  s.annualPriceIncrease = (parseFloat(document.getElementById('price-increase-input')?.value) || 0) / 100;
  s.discountRate = (parseFloat(document.getElementById('discount-rate-input')?.value) || 0) / 100;
  s.tariffIncludesTax = document.getElementById('tariff-tax-included')?.checked ?? true;
  s.tariffSourceDate = document.getElementById('tariff-source-date')?.value || '2026-04-12';
}

function positionRangeThumb(sliderId, valId, min, max) {
  const slider = document.getElementById(sliderId);
  const valEl = document.getElementById(valId);
  if (!slider || !valEl) return;
  const pct = (slider.value - min) / (max - min);
  slider.classList.add('range-filled');
  slider.style.setProperty('--range-pct', (pct * 100).toFixed(1) + '%');
  const w = slider.offsetWidth || 200;
  const thumbW = 20;
  const pos = pct * (w - thumbW) + thumbW / 2;
  valEl.style.left = pos + 'px';
  valEl.style.transform = 'translateX(-50%)';
}

// ═══════════════════════════════════════════════════════════
// COMPASS
// ═══════════════════════════════════════════════════════════
function buildCompass() {
  const g = document.getElementById('compass-dirs');
  g.innerHTML = '';
  const cx = 100, cy = 100, r = 85, innerR = 28;

  COMPASS_DIRS.forEach((dir, i) => {
    const startAngle = (dir.angle - 22.5) * Math.PI / 180;
    const endAngle = (dir.angle + 22.5) * Math.PI / 180;
    const x1 = cx + innerR * Math.cos(startAngle), y1 = cy + innerR * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(startAngle), y2 = cy + r * Math.sin(startAngle);
    const x3 = cx + r * Math.cos(endAngle), y3 = cy + r * Math.sin(endAngle);
    const x4 = cx + innerR * Math.cos(endAngle), y4 = cy + innerR * Math.sin(endAngle);
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const d = `M${x1},${y1} L${x2},${y2} A${r},${r} 0 0,1 ${x3},${y3} L${x4},${y4} A${innerR},${innerR} 0 0,0 ${x1},${y1}Z`;
    path.setAttribute('d', d);
    path.setAttribute('fill', dir.azimuth === 180 ? 'rgba(245,158,11,0.35)' : 'rgba(51,65,85,0.5)');
    path.setAttribute('stroke', '#475569');
    path.setAttribute('stroke-width', '1');
    path.setAttribute('data-az', dir.azimuth);
    path.style.cursor = 'pointer';
    path.style.transition = 'fill 0.2s';
    path.addEventListener('click', () => selectDirection(dir));
    path.addEventListener('mouseenter', () => { if (window.state.azimuth !== dir.azimuth) path.setAttribute('fill', 'rgba(245,158,11,0.15)'); });
    path.addEventListener('mouseleave', () => { if (window.state.azimuth !== dir.azimuth) path.setAttribute('fill', 'rgba(51,65,85,0.5)'); });
    path.id = `compass-seg-${dir.azimuth}`;
    g.appendChild(path);
  });
}

function selectDirection(dir) {
  window.state.azimuth = dir.azimuth;
  window.state.azimuthCoeff = dir.coeff;
  window.state.azimuthName = dir.name;
  COMPASS_DIRS.forEach(d => {
    const el = document.getElementById(`compass-seg-${d.azimuth}`);
    if (el) el.setAttribute('fill', d.azimuth === dir.azimuth ? 'rgba(245,158,11,0.35)' : 'rgba(51,65,85,0.5)');
  });
  document.getElementById('dir-name').textContent = dir.name;
  document.getElementById('dir-coeff').textContent = dir.coeff.toFixed(2);
  const badge = document.querySelector('.optimal-badge');
  badge.style.display = dir.azimuth === 180 ? 'inline' : 'none';
  updatePanelPreview();
}

// ═══════════════════════════════════════════════════════════
// PANEL CARDS
// ═══════════════════════════════════════════════════════════
function buildPanelCards() {
  const wrap = document.getElementById('panel-cards-wrap');
  wrap.innerHTML = '';
  Object.entries(PANEL_TYPES).forEach(([key, p]) => {
    const card = document.createElement('div');
    card.className = 'panel-card' + (key === window.state.panelType ? ' selected' : '');
    card.id = `panel-card-${key}`;
    card.innerHTML = `
      <div class="panel-check">✓</div>
      <div class="panel-card-title">${p.name}</div>
      <div class="panel-card-eff">${(p.efficiency * 100).toFixed(1)}%</div>
      <div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px">Verimlilik</div>
      <div class="panel-card-stats">
        <div class="panel-stat"><span class="panel-stat-label">Güç</span><span>${p.wattPeak} Wp</span></div>
        <div class="panel-stat"><span class="panel-stat-label">Sıcaklık Katsayısı</span><span>${(p.tempCoeff*100).toFixed(2)}%/°C</span></div>
        <div class="panel-stat"><span class="panel-stat-label">Yıllık Bozulma</span><span>${(p.degradation*100).toFixed(1)}%</span></div>
        <div class="panel-stat"><span class="panel-stat-label">Fiyat</span><span>${p.pricePerWatt.toFixed(1)} TL/W</span></div>
        <div class="panel-stat"><span class="panel-stat-label">Garanti</span><span>${p.warranty} yıl</span></div>
      </div>`;
    card.addEventListener('click', () => {
      window.state.panelType = key;
      document.querySelectorAll('.panel-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      updatePanelPreview();
    });
    wrap.appendChild(card);
  });
}

function updatePanelPreview() {
  const panel = PANEL_TYPES[window.state.panelType];
  const panelArea = panel.width * panel.height;

  const primaryArea = parseFloat(document.getElementById('roof-area')?.value) || window.state.roofArea || 80;
  let totalPanelCount = Math.floor(primaryArea * 0.75 / panelArea);

  if (window.state.multiRoof) {
    window.state.roofSections.forEach(sec => {
      const areaEl = document.getElementById(`sec-area-${sec.id}`);
      const secArea = areaEl ? (parseFloat(areaEl.value) || sec.area) : sec.area;
      totalPanelCount += Math.floor(secArea * 0.75 / panelArea);
    });
  }

  const systemPower = (totalPanelCount * panel.wattPeak / 1000).toFixed(2);
  const cost = totalPanelCount * panel.wattPeak * panel.pricePerWatt;

  document.getElementById('prev-count').textContent = totalPanelCount;
  document.getElementById('prev-power').textContent = systemPower;
  document.getElementById('prev-area').textContent = (totalPanelCount * panelArea).toFixed(1);
  document.getElementById('prev-cost').textContent = Math.round(cost).toLocaleString('tr-TR');

  const preview = document.getElementById('panel-count-preview');
  if (preview) preview.textContent = totalPanelCount > 0 ? `≈ ${totalPanelCount} panel sığar (${systemPower} kWp)` : '';
}

// ═══════════════════════════════════════════════════════════
// STEP NAVIGATION
// ═══════════════════════════════════════════════════════════
function goToStep(n) {
  const state = window.state;
  if (n < 1 || n > 5) return;
  if (n === state.step) return;
  const fromEl = document.getElementById(`step-${state.step}`);
  const toEl = document.getElementById(`step-${n}`);
  if (!fromEl || !toEl) return;
  fromEl.classList.remove('active');
  state.step = n;
  if (n === 1) {
    resetConfetti();
    if (map) setTimeout(() => map.invalidateSize(), 50);
  }
  if (n === 5) {
    setTimeout(() => {
      if (window.renderHourlyProfile) window.renderHourlyProfile();
      if (window.renderSunPath) window.renderSunPath();
      if (window.showHeatmapCard) window.showHeatmapCard();
      if (window.renderScenarioAnalysis) window.renderScenarioAnalysis();
    }, 600);
  }
  toEl.classList.add('active');
  updateProgressBar();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateProgressBar() {
  const state = window.state;
  document.querySelectorAll('.step-dot').forEach(el => {
    const s = parseInt(el.dataset.step);
    el.classList.remove('active','done');
    if (s === state.step) el.classList.add('active');
    else if (s < state.step) el.classList.add('done');
  });
  for (let i = 1; i <= 4; i++) {
    const conn = document.getElementById(`conn-${i}-${i+1}`);
    if (conn) conn.classList.toggle('filled', i < state.step);
  }
}

function validateStep1() {
  const state = window.state;
  if (!state.lat || !state.lon) {
    showToast('Lütfen bir konum seçin.', 'error'); return;
  }
  if (!isInTurkey(state.lat, state.lon)) {
    showToast('Lütfen Türkiye sınırları içinde bir konum seçin.', 'error'); return;
  }
  goToStep(2);
}

function validateStep2() {
  const state = window.state;
  const area = parseFloat(document.getElementById('roof-area').value);
  if (!area || area < 10 || area > 2000) {
    document.getElementById('roof-area').classList.add('error');
    document.getElementById('roof-area-err').style.display = 'block';
    return;
  }
  document.getElementById('roof-area').classList.remove('error');
  document.getElementById('roof-area-err').style.display = 'none';
  state.roofArea = area;

  if (state.multiRoof) {
    for (let i = 0; i < state.roofSections.length; i++) {
      const sec = state.roofSections[i];
      const areaEl = document.getElementById(`sec-area-${sec.id}`);
      if (areaEl) {
        const secArea = parseFloat(areaEl.value);
        if (!secArea || secArea < 5 || secArea > 500) {
          showToast(`${i + 2}. yüzey alanı geçersiz (5–500 m² olmalı).`, 'error'); return;
        }
        sec.area = secArea;
      }
    }
  }

  goToStep(3);
  updatePanelPreview();
  buildInverterCards();
}

function validateStep3() {
  // Tarife güncellemesi
  const tariffInput = document.getElementById('tariff-input');
  if (tariffInput) window.state.tariff = parseFloat(tariffInput.value) || 7.16;
  updateTariffAssumptions();
  updateCostOverrides();
  goToStep(4);
  runCalculation();
}

// ═══════════════════════════════════════════════════════════
// ÇOKLU ÇATI
// ═══════════════════════════════════════════════════════════
function toggleMultiRoof(checked) {
  window.state.multiRoof = checked;
  const extra = document.getElementById('roof-sections-extra');
  if (extra) extra.style.display = checked ? 'block' : 'none';
  if (!checked) {
    window.state.roofSections = [];
    renderRoofSections();
  }
  updatePanelPreview();
}

function addRoofSection() {
  if (window.state.roofSections.length >= 2) {
    showToast('Maksimum 3 çatı yüzeyi eklenebilir (1 ana + 2 ek).', 'warning'); return;
  }
  const id = Date.now();
  window.state.roofSections.push({ id, area: 30, tilt: 20, azimuth: 90, azimuthCoeff: 0.85, azimuthName: 'Doğu', shadingFactor: 10 });
  renderRoofSections();
  updatePanelPreview();
  const btn = document.getElementById('add-roof-btn');
  if (btn) btn.style.display = window.state.roofSections.length >= 2 ? 'none' : '';
}

function removeRoofSection(id) {
  window.state.roofSections = window.state.roofSections.filter(s => s.id !== id);
  renderRoofSections();
  updatePanelPreview();
  const btn = document.getElementById('add-roof-btn');
  if (btn) btn.style.display = window.state.roofSections.length >= 2 ? 'none' : '';
}

function renderRoofSections() {
  const list = document.getElementById('roof-sections-list');
  if (!list) return;
  list.innerHTML = '';
  window.state.roofSections.forEach((sec, idx) => {
    const secNum = idx + 2;
    const dirOpts = COMPASS_DIRS.map(d =>
      `<option value="${d.azimuth}" data-coeff="${d.coeff}" data-name="${d.name}"${sec.azimuth === d.azimuth ? ' selected' : ''}>${d.name}</option>`
    ).join('');
    const div = document.createElement('div');
    div.className = 'roof-section-form';
    div.id = `sec-form-${sec.id}`;
    div.innerHTML = `
      <div class="roof-section-header">
        <span>${secNum}. Çatı Yüzeyi</span>
        <button class="remove-section-btn" onclick="removeRoofSection(${sec.id})">✕ Kaldır</button>
      </div>
      <div class="roof-section-grid">
        <div class="form-group" style="margin:0">
          <label style="font-size:0.8rem">Alan (m²)</label>
          <input type="number" id="sec-area-${sec.id}" value="${sec.area}" min="5" max="500"
            style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:8px 12px;color:var(--text);width:100%;font-size:0.9rem"
            oninput="updateSecArea(${sec.id},this.value)"/>
        </div>
        <div class="form-group" style="margin:0">
          <label style="font-size:0.8rem">Yön</label>
          <select id="sec-dir-${sec.id}" onchange="updateSecDir(${sec.id},this)"
            style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:8px 12px;color:var(--text);width:100%;font-size:0.9rem">
            ${dirOpts}
          </select>
        </div>
        <div class="form-group" style="margin:0">
          <label style="font-size:0.8rem">Eğim (°)</label>
          <input type="number" id="sec-tilt-${sec.id}" value="${sec.tilt}" min="0" max="90"
            style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:8px 12px;color:var(--text);width:100%;font-size:0.9rem"
            oninput="updateSecTilt(${sec.id},this.value)"/>
        </div>
        <div class="form-group" style="margin:0">
          <label style="font-size:0.8rem">Gölgelenme (%)</label>
          <input type="number" id="sec-shade-${sec.id}" value="${sec.shadingFactor}" min="0" max="50"
            style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:8px 12px;color:var(--text);width:100%;font-size:0.9rem"
            oninput="updateSecShade(${sec.id},this.value)"/>
        </div>
      </div>`;
    list.appendChild(div);
  });
}

function updateSecArea(id, val) {
  const sec = window.state.roofSections.find(s => s.id === id);
  if (sec) { sec.area = parseFloat(val) || sec.area; updatePanelPreview(); }
}
function updateSecDir(id, sel) {
  const sec = window.state.roofSections.find(s => s.id === id);
  if (sec) {
    const opt = sel.options[sel.selectedIndex];
    sec.azimuth = parseInt(sel.value);
    sec.azimuthCoeff = parseFloat(opt.dataset.coeff);
    sec.azimuthName = opt.dataset.name;
  }
}
function updateSecTilt(id, val) {
  const sec = window.state.roofSections.find(s => s.id === id);
  if (sec) sec.tilt = parseInt(val) || 0;
}
function updateSecShade(id, val) {
  const sec = window.state.roofSections.find(s => s.id === id);
  if (sec) sec.shadingFactor = Math.max(0, Math.min(50, parseInt(val) || 0));
}

// ═══════════════════════════════════════════════════════════
// GÜNLÜK TÜKETİM
// ═══════════════════════════════════════════════════════════
function updateConsumption(val) {
  window.state.dailyConsumption = parseInt(val) || 20;
  const el = document.getElementById('consumption-val');
  if (el) el.textContent = val + ' kWh/gün';
  const desc = document.getElementById('consumption-desc');
  if (desc) {
    const monthly = Math.round(val * 30);
    desc.textContent = `Yaklaşık ${monthly} kWh/ay`;
  }
}

// ═══════════════════════════════════════════════════════════
// BATARYA (BESS)
// ═══════════════════════════════════════════════════════════
function toggleBatteryBlock() {
  const tog = document.getElementById('battery-toggle');
  if (tog) { tog.checked = !tog.checked; onBatteryToggle(tog.checked); }
}

function onBatteryToggle(checked) {
  window.state.batteryEnabled = checked;
  const inputs = document.getElementById('battery-inputs');
  if (inputs) inputs.style.display = checked ? 'block' : 'none';
  if (checked && !document.getElementById('bat-models-wrap').innerHTML) {
    renderBatteryModels();
  }
}

function renderBatteryModels() {
  const wrap = document.getElementById('bat-models-wrap');
  if (!wrap) return;
  wrap.innerHTML = Object.entries(BATTERY_MODELS).map(([key, m]) => `
    <button class="bat-model-btn${window.state.battery.model === key ? ' selected' : ''}" onclick="selectBatteryModel('${key}')">
      <div style="font-weight:600;font-size:0.85rem">${m.name}</div>
      <div style="font-size:0.75rem;color:var(--text-muted)">${m.spec}</div>
    </button>`).join('');
}

function selectBatteryModel(key) {
  const m = BATTERY_MODELS[key];
  window.state.battery = { ...m, model: key };
  document.querySelectorAll('.bat-model-btn').forEach(b => b.classList.remove('selected'));
  const btn = document.querySelector(`[onclick="selectBatteryModel('${key}')"]`);
  if (btn) btn.classList.add('selected');
  const capEl = document.getElementById('bat-capacity');
  const dodEl = document.getElementById('bat-dod');
  const effEl = document.getElementById('bat-eff');
  if (capEl && key !== 'custom') capEl.value = m.capacity;
  if (dodEl && key !== 'custom') dodEl.value = Math.round(m.dod * 100);
  if (effEl && key !== 'custom') effEl.value = Math.round(m.efficiency * 100);
}

function updateBatCapacity(val) {
  window.state.battery.capacity = parseFloat(val) || 9.6;
  const el = document.getElementById('bat-cap-val');
  if (el) el.textContent = val + ' kWh';
}
function updateBatDod(val) {
  window.state.battery.dod = parseInt(val) / 100;
  const el = document.getElementById('bat-dod-val');
  if (el) el.textContent = val + '%';
}
function updateBatEff(val) {
  window.state.battery.efficiency = parseInt(val) / 100;
  const el = document.getElementById('bat-eff-val');
  if (el) el.textContent = val + '%';
}

// ═══════════════════════════════════════════════════════════
// NET METERING
// ═══════════════════════════════════════════════════════════
function toggleNMBlock() {
  const tog = document.getElementById('nm-toggle');
  if (tog) { tog.checked = !tog.checked; onNMToggle(tog.checked); }
}

function onNMToggle(checked) {
  window.state.netMeteringEnabled = checked;
  const inputs = document.getElementById('nm-inputs');
  if (inputs) inputs.style.display = checked ? 'block' : 'none';
}

function toggleOMBlock() {
  const tog = document.getElementById('om-toggle');
  if (tog) { tog.checked = !tog.checked; onOMToggle(tog.checked); }
}

function onOMToggle(checked) {
  window.state.omEnabled = checked;
  const inputs = document.getElementById('om-inputs');
  if (inputs) inputs.style.display = checked ? 'block' : 'none';
}

function toggleCostOverridesBlock() {
  const tog = document.getElementById('cost-toggle');
  if (tog) { tog.checked = !tog.checked; onCostOverridesToggle(tog.checked); }
}

function onCostOverridesToggle(checked) {
  window.state.costOverridesEnabled = checked;
  const block = document.getElementById('cost-overrides-block');
  if (block) block.style.display = checked ? 'block' : 'none';
}

function updateCostOverrides() {
  const read = (id, fallback) => parseFloat(document.getElementById(id)?.value) || fallback;
  window.state.costOverrides = {
    panelPricePerWatt: read('cost-panel-watt', 0),
    inverterPerKwp: read('cost-inverter-kwp', 0),
    mountingPerKwp: read('cost-mounting-kwp', 0),
    dcCablePerKwp: read('cost-dc-kwp', 0),
    acElecPerKwp: read('cost-ac-kwp', 0),
    laborPerKwp: read('cost-labor-kwp', 0),
    permitFixed: read('cost-permit-fixed', 0),
    kdvRate: read('cost-kdv-rate', 20) / 100
  };
}

// ═══════════════════════════════════════════════════════════
// PWA
// ═══════════════════════════════════════════════════════════
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js').catch(() => {});
}

window.addEventListener('load', () => {
  updateTilt(33);
  updateShading(10);
  setTimeout(() => {
    positionRangeThumb('tilt-slider','tilt-val',0,90);
    positionRangeThumb('shading-slider','shading-val',0,50);
  }, 100);
});

// ═══════════════════════════════════════════════════════════
// WINDOW EXPOSE — HTML onclick için
// ═══════════════════════════════════════════════════════════
window.goToStep = goToStep;
window.validateStep1 = validateStep1;
window.validateStep2 = validateStep2;
window.validateStep3 = validateStep3;
window.updateTilt = updateTilt;
window.updateShading = updateShading;
window.updateSoiling = updateSoiling;
window.updateTariffType = updateTariffType;
window.updateTariffAssumptions = updateTariffAssumptions;
window.updateConsumption = updateConsumption;
window.positionRangeThumb = positionRangeThumb;
window.buildCompass = buildCompass;
window.selectDirection = selectDirection;
window.buildPanelCards = buildPanelCards;
window.updatePanelPreview = updatePanelPreview;
window.toggleMultiRoof = toggleMultiRoof;
window.addRoofSection = addRoofSection;
window.removeRoofSection = removeRoofSection;
window.renderRoofSections = renderRoofSections;
window.updateSecArea = updateSecArea;
window.updateSecDir = updateSecDir;
window.updateSecTilt = updateSecTilt;
window.updateSecShade = updateSecShade;
window.toggleBatteryBlock = toggleBatteryBlock;
window.onBatteryToggle = onBatteryToggle;
window.renderBatteryModels = renderBatteryModels;
window.selectBatteryModel = selectBatteryModel;
window.updateBatCapacity = updateBatCapacity;
window.updateBatDod = updateBatDod;
window.updateBatEff = updateBatEff;
window.toggleNMBlock = toggleNMBlock;
window.onNMToggle = onNMToggle;
window.toggleOMBlock = toggleOMBlock;
window.onOMToggle = onOMToggle;
window.toggleCostOverridesBlock = toggleCostOverridesBlock;
window.onCostOverridesToggle = onCostOverridesToggle;
window.updateCostOverrides = updateCostOverrides;
window.selectCity = selectCity;
window.useGeolocation = useGeolocation;
window.isInTurkey = isInTurkey;
