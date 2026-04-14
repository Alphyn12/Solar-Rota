// Shared consumption evidence checks for governance and calculation paths.

export function normalizeMonthlyConsumption(monthlyConsumption) {
  if (!Array.isArray(monthlyConsumption) || monthlyConsumption.length !== 12) return null;
  const values = monthlyConsumption.map(value => Number(value));
  if (values.some(value => !Number.isFinite(value) || value < 0)) return null;
  return values;
}

export function hasMeaningfulMonthlyConsumption(monthlyConsumption, { minAnnualKwh = 12, minPositiveMonths = 1 } = {}) {
  const values = normalizeMonthlyConsumption(monthlyConsumption);
  if (!values) return false;
  const annualKwh = values.reduce((sum, value) => sum + value, 0);
  const positiveMonths = values.filter(value => value > 0).length;
  return annualKwh >= minAnnualKwh && positiveMonths >= minPositiveMonths;
}

export function hasCompleteHourlyProfile8760(hourlyConsumption8760) {
  return Array.isArray(hourlyConsumption8760)
    && hourlyConsumption8760.length === 8760
    && hourlyConsumption8760.every(value => Number.isFinite(Number(value)) && Number(value) >= 0);
}

export function hasMeaningfulConsumptionEvidence(state = {}) {
  return !!state.hasSignedCustomerBillData
    || hasMeaningfulMonthlyConsumption(state.monthlyConsumption)
    || hasCompleteHourlyProfile8760(state.hourlyConsumption8760);
}
