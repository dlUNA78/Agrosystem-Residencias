// src/config/constants.js

export const USER_ROLES = Object.freeze({
  ADMIN: 'admin',
  INIFAP: 'inifap',
  AGRICULTOR: 'agricultor',
});

export const USER_STATUSES = Object.freeze({
  ACTIVO: 'activo',
  INACTIVO: 'inactivo',
  SUSPENDIDO: 'suspendido',
});

export const USER_SHIFTS = Object.freeze([
  'Matutino',
  'Vespertino',
  'Nocturno',
]);

export const FARMING_TYPES = Object.freeze([
  'Temporal',
  'Riego',
  'Invernadero',
]);

export const REPORT_PERIODS = Object.freeze([
  { id: 'semanal', label: 'Semanal (Últimos 7 días)' },
  { id: 'mensual', label: 'Mensual (Últimos 30 días)' },
  { id: 'anual', label: 'Anual (Ciclo Agrícola)' },
]);

export const PLAGUE_RISK_LEVELS = Object.freeze([
  'Bajo',
  'Medio',
  'Alto',
  'Crítico',
]);

export const TOXICOLOGICAL_CATEGORIES = Object.freeze([
  'Categoría 1 (Peligro)',
  'Categoría 2 (Peligro)',
  'Categoría 3 (Atención)',
  'Categoría 4 (Atención)',
  'Categoría 5 (Precaución)',
]);

export const WORKFLOW_STATUSES = Object.freeze({
  DRAFT: 'draft',
  IN_REVIEW: 'in_review',
  VERIFIED: 'verified',
  PUBLISHED: 'published',
  REJECTED: 'rejected',
});
