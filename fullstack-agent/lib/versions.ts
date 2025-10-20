/**
 * Centralized version configuration for container images
 * This file should be the single source of truth for all image versions
 */

const VERSIONS = {
  // Runtime container image version
  RUNTIME_IMAGE: 'fullstackagent/fullstack-web-runtime:v0.0.1-alpha.9',
} as const;

/**
 * Get the current runtime image with tag
 * @returns The full image name with tag
 */
export function getRuntimeImage(): string {
  return VERSIONS.RUNTIME_IMAGE;
}

/**
 * Get the image name without tag
 * @returns The image name without version tag
 */
export function getRuntimeImageName(): string {
  return VERSIONS.RUNTIME_IMAGE.split(':')[0];
}

/**
 * Get the image tag only
 * @returns The version tag
 */
export function getRuntimeImageTag(): string {
  return VERSIONS.RUNTIME_IMAGE.split(':')[1] || 'latest';
}