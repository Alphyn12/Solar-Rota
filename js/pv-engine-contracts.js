export const PV_ENGINE_CONTRACT_VERSION = 'GH-PV-ENGINE-CONTRACT-2026.04-v1';

function finite(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeHourlyProfile(values) {
  if (!Array.isArray(values) || values.length !== 8760) return null;
  return values.map(value => Math.max(0, finite(value, 0)));
}

export function buildPvEngineRequest(state = {}) {
  return {
    schema: PV_ENGINE_CONTRACT_VERSION,
    requestedEngine: state.enginePreference || 'auto',
    scenario: {
      key: state.scenarioKey || 'on-grid',
      label: state.scenarioContext?.label || 'On-Grid',
      proposalTone: state.scenarioContext?.proposalTone || 'commercial-grid'
    },
    site: {
      lat: finite(state.lat, null),
      lon: finite(state.lon, null),
      cityName: state.cityName || null,
      ghi: finite(state.ghi, null),
      timezone: 'Europe/Istanbul'
    },
    roof: {
      areaM2: finite(state.roofArea, 0),
      tiltDeg: finite(state.tilt, 33),
      azimuthDeg: finite(state.azimuth, 180),
      azimuthName: state.azimuthName || 'Güney',
      shadingPct: finite(state.shadingFactor, 0),
      soilingPct: finite(state.soilingFactor, 0),
      geometry: state.roofGeometry || null,
      sections: Array.isArray(state.roofSections) ? state.roofSections : []
    },
    system: {
      panelType: state.panelType || 'mono',
      inverterType: state.inverterType || 'string',
      targetPowerKwp: finite(state.targetSystemPowerKwp ?? state.systemPowerKwp ?? state.results?.systemPower, null),
      batteryEnabled: !!state.batteryEnabled,
      battery: state.battery || null,
      netMeteringEnabled: !!state.netMeteringEnabled,
      evEnabled: !!state.evEnabled,
      ev: state.ev || null,
      heatPumpEnabled: !!state.heatPumpEnabled,
      heatPump: state.heatPump || null
    },
    load: {
      dailyConsumptionKwh: finite(state.dailyConsumption, 0),
      monthlyConsumptionKwh: Array.isArray(state.monthlyConsumption) ? state.monthlyConsumption.map(v => Math.max(0, finite(v, 0))).slice(0, 12) : null,
      hourlyConsumption8760: normalizeHourlyProfile(state.hourlyConsumption8760)
    },
    tariff: {
      tariffType: state.tariffType || 'residential',
      tariffRegime: state.tariffRegime || 'auto',
      importRateTryKwh: finite(state.tariff, 0),
      exportRateTryKwh: finite(state.exportTariff, 0),
      contractedPowerKw: finite(state.contractedPowerKw, 0),
      annualPriceIncrease: finite(state.annualPriceIncrease, 0),
      discountRate: finite(state.discountRate, 0),
      sourceDate: state.tariffSourceDate || null,
      sourceCheckedAt: state.tariffSourceCheckedAt || null
    },
    governance: {
      evidence: state.evidence || {},
      proposalApproval: state.proposalApproval || null,
      quoteInputsVerified: !!state.quoteInputsVerified,
      hasSignedCustomerBillData: !!state.hasSignedCustomerBillData
    }
  };
}

export function buildEngineSourceMeta({ engine = 'js-local', usedFallback = false, provider = null } = {}) {
  const isPythonBackend = ['python-backend', 'pvlib-service'].includes(engine);
  const source = isPythonBackend
    ? 'Python backend pvlib-ready'
    : usedFallback
      ? 'local simplified'
      : 'PVGIS-based';
  return {
    engine,
    provider: provider || (isPythonBackend ? 'python-pvlib-ready' : usedFallback ? 'local-psh-fallback' : 'pvgis-hybrid-js'),
    source,
    confidence: isPythonBackend ? 'medium' : usedFallback ? 'low' : 'medium',
    engineQuality: isPythonBackend ? 'adapter-ready' : usedFallback ? 'fallback-estimate' : 'pvgis-hybrid',
    pvlibReady: true,
    pvlibBacked: false,
    fallbackUsed: !!usedFallback,
    notes: [
      'Current browser implementation keeps PVGIS/JS calculation active.',
      'Future Python service should return the same production, loss, financial, and proposal summary contracts.'
    ]
  };
}

export function normalizePvEngineResponse(response = {}) {
  return {
    schema: response.schema || PV_ENGINE_CONTRACT_VERSION,
    engineSource: response.engineSource || buildEngineSourceMeta({ usedFallback: !!response.usedFallback }),
    production: response.production || null,
    losses: response.losses || null,
    financial: response.financial || null,
    proposal: response.proposal || null,
    raw: response.raw || null,
    engineUsed: response.raw?.engineUsed || response.production?.engine_used || response.engineSource?.source || null,
    engineQuality: response.raw?.engineQuality || response.production?.engine_quality || response.engineSource?.engineQuality || null,
    fallbackUsed: !!(response.raw?.fallbackUsed || response.engineSource?.fallbackUsed)
  };
}

export function isAuthoritativeBackendResponse(response = {}) {
  return !!(
    response?.engineSource?.pvlibBacked &&
    !response?.fallbackUsed &&
    !response?.engineSource?.fallbackUsed &&
    response?.production?.annualEnergyKwh > 0
  );
}
