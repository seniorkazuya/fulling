/**
 * Version configuration for container images and dependencies
 * IMPORTANT: Always use specific version tags to ensure consistency
 */

export const VERSIONS = {
  // Runtime container image version
  // Update this when deploying new runtime versions
  RUNTIME_IMAGE: 'fullstackagent/fullstack-web-runtime:v0.0.1-alpha.0',

  // PostgreSQL version for KubeBlocks
  POSTGRESQL_VERSION: 'postgresql-14.8.0',
  POSTGRESQL_DEFINITION: 'postgresql',

  // Resource limits for containers
  RESOURCES: {
    SANDBOX: {
      requests: {
        cpu: '20m',
        memory: '25Mi',
      },
      limits: {
        cpu: '200m',
        memory: '256Mi',
      },
    },
    DATABASE: {
      requests: {
        cpu: '100m',
        memory: '102Mi',
      },
      limits: {
        cpu: '1000m',
        memory: '1024Mi',
      },
    },
  },

  // Storage configuration
  STORAGE: {
    DATABASE_SIZE: '3Gi',
    STORAGE_CLASS: 'openebs-backup',
  },
} as const;

/**
 * Get the current runtime image with tag
 */
export function getRuntimeImage(): string {
  return VERSIONS.RUNTIME_IMAGE;
}

/**
 * Get the image name without tag
 */
export function getRuntimeImageName(): string {
  return VERSIONS.RUNTIME_IMAGE.split(':')[0];
}

/**
 * Get the image tag only
 */
export function getRuntimeImageTag(): string {
  return VERSIONS.RUNTIME_IMAGE.split(':')[1] || 'v0.0.1-alpha.0';
}