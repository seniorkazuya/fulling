/**
 * Client-safe utilities for system environment variables
 * This file contains no Node.js-specific imports and can be used in client components
 */

/**
 * System environment variable interface
 */
export interface SystemEnvVar {
  key: string;
  value: string;
  description?: string;
}

/**
 * Mask secret value for display
 * Shows first 8 characters followed by ****
 */
export function maskSecret(value: string): string {
  if (!value) return '(empty)';
  if (value.length <= 8) return '****';
  return value.substring(0, 8) + '****';
}

/**
 * Check if a value should be displayed as empty
 */
export function isEmptyValue(value: string): boolean {
  return !value || value === '';
}
