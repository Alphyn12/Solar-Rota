import { runCalculation as runBrowserCalculation } from './calc-engine.js';
import { createSolarEngineContext, resolveExternalEngine } from './solar-engine-adapter.js';
import { isAuthoritativeBackendResponse } from './pv-engine-contracts.js';

export async function runCalculation() {
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
  }
}

if (typeof window !== 'undefined') {
  window.runCalculationService = runCalculation;
}
