// Local identity and role checks for proposal workflow.

export const IDENTITY_VERSION = 'GH-ID-2026.04-v1';

export const USER_ROLES = ['sales', 'engineer', 'approver', 'admin'];
const APPROVAL_ROLES = new Set(['approver', 'admin']);

function cleanString(value, max = 120) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
}

export function normalizeUserIdentity(input = {}) {
  const role = USER_ROLES.includes(input.role) ? input.role : 'sales';
  const name = cleanString(input.name || input.displayName || 'local-user', 80) || 'local-user';
  return {
    version: IDENTITY_VERSION,
    id: cleanString(input.id || name.toLowerCase().replace(/[^a-z0-9]+/gi, '-'), 80) || 'local-user',
    name,
    role
  };
}

export function canApproveProposal(user = {}) {
  return APPROVAL_ROLES.has(normalizeUserIdentity(user).role);
}

export function describeApprover(user = {}) {
  const normalized = normalizeUserIdentity(user);
  return `${normalized.name} (${normalized.role})`;
}
