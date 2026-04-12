// ═══════════════════════════════════════════════════════════
// SUN PATH — Güneş Yolu Diyagramı (Faz C4)
// GüneşHesap v2.0 — Solar Position Algorithm (SPA)
// ═══════════════════════════════════════════════════════════

function toRad(deg) { return deg * Math.PI / 180; }
function toDeg(rad) { return rad * 180 / Math.PI; }

function getDayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date - start;
  return Math.floor(diff / 86400000);
}

export function solarPosition(lat, lon, dateTime) {
  const dayOfYear = getDayOfYear(dateTime);
  const declination = 23.45 * Math.sin(toRad(360 / 365 * (dayOfYear - 81)));
  const solarNoon = 12 - (lon - 30) / 15; // UTC+3
  const hourAngle = 15 * (dateTime.getHours() + dateTime.getMinutes() / 60 - solarNoon);

  const elevation = Math.asin(
    Math.sin(toRad(lat)) * Math.sin(toRad(declination)) +
    Math.cos(toRad(lat)) * Math.cos(toRad(declination)) * Math.cos(toRad(hourAngle))
  );

  const azimuthRad = Math.atan2(
    -Math.sin(toRad(hourAngle)),
    Math.tan(toRad(declination)) * Math.cos(toRad(lat)) - Math.sin(toRad(lat)) * Math.cos(toRad(hourAngle))
  );

  return {
    elevation: toDeg(elevation),
    azimuth: toDeg(azimuthRad) + 180
  };
}

export function renderSunPath() {
  const state = window.state;
  const card = document.getElementById('sun-path-card');
  if (!card) return;

  const lat = state.lat;
  const lon = state.lon;
  if (!lat || !lon) return;

  card.style.display = 'block';

  const svg = document.getElementById('sun-path-svg');
  if (!svg) return;

  const W = 400, H = 400;
  const cx = W / 2, cy = H / 2;
  const R = 170;

  svg.innerHTML = '';
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

  // ─── Arka plan ────────────────────────────────────────────────────────────
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  bg.setAttribute('cx', cx); bg.setAttribute('cy', cy);
  bg.setAttribute('r', R + 5);
  bg.setAttribute('fill', 'rgba(15,23,42,0.8)');
  bg.setAttribute('stroke', 'rgba(71,85,105,0.4)');
  bg.setAttribute('stroke-width', '1');
  svg.appendChild(bg);

  // ─── Elevasyonel daireler ─────────────────────────────────────────────────
  [0, 20, 40, 60, 80].forEach(elev => {
    const r = R * (1 - elev / 90);
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', cx); circle.setAttribute('cy', cy);
    circle.setAttribute('r', r);
    circle.setAttribute('fill', 'none');
    circle.setAttribute('stroke', 'rgba(71,85,105,0.3)');
    circle.setAttribute('stroke-width', '0.5');
    svg.appendChild(circle);

    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', cx + 3);
    label.setAttribute('y', cy - r + 10);
    label.setAttribute('fill', 'rgba(148,163,184,0.6)');
    label.setAttribute('font-size', '9');
    label.textContent = elev + '°';
    svg.appendChild(label);
  });

  // ─── Yön etiketleri ───────────────────────────────────────────────────────
  const dirs = [['K', 0], ['KD', 45], ['D', 90], ['GD', 135], ['G', 180], ['GB', 225], ['B', 270], ['KB', 315]];
  dirs.forEach(([label, azDeg]) => {
    const rad = toRad(azDeg - 90);
    const px = cx + (R + 15) * Math.cos(rad);
    const py = cy + (R + 15) * Math.sin(rad);
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', px); text.setAttribute('y', py + 4);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('fill', label === 'G' ? '#F59E0B' : 'rgba(148,163,184,0.8)');
    text.setAttribute('font-size', label.length > 1 ? '8' : '10');
    text.setAttribute('font-weight', '600');
    text.textContent = label;
    svg.appendChild(text);
  });

  // ─── 12 ay için güneş yolu çizgileri ─────────────────────────────────────
  const monthColors = [
    '#3B82F6','#6366F1','#8B5CF6','#A855F7','#EC4899','#EF4444',
    '#F97316','#F59E0B','#EAB308','#22C55E','#14B8A6','#06B6D4'
  ];
  const year = new Date().getFullYear();

  for (let month = 0; month < 12; month++) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    let d = '';
    let first = true;
    const isKeyMonth = month === 5 || month === 11; // Haziran / Aralık

    for (let hour = 4; hour <= 21; hour += 0.5) {
      const h = Math.floor(hour);
      const m = (hour % 1) * 60;
      const dt = new Date(year, month, 21, h, m);
      const pos = solarPosition(lat, lon, dt);
      if (pos.elevation < 0) continue;

      const r = R * (1 - pos.elevation / 90);
      const azRad = toRad(pos.azimuth - 90);
      const px = cx + r * Math.cos(azRad);
      const py = cy + r * Math.sin(azRad);

      if (first) { d += `M${px.toFixed(1)},${py.toFixed(1)}`; first = false; }
      else d += ` L${px.toFixed(1)},${py.toFixed(1)}`;
    }

    if (d) {
      path.setAttribute('d', d);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', monthColors[month]);
      path.setAttribute('stroke-width', isKeyMonth ? '2.5' : '1');
      path.setAttribute('opacity', isKeyMonth ? '0.9' : '0.5');
      svg.appendChild(path);
    }
  }

  // ─── Bugünkü güneş pozisyonu ───────────────────────────────────────────────
  const now = new Date();
  const curPos = solarPosition(lat, lon, now);
  if (curPos.elevation > 0) {
    const r = R * (1 - curPos.elevation / 90);
    const azRad = toRad(curPos.azimuth - 90);
    const px = cx + r * Math.cos(azRad);
    const py = cy + r * Math.sin(azRad);

    const sun = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    sun.setAttribute('cx', px); sun.setAttribute('cy', py);
    sun.setAttribute('r', '6');
    sun.setAttribute('fill', '#F59E0B');
    sun.setAttribute('stroke', '#FCD34D');
    sun.setAttribute('stroke-width', '2');
    svg.appendChild(sun);
  }

  // ─── Çatı yön oku ─────────────────────────────────────────────────────────
  const roofAz = state.azimuth || 180;
  const roofRad = toRad(roofAz - 90);
  const rx = cx + R * 0.65 * Math.cos(roofRad);
  const ry = cy + R * 0.65 * Math.sin(roofRad);

  const roofArrow = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  roofArrow.setAttribute('x1', cx); roofArrow.setAttribute('y1', cy);
  roofArrow.setAttribute('x2', rx); roofArrow.setAttribute('y2', ry);
  roofArrow.setAttribute('stroke', '#F59E0B');
  roofArrow.setAttribute('stroke-width', '2');
  roofArrow.setAttribute('stroke-dasharray', '5,3');
  svg.appendChild(roofArrow);

  // Güncelleme bilgisi
  const infoEl = document.getElementById('sun-path-info');
  if (infoEl) {
    infoEl.textContent = `${state.cityName || ''} — El: ${curPos.elevation.toFixed(1)}° | Az: ${curPos.azimuth.toFixed(1)}° | ${now.toLocaleTimeString('tr-TR', {hour:'2-digit',minute:'2-digit'})}`;
  }
}

// window'a expose et
window.renderSunPath = renderSunPath;
window.solarPosition = solarPosition;
