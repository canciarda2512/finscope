import { SYMBOLS_SET } from '../config/constants.js';

/**
 * Validate and normalize a trading symbol.
 * Returns the uppercase symbol or null if invalid.
 */
export function validateSymbol(value) {
  const symbol = String(value || '').toUpperCase().trim();
  return SYMBOLS_SET.has(symbol) ? symbol : null;
}

/**
 * Parse a numeric value with bounds. Returns the number or null if invalid.
 */
export function validateNumber(value, { min, max, fallback } = {}) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback ?? null;
  if (min !== undefined && num < min) return fallback ?? null;
  if (max !== undefined && num > max) return fallback ?? null;
  return num;
}

/**
 * Parse a positive number (> 0). Returns null if invalid.
 */
export function validatePositiveNumber(value) {
  return validateNumber(value, { min: Number.MIN_VALUE });
}

/**
 * Validate a value is in an allowed set/array.
 * Returns the value if valid, null otherwise.
 */
export function validateEnum(value, allowed) {
  const set = allowed instanceof Set ? allowed : new Set(allowed);
  return set.has(value) ? value : null;
}

/**
 * Validate and trim a required string.
 * Returns trimmed string or null if empty.
 */
export function validateString(value) {
  const str = String(value || '').trim();
  return str.length > 0 ? str : null;
}

/**
 * Normalize a symbol string: uppercase, alphanumeric only.
 * Does NOT validate against allowed list.
 */
export function normalizeSymbol(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Clamp a number within [min, max] with a default fallback.
 */
export function clampNumber(value, min, max, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(Math.max(Math.floor(num), min), max);
}
