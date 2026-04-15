import assert from 'node:assert/strict';
import {
  calculateBomTotal,
  getActiveBomCategories,
  selectBomItems
} from '../js/bom.js';

const items = [
  { id: 'panel-a', category: 'panel', name: 'Panel A', unit: 'wp', unitCost: 10 },
  { id: 'inverter-a', category: 'inverter', name: 'Inverter A', unit: 'kwp', unitCost: 1000 },
  { id: 'mount-a', category: 'mounting', name: 'Mount A', unit: 'kwp', unitCost: 100 },
  { id: 'cable-a', category: 'cable', name: 'Cable A', unit: 'kwp', unitCost: 50 },
  { id: 'labor-a', category: 'labor', name: 'Labor A', unit: 'kwp', unitCost: 80 },
  { id: 'other-a', category: 'other', name: 'Permit A', unit: 'fixed', unitCost: 500 },
  { id: 'battery-a', category: 'battery', name: 'Battery A', unit: 'fixed', unitCost: 50000 },
  { id: 'monitor-a', category: 'monitoring', name: 'Monitoring A', unit: 'fixed', unitCost: 3000 }
];

const pvOnlyCategories = getActiveBomCategories({ batteryEnabled: false });
assert.equal(pvOnlyCategories.has('battery'), false);
assert.equal(pvOnlyCategories.has('monitoring'), false);

const pvOnlySelected = selectBomItems(items, {}, { activeCategories: pvOnlyCategories });
const pvOnlyTotal = calculateBomTotal(pvOnlySelected, { wp: 1000, kwp: 1, fixed: 1 });
assert.equal(pvOnlyTotal.rows.some(row => row.category === 'battery'), false);
assert.equal(pvOnlyTotal.rows.some(row => row.category === 'monitoring'), false);
assert.equal(pvOnlyTotal.subtotal, 11730);

const batterySelected = selectBomItems(items, {}, { activeCategories: getActiveBomCategories({ batteryEnabled: true }) });
const batteryTotal = calculateBomTotal(batterySelected, { wp: 1000, kwp: 1, fixed: 1 });
assert.equal(batteryTotal.rows.some(row => row.category === 'battery'), true);
assert.equal(batteryTotal.subtotal, 61730);

const monitoringSelected = selectBomItems(items, {}, {
  activeCategories: getActiveBomCategories({ bomCommercials: { includeMonitoringHardware: true } })
});
const monitoringTotal = calculateBomTotal(monitoringSelected, { wp: 1000, kwp: 1, fixed: 1 });
assert.equal(monitoringTotal.rows.some(row => row.category === 'monitoring'), true);
assert.equal(monitoringTotal.subtotal, 14730);

console.log('BOM commercial tests passed');
