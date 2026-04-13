import { convertTry } from './exchange-rate.js';

export const DEFAULT_BOM_FIXTURE = './fixtures/bom-suppliers.json';

function parseCsv(text) {
  const lines = String(text || '').split(/\r?\n/).filter(Boolean);
  const headers = lines.shift()?.split(',').map(h => h.trim()) || [];
  return lines.map(line => {
    const cols = line.split(',').map(c => c.trim());
    return Object.fromEntries(headers.map((h, i) => [h, cols[i] ?? '']));
  });
}

export function normalizeBomItems(rawItems = []) {
  return rawItems.map(item => ({
    id: item.id || `${item.category}-${item.supplier}-${item.name}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    category: item.category,
    supplier: item.supplier || 'Local',
    name: item.name,
    unit: item.unit || 'fixed',
    unitCost: Number(item.unitCost ?? item.unit_cost ?? item.price) || 0,
    currency: item.currency || 'TRY',
    url: item.url || ''
  })).filter(item => item.category && item.name && item.unitCost >= 0);
}

export function selectBomItems(items, selection = {}) {
  const grouped = {};
  normalizeBomItems(items).forEach(item => {
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category].push(item);
  });
  return Object.fromEntries(Object.entries(grouped).map(([category, list]) => {
    const selectedId = selection[category];
    const found = list.find(item => item.id === selectedId) || list[0];
    return [category, found];
  }));
}

export function calculateBomTotal(selectedItems, quantities) {
  const rows = Object.entries(selectedItems || {}).map(([category, item]) => {
    const qty = Number(quantities[item.unit] ?? quantities[category] ?? 1) || 0;
    return {
      category,
      ...item,
      quantity: qty,
      total: qty * item.unitCost
    };
  });
  return {
    rows,
    subtotal: rows.reduce((s, row) => s + row.total, 0)
  };
}

export async function loadBomFixture(url = DEFAULT_BOM_FIXTURE) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`BOM verisi okunamadı: ${res.status}`);
  const text = await res.text();
  if (url.toLowerCase().endsWith('.csv')) return normalizeBomItems(parseCsv(text));
  const parsed = JSON.parse(text);
  return normalizeBomItems(parsed.items || parsed);
}

function quantitiesFromState(state) {
  const power = Math.max(0, Number(state.results?.systemPower ?? state.previewSystemPower ?? 0));
  return {
    wp: power * 1000,
    kwp: power,
    fixed: 1,
    meter: Math.max(20, power * 10),
    day: Math.max(1, Math.ceil(power / 5))
  };
}

function money(value) {
  const state = window.state || {};
  const currency = state.displayCurrency || 'TRY';
  const converted = convertTry(value, currency, state.usdToTry || 38.5);
  return (Number(converted) || 0).toLocaleString(currency === 'USD' ? 'en-US' : 'tr-TR', { maximumFractionDigits: 0 }) + ' ' + (currency === 'USD' ? 'USD' : 'TL');
}

const CATEGORY_LABELS = {
  panel: 'Panel', inverter: 'İnverter', battery: 'Batarya (BESS)',
  mounting: 'Montaj Sistemi', cable: 'Kablo & Konektör',
  monitoring: 'İzleme Sistemi', labor: 'İşçilik', other: 'Diğer (İzin/Proje)'
};

function escapeAttr(str) {
  return String(str).replace(/['"&<>]/g, c =>
    ({ "'": '&#39;', '"': '&quot;', '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] || c)
  );
}

function renderBom(filter = '') {
  const state = window.state;
  let items = normalizeBomItems(state.bomItems || []);
  const wrap = document.getElementById('bom-builder-body');
  if (!wrap) return;
  if (!items.length) {
    wrap.innerHTML = '<div style="font-size:0.82rem;color:var(--text-muted)">BOM verisi yüklenemedi. Sayfa yenilemeyi deneyin.</div>';
    return;
  }

  // Arama filtresi uygula
  const q = (filter || state._bomFilter || '').toLowerCase().trim();
  const filteredItems = q
    ? items.filter(item =>
        item.name.toLowerCase().includes(q) ||
        item.supplier.toLowerCase().includes(q) ||
        (CATEGORY_LABELS[item.category] || item.category).toLowerCase().includes(q)
      )
    : items;

  const categories = [...new Set(items.map(item => item.category))];
  const selection = state.bomSelection || {};
  const selected = selectBomItems(items, selection);
  const totals = calculateBomTotal(selected, quantitiesFromState(state));
  state.bomTotals = totals;
  state.costOverridesEnabled = true;
  state.costOverrides = {
    ...(state.costOverrides || {}),
    panelPricePerWatt: selected.panel?.unitCost || state.costOverrides?.panelPricePerWatt || 0,
    inverterPerKwp: selected.inverter?.unitCost || state.costOverrides?.inverterPerKwp || 0,
    mountingPerKwp: selected.mounting?.unitCost || state.costOverrides?.mountingPerKwp || 0,
    dcCablePerKwp: selected.cable?.unitCost || state.costOverrides?.dcCablePerKwp || 0,
    laborPerKwp: selected.labor?.unitCost || state.costOverrides?.laborPerKwp || 0,
    permitFixed: selected.other?.unitCost || state.costOverrides?.permitFixed || 0,
    kdvRate: state.costOverrides?.kdvRate ?? 0.20
  };

  // XSS güvenli: event delegation ile — inline onclick yok
  wrap.innerHTML = `
    <div style="margin-bottom:12px">
      <input type="text" id="bom-search" placeholder="Ürün veya tedarikçi ara..." value="${escapeAttr(q)}"
        style="width:100%;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:8px 12px;color:var(--text);font-size:0.85rem;box-sizing:border-box">
    </div>
    ${categories.map(category => {
      const label = CATEGORY_LABELS[category] || category;
      const catItems = filteredItems.filter(item => item.category === category);
      if (!catItems.length && q) return ''; // Filtreden geçen ürün yoksa kategoriyi gizle
      const allCatItems = items.filter(item => item.category === category);
      const displayItems = q ? catItems : allCatItems;
      const selItem = selected[category];
      const selUrl = selItem?.url || '';
      return `<div class="bom-category-group" style="margin-bottom:10px">
        <div style="font-size:0.78rem;font-weight:600;color:var(--text-muted);margin-bottom:4px;text-transform:uppercase;letter-spacing:0.05em">${escapeAttr(label)}</div>
        <div style="display:flex;gap:8px;align-items:center">
          <select data-bom-category="${escapeAttr(category)}"
            style="flex:1;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:8px 12px;color:var(--text);font-size:0.83rem">
            ${displayItems.map(item => `
              <option value="${escapeAttr(item.id)}" ${selected[category]?.id === item.id ? 'selected' : ''}>
                ${escapeAttr(item.supplier)} — ${escapeAttr(item.name)} (${money(item.unitCost)}/${item.unit})
              </option>`).join('')}
          </select>
          ${selUrl ? `<a href="${escapeAttr(selUrl)}" target="_blank" rel="noopener noreferrer"
            style="flex-shrink:0;font-size:0.75rem;color:var(--accent);text-decoration:none;border:1px solid rgba(6,182,212,0.3);border-radius:6px;padding:6px 10px;white-space:nowrap"
            title="Üretici sayfasını aç">Ürün ↗</a>` : ''}
        </div>
      </div>`;
    }).join('')}
    <table class="tech-table" style="margin-top:14px">
      <tbody>
        ${totals.rows.map(row => {
          const rowItem = selected[row.category];
          const rowUrl = rowItem?.url || '';
          const nameCell = rowUrl
            ? `<a href="${escapeAttr(rowUrl)}" target="_blank" rel="noopener noreferrer" style="color:var(--accent);text-decoration:none">${escapeAttr(CATEGORY_LABELS[row.category] || row.category)} — ${escapeAttr(row.name)} ↗</a>`
            : `${escapeAttr(CATEGORY_LABELS[row.category] || row.category)} — ${escapeAttr(row.name)}`;
          return `<tr>
            <td>${nameCell}</td>
            <td>${row.quantity.toFixed(row.unit === 'fixed' ? 0 : 1)} ${escapeAttr(row.unit)}</td>
            <td>${money(row.total)}</td>
          </tr>`;
        }).join('')}
        <tr style="border-top:2px solid var(--border)">
          <td colspan="2"><strong>BOM Ara Toplam</strong></td>
          <td><strong>${money(totals.subtotal)}</strong></td>
        </tr>
      </tbody>
    </table>
    <div style="font-size:0.75rem;color:var(--text-muted);margin-top:8px">
      ${items.length} ürün · ${categories.length} kategori · <code>fixtures/bom-suppliers.json</code>
    </div>
  `;

  // Search input event
  const searchEl = document.getElementById('bom-search');
  if (searchEl) {
    searchEl.addEventListener('input', e => {
      window.state._bomFilter = e.target.value;
      renderBom(e.target.value);
    }, { once: false });
  }

  // Event delegation — her render sonrası yeniden bağla
  wrap.addEventListener('change', handleBomChange, { once: true });
}

function handleBomChange(e) {
  const sel = e.target;
  if (sel.matches('[data-bom-category]')) {
    selectBomItem(sel.dataset.bomCategory, sel.value);
  }
}

export async function initBomBuilder() {
  // Çift init koruması — zaten yüklüyse sadece render et
  if (window.state.bomItems?.length > 0) {
    renderBom();
    return;
  }
  const wrap = document.getElementById('bom-builder-body');
  if (wrap) wrap.innerHTML = `<div style="font-size:0.82rem;color:var(--text-muted);display:flex;align-items:center;gap:8px">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 1s linear infinite;flex-shrink:0"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
    Tedarikçi verileri yükleniyor...
  </div>`;
  try {
    window.state.bomItems = await loadBomFixture();
  } catch (err) {
    console.warn('BOM fixture yüklenemedi, fallback kullanılıyor:', err.message);
    window.state.bomItems = normalizeBomItems([
      { category: 'panel', supplier: 'Standart', name: '430 Wp Mono PERC', unit: 'wp', unitCost: 19.8 },
      { category: 'inverter', supplier: 'Standart', name: 'String inverter 5-15 kW', unit: 'kwp', unitCost: 6800 },
      { category: 'mounting', supplier: 'Standart', name: 'Aluminum çatı montaj seti', unit: 'kwp', unitCost: 2300 },
      { category: 'cable', supplier: 'Standart', name: 'DC/AC kablo ve konektörler', unit: 'kwp', unitCost: 1450 },
      { category: 'labor', supplier: 'Standart', name: 'Montaj işçiliği', unit: 'kwp', unitCost: 1900 },
      { category: 'other', supplier: 'Standart', name: 'İzin ve proje dosyası', unit: 'fixed', unitCost: 6500 }
    ]);
  }
  renderBom();
}

export function selectBomItem(category, itemId) {
  window.state.bomSelection = { ...(window.state.bomSelection || {}), [category]: itemId };
  renderBom();
}

if (typeof window !== 'undefined') {
  window.initBomBuilder = initBomBuilder;
  window.selectBomItem = selectBomItem;
  window.bomMath = { normalizeBomItems, selectBomItems, calculateBomTotal };
}
