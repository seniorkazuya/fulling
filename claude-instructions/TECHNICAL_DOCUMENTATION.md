# FullStack Agent - Technical Implementation Documentation

## Table of Contents
1. [System Architecture](#system-architecture)
2. [Core Components](#core-components)
3. [Kubernetes Integration](#kubernetes-integration)
4. [Database Management](#database-management)
5. [Authentication Flow](#authentication-flow)
6. [Sandbox Lifecycle](#sandbox-lifecycle)
7. [API Design](#api-design)
8. [Security Implementation](#security-implementation)
9. [Performance Optimizations](#performance-optimizations)
10. [Troubleshooting Guide](#troubleshooting-guide)

## System Architecture

### Overview
FullStack Agent follows a microservices-inspired architecture deployed on Kubernetes, with clear separation between the control plane (Next.js application) and the data plane (sandbox environments).

### Component Diagram
```
┌──────────────────────────────────────────────────────────────────┐
│                          Control Plane                            │
├────────────────────────────────────────────────────────────────── │
│                                                                   │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │   Next.js   │───▶│   Prisma    │───▶│ PostgreSQL  │         │
│  │  App Router │    │     ORM     │    │   Database  │         │
│  └─────────────┘    └─────────────┘    └─────────────┘         │
│         │                                                        │
│         ▼                                                        │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │
│  │  NextAuth   │───▶│   GitHub    │    │ Kubernetes  │        │
│  │     v5      │    │   OAuth     │    │   Service   │        │
│  └─────────────┘    └─────────────┘    └─────▬───────┘        │
│                                                │                 │
└─────────────────────────────────────────────── │ ────────────────┘
                                                  │
┌──────────────────────────────────────────────── ▼ ────────────────┐
│                          Data Plane                               │
├────────────────────────────────────────────────────────────────── │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                  Kubernetes Cluster                       │   │
│  │                                                           │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │   │
│  │  │  KubeBlocks  │  │   Sandbox    │  │   Ingress    │  │   │
│  │  │  PostgreSQL  │  │  Deployment  │  │  Controller  │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  │   │
│  │                                                           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                   │
└────────────────────────────────────────────────────────────────── │
```

## Core Components

### 1. KubernetesService (`lib/kubernetes.ts`)

The heart of the platform's infrastructure management.

#### Key Responsibilities:
- **Cluster Connection**: Manages kubeconfig loading and API client initialization
- **Resource Creation**: Creates deployments, services, and ingresses
- **Database Provisioning**: Integrates with KubeBlocks for PostgreSQL management
- **Status Monitoring**: Tracks pod and deployment states

#### Implementation Details:

```typescript
export class KubernetesService {
  private kc: k8s.KubeConfig;
  private k8sApi: k8s.CoreV1Api;
  private k8sAppsApi: k8s.AppsV1Api;
  private k8sNetworkingApi: k8s.NetworkingV1Api;

  constructor() {
    // Load kubeconfig with proper error handling
    const kubeconfigPath = path.join(process.cwd(), '.secret', 'kubeconfig');
    if (fs.existsSync(kubeconfigPath)) {
      this.kc.loadFromFile(kubeconfigPath);
      // Verify correct server endpoint (not localhost)
      const cluster = this.kc.getCurrentCluster();
      if (!cluster?.server || cluster.server.includes('localhost')) {
        throw new Error(`Invalid server endpoint: ${cluster?.server}`);
      }
    }
  }
}
```

#### Critical Fix Applied (2025-10-11):
**Problem**: Kubernetes API responses have inconsistent structure
**Solution**: Handle both `response.body.items` and `response.items` patterns

```typescript
// Before (causes errors):
const deployments = await this.k8sAppsApi.listNamespacedDeployment({ namespace });
const items = deployments.body?.items || [];

// After (fixed):
const deployments = await this.k8sAppsApi.listNamespacedDeployment({ namespace });
const items = deployments.body?.items || (deployments as any).items || [];
```

### 2. Database Management

#### KubeBlocks Integration
Uses KubeBlocks for managed PostgreSQL instances with automatic:
- High availability configuration
- Backup and restore capabilities
- Connection credential management

#### Database Creation Flow:
1. Create ServiceAccount with proper labels
2. Create Role with full permissions
3. Create RoleBinding
4. Create KubeBlocks Cluster resource
5. Wait for cluster to be ready
6. Retrieve connection credentials from generated secret

#### Implementation:
```typescript
async createPostgreSQLDatabase(projectName: string, namespace?: string) {
  const clusterName = `${projectName}-agentruntime-${randomSuffix}`;

  // 1. Create RBAC resources
  await this.createServiceAccount(clusterName, namespace);
  await this.createRole(clusterName, namespace);
  await this.createRoleBinding(clusterName, namespace);

  // 2. Create KubeBlocks Cluster
  const cluster = {
    apiVersion: 'apps.kubeblocks.io/v1alpha1',
    kind: 'Cluster',
    metadata: {
      name: clusterName,
      namespace,
      labels: {
        'clusterdefinition.kubeblocks.io/name': 'postgresql',
        'clusterversion.kubeblocks.io/name': 'postgresql-14.8.0'
      }
    },
    spec: {
      clusterDefinitionRef: 'postgresql',
      clusterVersionRef: 'postgresql-14.8.0',
      componentSpecs: [{
        componentDefRef: 'postgresql',
        replicas: 1,
        resources: {
          limits: { cpu: '1000m', memory: '1024Mi' },
          requests: { cpu: '100m', memory: '102Mi' }
        },
        volumeClaimTemplates: [{
          spec: {
            accessModes: ['ReadWriteOnce'],
            resources: { requests: { storage: '3Gi' } },
            storageClassName: 'openebs-backup'
          }
        }]
      }]
    }
  };

  // 3. Wait for cluster ready and get credentials
  await this.waitForDatabaseReady(clusterName, namespace);
  return await this.getDatabaseCredentials(clusterName, namespace);
}
```

### 3. Sandbox Management

#### Sandbox Components:
- **Deployment**: Runs the fullstack-web-runtime container
- **Service**: Internal networking for pod access
- **Ingress**: External HTTPS access with SSL termination
- **Environment Variables**: Injected Claude Code API credentials

#### Container Specification:
```yaml
image: fullstackagent/fullstack-web-runtime:latest
ports:
  - 3000  # Next.js application
  - 5000  # Python/Flask
  - 7681  # ttyd web terminal
  - 8080  # General HTTP
resources:
  requests:
    cpu: 20m
    memory: 25Mi
  limits:
    cpu: 200m
    memory: 256Mi
```

#### ttyd Terminal Integration:
Special command override for ttyd compatibility:
```typescript
command: ['/bin/sh']
args: [
  '-c',
  `ttyd --port 7681 --interface 0.0.0.0 --check-origin false /bin/bash`
]
```

### 4. Authentication System

#### NextAuth v5 Configuration:
```typescript
export const authOptions = {
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'read:user user:email repo'
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account && profile) {
        // Store GitHub access token (encrypted)
        token.accessToken = account.access_token;
        token.githubId = profile.id;
      }
      return token;
    },
    async session({ session, token }) {
      // Attach user ID for database queries
      session.user.id = token.sub!;
      return session;
    }
  }
}
```

## Kubernetes Integration

### Namespace Management
- Uses single namespace from kubeconfig: `ns-ajno7yq7`
- No namespace creation permissions required
- All resources tagged with project labels

### Resource Naming Convention
```
[project-name]-agentruntime-[6-char-random]
```
- Ensures uniqueness across deployments
- Allows easy resource filtering
- Supports multiple sandboxes per project

### Label Strategy
Critical labels for resource management:
```yaml
labels:
  cloud.sealos.io/app-deploy-manager: [resource-name]
  project.fullstackagent.io/name: [project-name]
  app: [deployment-name]
```

### Ingress Configuration
Two ingresses per sandbox:
1. **Application Ingress**: Port 3000
2. **Terminal Ingress**: Port 7681 with WebSocket support

```yaml
annotations:
  nginx.ingress.kubernetes.io/proxy-body-size: "32m"
  nginx.ingress.kubernetes.io/ssl-redirect: "false"
  nginx.ingress.kubernetes.io/backend-protocol: "HTTP"
  # For ttyd WebSocket support:
  nginx.ingress.kubernetes.io/proxy-set-headers: |
    Upgrade $http_upgrade
    Connection "upgrade"
```

## Database Management

### Connection String Format
```
postgresql://[username]:[password]@[host]:[port]/[database]?schema=public
```

### Credential Retrieval
KubeBlocks automatically creates secrets with naming pattern:
```
[cluster-name]-conn-credential
```

Secret structure:
```yaml
data:
  host: [base64-encoded]
  port: [base64-encoded]
  database: [base64-encoded]
  username: [base64-encoded]
  password: [base64-encoded]
```

### Database Lifecycle Fix (2025-10-11)
**Problem**: System assumed database exists if `project.databaseUrl` is set
**Solution**: Verify actual cluster existence before using existing database

```typescript
if (project.databaseUrl) {
  try {
    // Try to get database info from Kubernetes
    const dbInfo = await k8sService.getDatabaseSecret(project.name, namespace);
    // Database exists, use it
  } catch (error) {
    // Database doesn't exist, create new one
    needCreateDatabase = true;
  }
}
```

## Sandbox Lifecycle

### Creation Flow
1. **Pre-flight Checks**
   - Verify user authentication
   - Check project ownership
   - Delete existing terminated sandboxes

2. **Database Provisioning**
   - Check if database exists in Kubernetes
   - Create if needed (KubeBlocks cluster)
   - Wait for database ready state
   - Retrieve connection credentials

3. **Sandbox Deployment**
   - Create Kubernetes Deployment
   - Create Service for internal networking
   - Create Ingress for external access
   - Inject environment variables

4. **Post-Creation**
   - Update database records
   - Return public URLs
   - Monitor pod startup status

### Progress Tracking
Five-stage progress indication:
1. **Database Creation**: PostgreSQL provisioning
2. **Container Provisioning**: Deploying runtime pod
3. **Network Configuration**: Setting up services/ingress
4. **Terminal Initialization**: Starting ttyd service
5. **Environment Ready**: Sandbox operational

### Deletion Flow
1. Delete Kubernetes Deployment
2. Delete Service
3. Delete Ingress resources
4. Update database status to "TERMINATED"
5. Keep database for data persistence

## API Design

### RESTful Endpoints

#### Sandbox API
```typescript
// GET /api/sandbox/[projectId]
// Returns sandbox status and URLs

// POST /api/sandbox/[projectId]
// Creates or restarts sandbox
// Body: { envVars: Record<string, string> }

// DELETE /api/sandbox/[projectId]
// Terminates sandbox
```

#### Error Handling
Comprehensive error responses:
```json
{
  "error": "Failed to create sandbox",
  "details": {
    "name": "Error",
    "message": "Detailed error message",
    "stack": "Stack trace (dev only)",
    "kubernetesStatus": "Pod status if available"
  },
  "projectId": "project-id",
  "timestamp": "2025-10-11T10:00:00.000Z"
}
```

## Security Implementation

### Authentication
- GitHub OAuth for user authentication
- Session-based authorization
- Encrypted access token storage

### Kubernetes Security
- ServiceAccount with scoped permissions
- Resource limits to prevent DoS
- Network isolation between sandboxes
- No privileged container access

### Secret Management
```typescript
// Environment variables injection
const containerEnv = {
  ...claudeEnvVars,    // From .secret/.env
  ...projectEnvVars,   // From database
  ...requestEnvVars,   // From API request
  DATABASE_URL: dbConnectionString,
  NODE_ENV: 'development'
};
```

### Input Validation
- Project name sanitization for Kubernetes compatibility
- SQL injection prevention via Prisma ORM
- XSS protection in React components

## Performance Optimizations

### Resource Allocation
Conservative defaults to maximize density:
- CPU: 20m request, 200m limit
- Memory: 25Mi request, 256Mi limit
- Allows ~50 sandboxes per node (2 CPU, 4GB RAM)

### Database Connection Pooling
Prisma connection management:
```typescript
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  log: ['error', 'warn'],
});
```

### Caching Strategy
- KubeBlocks cluster list cached for getDatabaseSecret
- Deployment status cached for 5 seconds
- Static assets cached via Next.js

### Parallel Operations
Multiple tool calls for efficiency:
```typescript
// Parallel deletion of resources
await Promise.all([
  deleteDeployments(projectName),
  deleteServices(projectName),
  deleteIngresses(projectName)
]);
```

## Troubleshooting Guide

### Common Issues and Solutions

#### 1. "Failed to create sandbox" Error
**Symptoms**: Sandbox creation fails immediately
**Causes**:
- Kubeconfig not properly loaded
- Kubernetes API unreachable
- Insufficient permissions

**Solutions**:
```bash
# Verify kubeconfig
cat .secret/kubeconfig | grep server
# Should show: https://usw.sealos.io:6443

# Test API connection
node test-k8s.mjs

# Check logs
npm run dev 2>&1 | grep -E "Error|Failed"
```

#### 2. Database Not Created
**Symptoms**: Sandbox created but no database
**Causes**:
- KubeBlocks CRDs not installed
- Project has stale databaseUrl

**Solutions**:
```javascript
// Check existing clusters
node check-databases.mjs

// Clear stale database URL in database
UPDATE projects SET "databaseUrl" = NULL WHERE name = 'project-name';
```

#### 3. Terminal Not Accessible
**Symptoms**: ttyd URL returns 404 or connection refused
**Causes**:
- ttyd not starting properly
- Ingress misconfiguration
- WebSocket headers missing

**Solutions**:
- Check pod logs for ttyd errors
- Verify ingress has WebSocket annotations
- Ensure port 7681 is exposed

#### 4. Kubernetes API Response Issues
**Symptoms**: "Cannot read property 'items' of undefined"
**Fix Applied**: Handle both response formats
```typescript
const items = response.body?.items || (response as any).items || [];
```

### Debugging Commands

```bash
# Check pod status
kubectl --kubeconfig=.secret/kubeconfig get pods -n ns-ajno7yq7

# View pod logs
kubectl --kubeconfig=.secret/kubeconfig logs [pod-name] -n ns-ajno7yq7

# Describe deployment
kubectl --kubeconfig=.secret/kubeconfig describe deployment [name] -n ns-ajno7yq7

# Check ingress
kubectl --kubeconfig=.secret/kubeconfig get ingress -n ns-ajno7yq7
```

### Log Locations
- Next.js server: Console output
- Kubernetes events: `kubectl get events`
- Pod logs: `kubectl logs [pod-name]`
- Database logs: KubeBlocks cluster logs

## Development Guidelines

### Code Style
- TypeScript strict mode enabled
- ESLint configuration for consistency
- Prettier for formatting

### Testing Strategy
- Unit tests for utilities
- Integration tests for API endpoints
- E2E tests for critical flows

### Git Workflow
1. Feature branches from `main`
2. Pull request with review
3. Squash merge to main
4. Automatic deployment via CI/CD

### Environment Management
```
.env.local          # Local development
.env.production     # Production settings
.secret/.env        # Claude Code credentials
.secret/kubeconfig  # Kubernetes config
```

## Future Enhancements

### Planned Features
1. **Multi-region Support**: Deploy sandboxes across regions
2. **Custom Images**: User-provided Docker images
3. **Persistent Storage**: Volume mounts for data persistence
4. **Collaborative Editing**: Real-time code collaboration
5. **CI/CD Integration**: Automatic deployment pipelines
6. **Resource Scaling**: Dynamic resource allocation
7. **Monitoring Dashboard**: Resource usage visualization
8. **Backup/Restore**: Project state snapshots

### Architecture Improvements
1. **Message Queue**: Async sandbox creation
2. **WebSocket Updates**: Real-time status updates
3. **Distributed Caching**: Redis for session/data caching
4. **Metrics Collection**: Prometheus integration
5. **Log Aggregation**: Centralized logging system

## Conclusion

FullStack Agent represents a modern approach to AI-assisted development, combining the power of Claude Code with Kubernetes orchestration. The architecture prioritizes:

- **Security**: Isolated environments with proper authentication
- **Scalability**: Kubernetes-based resource management
- **Developer Experience**: Seamless project creation and management
- **Reliability**: Comprehensive error handling and recovery

The platform continues to evolve with community feedback and contributions, aiming to make AI-powered development accessible to everyone.

---

*Last Updated: 2025-10-11*
*Version: 1.0.0*