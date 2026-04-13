import assert from 'node:assert/strict';
import { createShareStateSnapshot, escapeHtml, sanitizeSharedState } from '../js/security.js';

assert.equal(escapeHtml('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');

const sanitized = sanitizeSharedState({
  cityName: '<b>Ankara</b>',
  lat: 120,
  lon: 32.85,
  roofArea: -50,
  shadingFactor: 999,
  panelType: 'not-real',
  displayCurrency: 'EUR',
  monthlyConsumption: [1, '2', -3, Number.NaN, ...new Array(20).fill(5)],
  results: { annualEnergy: 999 },
  __proto__: { polluted: true },
  tax: {
    hasIncentiveCert: true,
    investmentContribution: '<script>x</script>'
  }
});

assert.equal(sanitized.cityName, '<b>Ankara</b>');
assert.equal(sanitized.lat, 90);
assert.equal(sanitized.lon, 32.85);
assert.equal(sanitized.roofArea, 0);
assert.equal(sanitized.shadingFactor, 80);
assert.equal('panelType' in sanitized, false);
assert.equal('displayCurrency' in sanitized, false);
assert.equal(sanitized.monthlyConsumption.length, 12);
assert.equal(sanitized.monthlyConsumption[0], 1);
assert.equal(sanitized.monthlyConsumption[2], 0);
assert.equal('results' in sanitized, false);
assert.equal({}.polluted, undefined);
assert.equal(sanitized.tax.hasIncentiveCert, true);
assert.equal(sanitized.tax.investmentContribution, '<script>x</script>');

const snapshot = createShareStateSnapshot({
  cityName: 'Izmir',
  results: { unsafe: true },
  roofSections: [{ area: 10, tilt: 90, azimuth: 180, azimuthCoeff: 1, shadingFactor: 10 }]
});
assert.equal(snapshot.cityName, 'Izmir');
assert.equal('results' in snapshot, false);
assert.equal(snapshot.roofSections[0].tilt, 70);

console.log('security state tests passed');
