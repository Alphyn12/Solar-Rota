import { INVERTER_TYPES, PANEL_TYPES } from './data.js';

export const PV_ENGINE_CONTRACT_VERSION = 'GH-PV-ENGINE-CONTRACT-2026.04-v1';

function finite(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function nullableFinite(value) {
  return finite(value, null);
}

function currentTargetPowerKwp(state = {}) {
  const explicit = nullableFinite(state.targetSystemPowerKwp ?? state.systemPowerKwp);
  return explicit !== null && explicit > 0 ? explicit : null;
}

export function hasValidSiteCoordinates(site = {}) {
  if (site.lat === null || site.lat === undefined || site.lon === null || site.lon === undefined) return false;
  const lat = Number(site.lat);
  const lon = Number(site.lon);
  return Number.isFinite(lat) && lat >= -90 && lat <= 90 &&
    Number.isFinite(lon) && lon >= -180 && lon <= 180;
}

export function getPvEngineRequestIssues(request = {}) {
  const issues = [];
  if (!hasValidSiteCoordinates(request.site || {})) {
    issues.push('missing-or-invalid-site-coordinates');
  }
  return issues;
}

function normalizeHourlyProfile(values) {
  if (!Array.isArray(values) || values.length !== 8760) return null;
  return values.map(value => Math.max(0, finite(value, 0)));
}

export function buildPvEngineRequest(state = {}) {
  const panel = PANEL_TYPES[state.panelType || 'mono'] || PANEL_TYPES.mono;
  const inverter = INVERTER_TYPES[state.inverterType || 'string'] || INVERTER_TYPES.string;
  const cableLossPct = state.cableLossEnabled && state.cableLoss
    ? Math.max(0, finite(state.cableLoss.totalLossPct, 0))
    : 0;
  return {
    schema: PV_ENGINE_CONTRACT_VERSION,
    requestedEngine: state.enginePreference || 'auto',
    scenario: {
      key: state.scenarioKey || 'on-grid',
      label: state.scenarioContext?.label || 'On-Grid',
      proposalTone: state.scenarioContext?.proposalTone || 'commercial-grid'
    },
    site: {
      lat: nullableFinite(state.lat),
      lon: nullableFinite(state.lon),
      cityName: state.cityName || null,
      ghi: nullableFinite(state.ghi),
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
      panelWattPeak: finite(panel.wattPeak, 0),
      panelAreaM2: finite((panel.width || 0) * (panel.height || 0), 0),
      panelTempCoeffPerC: finite(panel.tempCoeff, -0.0037),
      panelDegradationRate: finite(panel.degradation, 0.0045),
      panelFirstYearDegradationRate: finite(panel.firstYearDeg, 0.02),
      bifacialGain: finite(panel.bifacialGain, 0),
      inverterType: state.inverterType || 'string',
      inverterEfficiency: finite(inverter.efficiency, 0.97),
      cableLossPct,
      wiringMismatchPct: cableLossPct,
      targetPowerKwp: currentTargetPowerKwp(state),
      batteryEnabled: !!state.batteryEnabled,
      battery: state.battery || null,
      netMeteringEnabled: !!state.netMeteringEnabled,
      evEnabled: !!state.evEnabled,
      ev: state.ev || null,
      heatPumpEnabled: !!state.heatPumpEnabled,
      heatPump: state.heatPump || null
    },
    parity: {
      contractPurpose: 'frontend-backend-production-parity',
      authoritativeSourceRule: 'one-production-source-per-run',
      browserModel: 'PVGIS/JS hybrid or local PSH fallback',
      backendModel: 'pvlib-backed when available, deterministic fallback otherwise',
      notes: [
        'Panel, inverter, cable-loss and scenario fields are passed explicitly to avoid hidden default drift.',
        'pvlib-backed production may intentionally differ from browser PVGIS/JS because it uses hourly solar position, transposition and temperature modeling.'
      ]
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
      annualPriceIncrease: finite(state.annualPriceIncrease, 0.12),
      discountRate: finite(state.discountRate, 0.18),
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
      'Panel wattage, panel area, inverter efficiency, bifacial gain, and cable-loss assumptions are passed explicitly in the engine request.',
      'Browser PVGIS/JS and backend pvlib are different production models; any remaining divergence should be explained by engine metadata, not hidden defaults.',
      'Downstream financial, report, audit and export layers must use one authoritative production source for the completed run.'
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
    fallbackUsed: !!(response.raw?.fallbackUsed || response.engineSource?.fallbackUsed),
    parityNotes: response.raw?.parityNotes || response.losses?.parityNotes || response.engineSource?.notes || []
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
