import { solarPosition } from './sun-path.js';

function toRad(deg) { return deg * Math.PI / 180; }
function toDeg(rad) { return rad * 180 / Math.PI; }
function normDeg(deg) { return ((deg % 360) + 360) % 360; }
function angleDiff(a, b) {
  const d = Math.abs(normDeg(a) - normDeg(b));
  return Math.min(d, 360 - d);
}
function haversine(a, b) {
  const R = 6371008.8;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat), lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function bearing(a, b) {
  const lat1 = toRad(a.lat), lat2 = toRad(b.lat);
  const dLon = toRad(b.lng - a.lng);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return normDeg(toDeg(Math.atan2(y, x)));
}

export function estimateGlareRisk({ sunAzimuth, sunElevation, panelAzimuth, panelTilt, targetBearing, targetDistanceM }) {
  if (sunElevation <= 0 || targetDistanceM <= 0) return 0;
  const reflectedAzimuth = normDeg(2 * panelAzimuth - sunAzimuth);
  const reflectedElevation = Math.max(0, sunElevation - Math.max(0, panelTilt - 10) * 0.25);
  const azScore = Math.max(0, 1 - angleDiff(reflectedAzimuth, targetBearing) / 35);
  const elevScore = Math.max(0, 1 - Math.abs(reflectedElevation - 8) / 28);
  const distanceScore = Math.max(0.15, Math.min(1, 600 / Math.max(80, targetDistanceM)));
  return Math.min(100, azScore * elevScore * distanceScore * 100);
}

export function simulateGlareTimeline({ roof, targets, lat, lon, panelAzimuth, panelTilt, date = new Date() }) {
  const center = roof?.centroid || (lat && lon ? { lat, lng: lon } : null);
  if (!center || !targets?.length) return { riskScore: 0, riskyHours: [], rows: [] };
  const rows = [];
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  // 15 dakika aralıklı tarama (daha hassas sonuç)
  for (let hour = 5; hour <= 20; hour++) {
    for (let min = 0; min < 60; min += 15) {
      const dt = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, min);
      const sun = solarPosition(lat || center.lat, lon || center.lng, dt);
      targets.forEach(target => {
        const dist = haversine(center, target);
        const targetBearing = bearing(center, target);
        const score = estimateGlareRisk({
          sunAzimuth: sun.azimuth,
          sunElevation: sun.elevation,
          panelAzimuth,
          panelTilt,
          targetBearing,
          targetDistanceM: dist
        });
        rows.push({
          hour,
          minute: min,
          timeLabel: `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`,
          targetName: target.name || 'Gözlem Noktası',
          score,
          sun,
          targetBearing,
          distanceM: dist
        });
      });
    }
  }
  const riskyHours = rows.filter(r => r.score >= 35);
  const riskScore = rows.length ? Math.max(...rows.map(r => r.score)) : 0;
  return { riskScore, riskyHours, rows };
}

function drawTargets(targets) {
  if (!window.map || !window.L) return;
  if (!window.glareLayer) window.glareLayer = L.layerGroup().addTo(window.map);
  window.glareLayer.clearLayers();
  targets.forEach((t, i) => {
    const icon = L.divIcon({
      html: `<div style="
        width:24px;height:24px;
        background:#EF4444;border:2px solid #fff;border-radius:50%;
        display:flex;align-items:center;justify-content:center;
        font-size:11px;font-weight:700;color:#fff;
        box-shadow:0 2px 6px rgba(0,0,0,0.5);
        font-family:'Inter',sans-serif;">${i + 1}</div>`,
      className: '',
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
    L.marker([t.lat, t.lng], { icon })
      .bindPopup(`<div style="font-family:'Inter',sans-serif;min-width:150px">
        <strong>${t.name || `Gözlem Noktası ${i + 1}`}</strong><br>
        <span style="font-size:0.8rem;color:#666">${t.lat.toFixed(5)}, ${t.lng.toFixed(5)}</span><br>
        <button onclick="removeGlareTarget(${i})" style="margin-top:6px;padding:3px 8px;font-size:0.75rem;cursor:pointer;border:1px solid #ccc;border-radius:4px;background:#fff">Sil</button>
      </div>`, { maxWidth: 200 })
      .addTo(window.glareLayer);
  });
}

function scoreColor(score) {
  if (score >= 65) return '#EF4444';
  if (score >= 40) return '#F97316';
  if (score >= 20) return '#F59E0B';
  if (score > 0)   return '#22C55E';
  return '#334155';
}

function renderGlare(result) {
  const el = document.getElementById('glare-summary');
  if (!el) return;

  if (!result.rows.length) {
    el.innerHTML = `<div style="color:var(--text-muted);font-size:0.82rem">Gözlem noktası yok. Haritadan nokta ekleyin.</div>`;
    return;
  }

  const color = result.riskScore >= 55 ? '#EF4444' : result.riskScore >= 25 ? '#F59E0B' : '#10B981';
  const riskLabel = result.riskScore >= 55 ? 'Yüksek' : result.riskScore >= 25 ? 'Orta' : 'Düşük';

  // Saat bazlı max skor (her saat için)
  const hourScores = {};
  result.rows.forEach(r => {
    if (!hourScores[r.hour] || r.score > hourScores[r.hour]) {
      hourScores[r.hour] = r.score;
    }
  });

  // Bar chart — saat bazlı
  const bars = Object.entries(hourScores)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([hour, score]) => {
      const h = Math.max(4, (score / 100) * 40);
      const c = scoreColor(score);
      return `<div style="display:flex;flex-direction:column;align-items:center;gap:2px">
        <div style="width:14px;height:${h}px;background:${c};border-radius:3px 3px 0 0;transition:height 0.3s" title="${hour}:00 — ${score.toFixed(0)}"></div>
        <div style="font-size:0.62rem;color:var(--text-muted)">${hour}</div>
      </div>`;
    }).join('');

  // Riskli saatler listesi
  const riskyList = result.riskyHours.length
    ? [...new Set(result.riskyHours.map(r => `${r.timeLabel} ${r.targetName}`))].slice(0, 8).join(' · ')
    : 'Belirgin risk saati tespit edilmedi';

  // Hedef listesi
  const targets = window.state?.glareTargets || [];
  const targetList = targets.map((t, i) =>
    `<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;border-bottom:1px solid var(--border-subtle)">
      <span><strong>${i + 1}.</strong> ${t.name || 'Gözlem Noktası'}</span>
      <span style="font-size:0.76rem;color:var(--text-muted)">${t.lat.toFixed(4)}, ${t.lng.toFixed(4)}</span>
    </div>`
  ).join('');

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 12px;margin-bottom:10px;font-size:0.82rem">
      <div><span style="color:var(--text-muted)">Risk:</span> <strong style="color:${color}">${riskLabel} (${result.riskScore.toFixed(0)}/100)</strong></div>
      <div><span style="color:var(--text-muted)">Riskli slot:</span> <strong style="color:var(--text)">${result.riskyHours.length}</strong></div>
      <div><span style="color:var(--text-muted)">Gözlem noktası:</span> <strong style="color:var(--text)">${targets.length}</strong></div>
    </div>
    <div style="display:flex;gap:3px;align-items:flex-end;height:50px;margin-bottom:4px;padding:0 2px">
      ${bars}
    </div>
    <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:8px">Saat (05–20)</div>
    <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:8px">
      <strong>Riskli saatler:</strong> ${riskyList}
    </div>
    ${targets.length ? `<div style="font-size:0.78rem;margin-bottom:4px"><strong>Gözlem noktaları:</strong></div>${targetList}` : ''}
    <div style="font-size:0.72rem;color:var(--text-muted);margin-top:8px;border-top:1px solid var(--border-subtle);padding-top:6px">
      Mühendislik ön tahmin modeli (15 dk aralıklı) · Kesin havalimanı/yol glare etüdü yerine geçmez.
    </div>
  `;
}

export function runGlareAnalysis() {
  const state = window.state;
  const targets = state.glareTargets || [];
  const result = simulateGlareTimeline({
    roof: state.roofGeometry,
    targets,
    lat: state.lat,
    lon: state.lon,
    panelAzimuth: state.azimuth || 180,
    panelTilt: state.tilt || 30
  });
  state.glareAnalysis = result;
  renderGlare(result);
  if (window.map && window.L) {
    if (!window.glareLayer) window.glareLayer = L.layerGroup().addTo(window.map);
    drawTargets(targets);
  }
  return result;
}

export function addGlareTargetFromMap() {
  if (!window.map) return;
  if (window._glarePickMode) {
    // İkinci kez tıklandıysa iptal et
    window._glarePickMode = false;
    window.showToast?.('Gözlem noktası ekleme iptal edildi.', 'info');
    return;
  }
  window._glarePickMode = true;
  window.showToast?.('Haritada bir gözlem noktası seçin. İptal için tekrar butona tıklayın.', 'info');
  // Cursor değişimi — harita üzerinde crosshair
  const container = window.map.getContainer();
  const prevCursor = container.style.cursor;
  container.style.cursor = 'crosshair';

  window.map.once('click', e => {
    window._glarePickMode = false;
    container.style.cursor = prevCursor;
    const targets = window.state.glareTargets || [];
    targets.push({ lat: e.latlng.lat, lng: e.latlng.lng, name: `Nokta ${targets.length + 1}` });
    window.state.glareTargets = targets;
    runGlareAnalysis();
    window.showToast?.(`Gözlem noktası ${targets.length} eklendi.`, 'success');
  });
}

export function removeGlareTarget(index) {
  const targets = window.state.glareTargets || [];
  targets.splice(index, 1);
  window.state.glareTargets = targets;
  // Popup kapat
  window.map?.closePopup?.();
  runGlareAnalysis();
}

export function clearGlareTargets() {
  window._glarePickMode = false;
  window.state.glareTargets = [];
  if (window.glareLayer) window.glareLayer.clearLayers();
  runGlareAnalysis();
  window.showToast?.('Tüm gözlem noktaları temizlendi.', 'info');
}

if (typeof window !== 'undefined') {
  window.runGlareAnalysis = runGlareAnalysis;
  window.addGlareTargetFromMap = addGlareTargetFromMap;
  window.removeGlareTarget = removeGlareTarget;
  window.clearGlareTargets = clearGlareTargets;
}
