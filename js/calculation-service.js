import { runCalculation as runBrowserCalculation } from './calc-engine.js';
import { createSolarEngineContext, resolveExternalEngine } from './solar-engine-adapter.js';
import { isAuthoritativeBackendResponse } from './pv-engine-contracts.js';

// FIX-8: Guard against concurrent calculation runs. Without this, rapidly
// clicking "Calculate" could start two overlapping async chains that both
// write to window.state.results and to state.authoritativeEngineOverride,
// producing a mixed/corrupted result set.
let _calculationInProgress = false;
let _calculationAbortController = null;

export async function runCalculation() {
  // Abort any in-flight calculation before starting a new one.
  if (_calculationInProgress && _calculationAbortController) {
    _calculationAbortController.abort();
  }
  _calculationInProgress = true;
  _calculationAbortController = new AbortController();
  const state = window.state || {};
  state.engineContext = createSolarEngineContext(state);
  const external = await resolveExternalEngine(state);
  if (external?.failed) {
    state.engineContext.externalFailure = external.error;
    state.backendEngineAvailable = false;
    state.backendEngineLastError = external.error;
    window.showToast?.('Python mühendislik servisi hazır değil; PVGIS/JS motoru kullanılıyor.', 'info');
  } else if (external?.engineSource) {
    state.backendEngineAvailable = true;
    state.backendEngineLastError = null;
    state.engineContext.externalResponse = external;
  }
  const backendIsAuthoritative = isAuthoritativeBackendResponse(external);
  state.authoritativeEngineOverride = backendIsAuthoritative ? external : null;
  state.authoritativeEngineFallbackReason = backendIsAuthoritative
    ? null
    : external?.engineSource?.fallbackUsed
      ? external?.raw?.fallback_flags?.[0] || external?.losses?.fallbackReason || 'Backend pvlib path returned a fallback result.'
      : external?.failed
        ? external.error
        : null;
  try {
    const result = await runBrowserCalculation();
    if (external?.engineSource && state.results && !backendIsAuthoritative) {
      state.results.backendEngineSource = external.engineSource;
      state.results.backendEngineResponse = external;
      state.results.backendCalculationMode = (external.fallbackUsed || external.engineSource?.fallbackUsed)
        ? 'python-backend-deterministic-fallback'
        : external.engineSource?.pvlibBacked
        ? 'python-pvlib-backed'
        : 'python-backend-pvlib-ready';
    }
    return result;
  } finally {
    state.authoritativeEngineOverride = null;
    _calculationInProgress = false;
    _calculationAbortController = null;
  }
}

if (typeof window !== 'undefined') {
  window.runCalculationService = runCalculation;
}
