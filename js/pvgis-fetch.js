// ═══════════════════════════════════════════════════════════
// PVGIS Fetch Hardening — Solar Rota
// Fetch tiers: backend proxy (preferred) → direct PVGIS → PSH fallback
// Typed status, source metadata, user-friendly error messages
// ═══════════════════════════════════════════════════════════

export const PVGIS_FETCH_STATUS = {
  LIVE_SUCCESS:    'live-success',
  PROXY_SUCCESS:   'proxy-success',
  FALLBACK_USED:   'fallback-used',
  PARTIAL_DATA:    'partial-data',
  ERROR:           'error'
};

const PVGIS_ENDPOINTS = [
  'https://re.jrc.ec.europa.eu/api/v5_2/PVcalc',
  'https://re.jrc.ec.europa.eu/api/v5_3/PVcalc',
  'https://re.jrc.ec.europa.eu/api/PVcalc',
];

const PROXY_TIMEOUT_MS             = 15000; // backend 22 s alır; 15 s proxy için makul üst sınır
const DEFAULT_TIMEOUT_MS           = 20000; // direkt PVGIS başına (3 deneme × 20 s = max ~67 s)
export const CALC_TOTAL_TIMEOUT_MS = 55000; // tüm hesaplama için hard upper limit
const DEFAULT_RETRY_DELAYS_MS = [0, 2500, 5000];

function classifyError(e) {
  const msg = (e?.message || String(e)).toLowerCase();
  if (msg.includes('abort') || msg.includes('timeout')) return 'timeout';
  if (msg.includes('failed to fetch') || msg.includes('networkerror') || msg.includes('network')) return 'network';
  if (msg.includes('cors') || msg.includes('cross-origin')) return 'cors';
  if (msg.includes('ssl') || msg.includes('certificate')) return 'ssl';
  return 'unknown';
}

function buildUserMessage(errorType, lang) {
  const isEN = lang === 'en';
  const isDE = lang === 'de';
  switch (errorType) {
    case 'timeout':
      if (isEN) return 'Live solar data request timed out — estimated model used.';
      if (isDE) return 'Echtzeit-Solardaten-Anfrage abgelaufen — Schätzmodell verwendet.';
      return 'Canlı güneş verisi zaman aşımına uğradı — tahmini model kullanıldı.';
    case 'network':
      if (isEN) return 'Live solar data unavailable (network error) — estimated model used.';
      if (isDE) return 'Echtzeit-Solardaten nicht verfügbar (Netzwerkfehler) — Schätzmodell verwendet.';
      return 'Canlı güneş verisi alınamadı (ağ hatası) — tahmini model kullanıldı.';
    case 'cors':
      if (isEN) return 'Browser security blocked live data access — estimated model used.';
      if (isDE) return 'Browsersicherheit blockierte Echtzeitdatenzugriff — Schätzmodell verwendet.';
      return 'Tarayıcı güvenliği canlı veri erişimini engelledi — tahmini model kullanıldı.';
    case 'http-error':
      if (isEN) return 'PVGIS service temporarily unavailable — estimated model used.';
      if (isDE) return 'PVGIS-Dienst vorübergehend nicht verfügbar — Schätzmodell verwendet.';
      return 'PVGIS servisi geçici olarak yanıt vermedi — tahmini model kullanıldı.';
    default:
      if (isEN) return 'Live solar data unavailable — local estimated model used.';
      if (isDE) return 'Echtzeit-Solardaten nicht verfügbar — lokales Schätzmodell verwendet.';
      return 'Canlı güneş verisi alınamadı — yerel tahmini model kullanıldı.';
  }
}

/**
 * Attempt to fetch from the backend PVGIS proxy endpoint.
 * Returns a result object or null if the proxy is unavailable/fails quickly.
 */
async function _tryBackendProxy(backendProxyUrl, baseParams, fetchImpl, timeoutMs) {
  let timer = null;
  try {
    const ctrl = new AbortController();
    timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetchImpl(`${backendProxyUrl}?${baseParams}`, {
      signal: ctrl.signal,
      headers: { accept: 'application/json' }
    });

    if (!res.ok) return null;

    const data = await res.json();
    if (!data.ok) return null;

    const ey = data.rawEnergy || data.E_y;
    if (!ey || ey <= 0) return null;

    return {
      fetchStatus: PVGIS_FETCH_STATUS.PROXY_SUCCESS,
      rawEnergy: ey,
      rawPoa: data.rawPoa || data['H(i)_y'] || null,
      rawMonthly: data.rawMonthly || null,
      endpointUsed: backendProxyUrl,
    };
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Fetch PVGIS live data with retry/timeout/proxy fallback.
 *
 * Architecture (when backendProxyUrl provided):
 *   1. Backend proxy (avoids CORS, shorter timeout)
 *   2. Direct PVGIS endpoints (with retries)
 *   3. PSH local fallback (caller must handle)
 *
 * @param {{ lat, lon, peakpower, loss, angle, aspect }} params
 * @param {{
 *   retries?: number,
 *   timeoutMs?: number,
 *   backendProxyUrl?: string|null,
 *   proxyFirst?: boolean,
 *   fetchImpl?: Function,
 *   lang?: string
 * }} options
 */
export async function fetchPVGISLive(params, options = {}) {
  const {
    retries = 3,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retryDelaysMs = DEFAULT_RETRY_DELAYS_MS,
    backendProxyUrl = null,
    proxyFirst = true,
    fetchImpl = globalThis.fetch,
    lang = 'tr'
  } = options;

  const { lat, lon, peakpower, loss = 0, angle, aspect } = params;
  const baseParams = `lat=${lat}&lon=${lon}&peakpower=${peakpower}&loss=${loss}&angle=${angle}&aspect=${aspect}&outputformat=json&pvtechchoice=crystSi&mountingplace=free`;

  // ── Tier 1: Backend proxy (preferred, avoids CORS) ──────────────────────────
  if (backendProxyUrl && proxyFirst && typeof fetchImpl === 'function') {
    const proxyResult = await _tryBackendProxy(backendProxyUrl, baseParams, fetchImpl, PROXY_TIMEOUT_MS);
    if (proxyResult) {
      return {
        ...proxyResult,
        attemptCount: 1,
        errorType: null,
        errorMessage: null,
        userMessage: null
      };
    }
    // Proxy failed — fall through to direct PVGIS
    console.info('[pvgis-fetch] Backend proxy unavailable — trying direct PVGIS');
  }

  // ── Tier 2: Direct PVGIS endpoints ──────────────────────────────────────────
  let lastError = null;
  let lastErrorType = null;
  let attemptCount = 0;

  for (let attempt = 0; attempt < retries; attempt++) {
    attemptCount++;
    if (attempt > 0) {
      const delay = retryDelaysMs[Math.min(attempt, retryDelaysMs.length - 1)];
      if (delay > 0) await new Promise(r => setTimeout(r, delay));
    }

    const endpoint = PVGIS_ENDPOINTS[Math.min(attempt, PVGIS_ENDPOINTS.length - 1)];
    const url = `${endpoint}?${baseParams}`;

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetchImpl(url, { signal: ctrl.signal, credentials: 'omit', cache: 'no-store' });

      if (!res.ok) {
        lastError = `HTTP ${res.status}`;
        lastErrorType = 'http-error';
        console.warn('[pvgis-fetch] HTTP error:', res.status, 'attempt', attempt + 1);
        continue;
      }

      const data = await res.json();
      const ey = data.outputs?.totals?.fixed?.E_y;
      if (!ey || ey <= 0) {
        lastError = 'Empty or zero E_y in response';
        lastErrorType = 'empty-response';
        continue;
      }

      const rawMonthly = data.outputs?.monthly?.fixed
        ? data.outputs.monthly.fixed.map(m => m.E_m)
        : null;
      const rawPoa = data.outputs?.totals?.fixed?.['H(i)_y']
        || data.outputs?.totals?.fixed?.H_i_y
        || null;

      return {
        fetchStatus: PVGIS_FETCH_STATUS.LIVE_SUCCESS,
        rawEnergy: ey,
        rawPoa,
        rawMonthly,
        endpointUsed: endpoint,
        attemptCount,
        errorType: null,
        errorMessage: null,
        userMessage: null
      };
    } catch (e) {
      const etype = classifyError(e);
      lastError = e?.message || String(e);
      lastErrorType = etype;
      console.warn('[pvgis-fetch] Attempt', attempt + 1, 'failed:', etype, '-', e?.message);
    } finally {
      clearTimeout(timer);
    }
  }

  // ── Tier 3 (legacy): backend proxy as last resort if not proxyFirst ──────────
  if (backendProxyUrl && !proxyFirst && typeof fetchImpl === 'function') {
    const proxyResult = await _tryBackendProxy(backendProxyUrl, baseParams, fetchImpl, PROXY_TIMEOUT_MS);
    if (proxyResult) {
      return {
        ...proxyResult,
        attemptCount: attemptCount + 1,
        errorType: null,
        errorMessage: null,
        userMessage: null
      };
    }
  }

  // ── All tiers failed — caller must use PSH fallback ─────────────────────────
  const userMessage = buildUserMessage(lastErrorType, lang);
  if (typeof window !== 'undefined') window._pvgisLastError = lastError;

  return {
    fetchStatus: PVGIS_FETCH_STATUS.FALLBACK_USED,
    rawEnergy: null,
    rawPoa: null,
    rawMonthly: null,
    endpointUsed: null,
    attemptCount,
    errorType: lastErrorType,
    errorMessage: lastError,
    userMessage
  };
}

/**
 * Human-readable source label for UI display.
 * @param {string} fetchStatus
 * @param {string} [lang]
 * @returns {string}
 */
export function getPvgisSourceLabel(fetchStatus, lang = 'tr') {
  const isEN = lang === 'en';
  const isDE = lang === 'de';
  switch (fetchStatus) {
    case PVGIS_FETCH_STATUS.LIVE_SUCCESS:
      return isEN ? 'PVGIS Live' : isDE ? 'PVGIS Live' : 'PVGIS Canlı';
    case PVGIS_FETCH_STATUS.PROXY_SUCCESS:
      return isEN ? 'PVGIS (via Proxy)' : isDE ? 'PVGIS (Proxy)' : 'PVGIS (Proxy)';
    case PVGIS_FETCH_STATUS.FALLBACK_USED:
      return isEN ? 'PSH Estimate' : isDE ? 'PSH-Schätzung' : 'PSH Tahmini';
    case PVGIS_FETCH_STATUS.PARTIAL_DATA:
      return isEN ? 'Partial Data' : isDE ? 'Teilweise Daten' : 'Kısmi Veri';
    default:
      return isEN ? 'Unknown' : isDE ? 'Unbekannt' : 'Bilinmeyen';
  }
}

/**
 * Whether backend vs. PVGIS parity comparison is meaningful.
 * Only true when live data succeeded AND backend also ran.
 */
export function isPvgisParityAvailable(fetchStatus, hasBackendResult) {
  return fetchStatus === PVGIS_FETCH_STATUS.LIVE_SUCCESS && !!hasBackendResult;
}
