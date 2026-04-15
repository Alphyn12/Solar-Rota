import assert from 'node:assert/strict';
import { applyScenarioDefaults, getScenarioDefinition, listScenarioDefinitions, scenarioSourceQualityNote } from '../js/scenario-workflows.js';
import {
  buildEngineSourceMeta,
  buildPvEngineRequest,
  getPvEngineRequestIssues,
  hasValidSiteCoordinates,
  isAuthoritativeBackendResponse,
  normalizePvEngineResponse
} from '../js/pv-engine-contracts.js';
import { createSolarEngineContext, resolveExternalEngine, sourceMetaForCurrentCalculation } from '../js/solar-engine-adapter.js';

assert.equal(listScenarioDefinitions().length, 6);
assert.equal(getScenarioDefinition('off-grid').visibleBlocks.netMetering, false);

const offgrid = applyScenarioDefaults({ dailyConsumption: 30, netMeteringEnabled: true }, 'off-grid');
assert.equal(offgrid.scenarioKey, 'off-grid');
assert.equal(offgrid.netMeteringEnabled, false);
assert.equal(offgrid.batteryEnabled, true);
assert.equal(offgrid.scenarioContext.proposalTone, 'autonomy');

const irrigation = applyScenarioDefaults({}, 'agricultural-irrigation');
assert.equal(irrigation.tariffType, 'agriculture');
assert.equal(irrigation.scenarioContext.visibleBlocks.netMetering, false);

const request = buildPvEngineRequest({
  scenarioKey: 'ev-charging',
  scenarioContext: { label: 'EV Charging Station', proposalTone: 'charging' },
  lat: 39.9,
  lon: 32.8,
  cityName: 'Ankara',
  roofArea: 100,
  tilt: 30,
  azimuth: 180,
  panelType: 'mono',
  inverterType: 'string',
  dailyConsumption: 50,
  hourlyConsumption8760: new Array(8760).fill(1),
  tariffType: 'commercial',
  tariff: 8
});
assert.equal(request.schema, 'GH-PV-ENGINE-CONTRACT-2026.04-v1');
assert.equal(request.scenario.key, 'ev-charging');
assert.equal(request.load.hourlyConsumption8760.length, 8760);
assert.equal(request.tariff.tariffType, 'commercial');
assert.equal(request.tariff.annualPriceIncrease, 0.12);
assert.equal(request.tariff.discountRate, 0.18);
assert.equal(request.system.targetPowerKwp, null);
assert.equal(request.system.panelWattPeak, 430);
assert.ok(Math.abs(request.system.panelAreaM2 - (1.134 * 1.762)) < 1e-9);
assert.equal(request.system.inverterEfficiency, 0.97);
assert.equal(request.system.cableLossPct, 0);
assert.equal(request.parity.authoritativeSourceRule, 'one-production-source-per-run');

const staleResultRequest = buildPvEngineRequest({
  lat: 39.9,
  lon: 32.8,
  roofArea: 40,
  results: { systemPower: 999 }
});
assert.equal(staleResultRequest.system.targetPowerKwp, null);

const explicitTargetRequest = buildPvEngineRequest({
  lat: 39.9,
  lon: 32.8,
  roofArea: 40,
  targetSystemPowerKwp: 12.5,
  results: { systemPower: 999 }
});
assert.equal(explicitTargetRequest.system.targetPowerKwp, 12.5);

const cableLossRequest = buildPvEngineRequest({
  lat: 39.9,
  lon: 32.8,
  roofArea: 40,
  cableLossEnabled: true,
  cableLoss: { totalLossPct: 1.75 }
});
assert.equal(cableLossRequest.system.cableLossPct, 1.75);
assert.equal(cableLossRequest.system.wiringMismatchPct, 1.75);

const missingCoordinateRequest = buildPvEngineRequest({ lat: null, lon: undefined, results: { systemPower: 5 } });
assert.equal(missingCoordinateRequest.site.lat, null);
assert.equal(missingCoordinateRequest.site.lon, null);
assert.equal(hasValidSiteCoordinates(missingCoordinateRequest.site), false);
assert.ok(getPvEngineRequestIssues(missingCoordinateRequest).includes('missing-or-invalid-site-coordinates'));

const invalidCoordinateRequest = buildPvEngineRequest({ lat: 120, lon: 32.8 });
assert.equal(hasValidSiteCoordinates(invalidCoordinateRequest.site), false);

const context = createSolarEngineContext({ scenarioKey: 'on-grid' });
assert.ok(context.availableEngines.some(engine => engine.key === 'pvlib-service' && engine.bridge.readyForBackend));
assert.ok(context.availableEngines.some(engine => engine.key === 'python-backend' && engine.bridge.readyForBackend));

const fallbackMeta = sourceMetaForCurrentCalculation({ usedFallback: true });
assert.equal(fallbackMeta.source, 'local simplified');
assert.equal(buildEngineSourceMeta({ engine: 'python-backend' }).source, 'Python backend pvlib-ready');
assert.match(scenarioSourceQualityNote('heat-pump', 'pvgis-live'), /PVGIS-based/);
assert.match(scenarioSourceQualityNote('heat-pump', 'python-backend'), /Python backend pvlib-ready/);
assert.equal(normalizePvEngineResponse({ usedFallback: true }).engineSource.source, 'local simplified');

const failedBackend = await resolveExternalEngine(
  { enginePreference: 'auto', scenarioKey: 'on-grid' },
  {
    endpoint: 'http://127.0.0.1:9/api/pv/calculate',
    timeoutMs: 5,
    fetchImpl: async () => { throw new Error('backend down'); }
  }
);
assert.equal(failedBackend.failed, true);
assert.equal(failedBackend.fallbackEngineSource.source, 'PVGIS-based');

const blockedInvalidSiteBackend = await resolveExternalEngine(
  { enginePreference: 'auto', scenarioKey: 'on-grid', lat: null, lon: null },
  {
    fetchImpl: async () => {
      throw new Error('fetch should not be called for invalid coordinates');
    }
  }
);
assert.equal(blockedInvalidSiteBackend.failed, true);
assert.match(blockedInvalidSiteBackend.error, /missing-or-invalid-site-coordinates/);

assert.equal(isAuthoritativeBackendResponse({
  engineSource: { pvlibBacked: true, fallbackUsed: false },
  production: { annualEnergyKwh: 12000 }
}), true);
assert.equal(isAuthoritativeBackendResponse({
  engineSource: { pvlibBacked: false, fallbackUsed: true },
  production: { annualEnergyKwh: 12000 }
}), false);

console.log('scenario and engine contract tests passed');
