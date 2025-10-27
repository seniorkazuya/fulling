# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**FullstackAgent** is an AI-powered cloud development platform that creates isolated Kubernetes sandbox environments for full-stack development. Each project gets a container with Claude Code CLI pre-installed, accessible via web terminal (ttyd), plus a dedicated PostgreSQL database. The platform automates the entire lifecycle from project creation to deployment.

**Core Value**: Users describe their app idea in natural language, and the platform + Claude Code CLI builds, configures, and deploys a production-ready Next.js application in minutes.

## Development Commands

### Main Application
```bash
npm run dev          # Start dev server on 0.0.0.0:3000 (Sealos deployment)
npm run build        # Build for production
npm start            # Start production server on 0.0.0.0:3000
npm run lint         # Run ESLint
```

### Database
```bash
npx prisma generate  # Generate Prisma client after schema changes
npx prisma db push   # Push schema to database (dev)
npx prisma studio    # Open database GUI
```

### Runtime Image (runtime/)
```bash
cd runtime
./build.sh           # Build Docker image locally
./push-to-dockerhub.sh  # Push to fullstackagent/fullstack-web-runtime
```

**Version Update Process**:
1. Update `runtime/VERSION` file
2. Build and push: `cd runtime && ./push-to-dockerhub.sh`
3. Update `lib/versions.ts` with new image tag
4. Restart main app to pick up new version

## Architecture

### System Layers

**Layer 1: Control Plane (Main App)**
- Next.js 15 + App Router + React 19
- NextAuth v5 (GitHub OAuth)
- Prisma ORM → PostgreSQL
- Manages projects, users, environment variables
- Orchestrates Kubernetes via `lib/kubernetes.ts`

**Layer 2: Kubernetes Orchestration**
- Deployed on Sealos (usw.sealos.io)
- Namespace: `ns-ajno7yq7` (from kubeconfig context)
- Per project: Deployment + Service + 2 Ingresses (app + ttyd) + PostgreSQL cluster
- Resources use pattern: `{k8s-project-name}-agentruntime-{6chars}`

**Layer 3: Runtime Containers**
- Image: `fullstackagent/fullstack-web-runtime:v0.0.1-alpha.9`
- Base: Ubuntu 24.04 + Node.js 22.x
- Includes: Claude Code CLI, ttyd, Next.js, Prisma, PostgreSQL client, Buildah
- Auto-starts Claude Code CLI on terminal connection (via `.bashrc`)

### Key Directories

```
app/                    # Next.js App Router pages and API routes
├── api/
│   ├── projects/      # Project CRUD
│   ├── sandbox/       # Sandbox creation/management
│   └── auth/          # NextAuth routes
lib/
├── kubernetes.ts      # Core K8s service (1067 lines)
├── versions.ts        # Runtime image version (single source of truth)
└── config/
    └── versions.ts    # K8s resource configurations
components/            # React components (Shadcn/UI based)
prisma/
└── schema.prisma      # Database schema (User, Project, Environment, Sandbox)
runtime/               # Docker image for sandbox environments
yaml/                  # K8s YAML templates and examples
docs/
├── prompt/            # Technical documentation
└── iteration/         # Version release notes
```

## Critical Implementation Details

### KubernetesService (lib/kubernetes.ts)

**Core Methods**:
- `createPostgreSQLDatabase()` - Creates KubeBlocks PostgreSQL cluster with RBAC
- `createSandbox()` - Deploys runtime container with environment injection
- `startSandbox()` / `stopSandbox()` - Scale replicas 1/0
- `deleteSandbox()` - Removes all K8s resources for project
- `getDatabaseSecret()` - Retrieves credentials from `{cluster}-conn-credential` secret
- `getSandboxStatus()` - Returns RUNNING/STOPPED/CREATING/TERMINATED/ERROR
- `updateDeploymentEnvVars()` - Updates env vars and triggers pod restart

**Kubeconfig Loading** (CRITICAL):
```typescript
// Checks both current and parent directory
let kubeconfigPath = path.join(process.cwd(), '.secret', 'kubeconfig');
if (!fs.existsSync(kubeconfigPath)) {
  kubeconfigPath = path.join(process.cwd(), '..', '.secret', 'kubeconfig');
}
```

**Environment Variable Injection**:
Sandboxes receive merged env vars:
1. Claude Code vars from `.secret/.env` (ANTHROPIC_API_KEY, etc.)
2. User-defined vars from Environment model
3. Auto-injected: DATABASE_URL, PROJECT_NAME, TTYD_PORT=7681, NODE_ENV=development

**API Response Pattern** (CRITICAL BUG FIX):
```typescript
// Kubernetes client API varies by version
// ALWAYS check both patterns:
const items = response.body?.items || (response as any).items || [];
const data = response.body?.data || (response as any).data;
```

### Resource Naming Convention

Project name `My Blog!` becomes:
1. **K8s name**: `myblog` (lowercase, alphanumeric only, max 20 chars)
2. **Deployment**: `myblog-agentruntime-abc123` (6-char random suffix)
3. **Service**: `myblog-agentruntime-abc123-service`
4. **Database**: `myblog-agentruntime-abc123` (KubeBlocks cluster)
5. **Ingresses**: Random 12-char domain names
   - App: `https://xyz123abc456.usw.sealos.io` (port 3000)
   - Terminal: `https://abc456xyz123.usw.sealos.io` (port 7681)

**Label Strategy** (CRITICAL for Sealos):
```yaml
labels:
  cloud.sealos.io/app-deploy-manager: {deployment-name}  # Required by Sealos
  project.fullstackagent.io/name: {k8s-project-name}     # Our tracking
  app: {deployment-name}                                  # Pod selector
```

### Database Schema (prisma/schema.prisma)

**User**:
- `githubToken` - For GitHub API operations
- `systemPrompt` - Custom Claude Code system prompt (optional)
- `kubeconfig` - User-specific K8s config (future feature)

**Project**:
- `status` - PENDING → INITIALIZING → READY → DEPLOYING → DEPLOYED
- `databaseUrl` - Connection string (may be stale, always verify in K8s)
- `githubRepo` - Associated GitHub repository

**Environment**:
- `key/value` - Environment variables
- `category` - auth/payment/general (for UI organization)
- `isSecret` - Marks sensitive values (masked in UI)

**Sandbox**:
- `k8sDeploymentName` - Actual deployment name in K8s
- `publicUrl` / `ttydUrl` - Generated ingress URLs
- `status` - CREATING → RUNNING ↔ STOPPED → TERMINATED
- `dbHost/dbPort/dbName/dbUser/dbPassword` - Database credentials

### Database Creation Flow

**KubeBlocks PostgreSQL**:
1. Create ServiceAccount with labels
2. Create Role (full permissions in namespace)
3. Create RoleBinding
4. Create KubeBlocks Cluster resource
   - Definition: `postgresql`
   - Version: `postgresql-14.8.0`
   - Storage: 3Gi on `openebs-backup` class
   - Resources: 100m-1000m CPU, 102Mi-1024Mi memory
5. Wait for cluster phase = "Running" (2-3 minutes)
6. Read credentials from secret: `{clusterName}-conn-credential`

**Connection String Format**:
```
postgresql://{username}:{password}@{host}:{port}/{database}?schema=public
```

**Credential Secret Structure** (base64 encoded):
```yaml
data:
  host: base64(hostname)
  port: base64(5432)
  database: base64(postgres)
  username: base64(postgres)
  password: base64(generated-password)
```

### Sandbox Deployment Spec

**Deployment Configuration**:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {project}-agentruntime-{suffix}
  annotations:
    originImageName: fullstackagent/fullstack-web-runtime:v0.0.1-alpha.9
    deploy.cloud.sealos.io/minReplicas: "1"
    deploy.cloud.sealos.io/maxReplicas: "1"
spec:
  replicas: 1
  template:
    spec:
      containers:
      - name: {deployment-name}
        image: fullstackagent/fullstack-web-runtime:v0.0.1-alpha.9
        ports:
        - containerPort: 3000  # Next.js
        - containerPort: 5000  # Flask/Python
        - containerPort: 7681  # ttyd terminal
        - containerPort: 8080  # General HTTP
        resources:
          requests: { cpu: 20m, memory: 25Mi }
          limits: { cpu: 200m, memory: 256Mi }
        env:
        - name: DATABASE_URL
          value: postgresql://...
        - name: ANTHROPIC_API_KEY
          value: {from .secret/.env}
        - name: PROJECT_NAME
          value: {project-name}
        - name: TTYD_PORT
          value: "7681"
```

**ttyd WebSocket Ingress** (CRITICAL):
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  annotations:
    kubernetes.io/ingress.class: nginx
    nginx.ingress.kubernetes.io/ssl-redirect: "false"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "300"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "300"
    # WebSocket support:
    nginx.ingress.kubernetes.io/proxy-set-headers: |
      Upgrade $http_upgrade
      Connection "upgrade"
spec:
  tls:
  - hosts: [{domain}.usw.sealos.io]
    secretName: wildcard-cert
  rules:
  - host: {domain}.usw.sealos.io
    http:
      paths:
      - path: /
        backend:
          service:
            name: {service-name}
            port: { number: 7681 }
```

## API Routes

### Sandbox Management
- `POST /api/sandbox/[projectId]` - Create sandbox (DB + container deployment)
- `POST /api/projects/[id]/sandbox/start` - Start stopped sandbox
- `POST /api/projects/[id]/sandbox/stop` - Stop running sandbox
- `GET /api/projects/[id]/sandbox/status` - Get current status
- `POST /api/projects/[id]/sync-database` - Update deployment env vars

### Project Management
- `GET /api/projects` - List user's projects
- `POST /api/projects` - Create project
- `GET /api/projects/[id]` - Get project details
- `DELETE /api/projects/[id]` - Delete project

### Environment Variables
- `GET /api/projects/[id]/environment` - List env vars
- `POST /api/projects/[id]/environment` - Add env var
- `PUT /api/projects/[id]/environment/[envId]` - Update env var
- `DELETE /api/projects/[id]/environment/[envId]` - Delete env var

### GitHub Integration
- `POST /api/projects/[id]/github` - Link GitHub repository

## Common Development Patterns

### Testing Sandbox Creation Locally
```bash
# 1. Set up secrets
mkdir -p .secret
# Add kubeconfig for Sealos cluster
# Add .env with ANTHROPIC_API_KEY, etc.

# 2. Set DATABASE_URL in .env.local for main app

# 3. Push Prisma schema
npx prisma db push

# 4. Start dev server
npm run dev

# 5. Create project via UI or API
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name":"test-project","description":"Test"}'
```

### Debugging Kubernetes Resources
```bash
# Set kubeconfig
export KUBECONFIG=.secret/kubeconfig

# Check deployments
kubectl get deployments -n ns-ajno7yq7 | grep {project-name}

# Check pods
kubectl get pods -n ns-ajno7yq7 -l app={deployment-name}

# Pod logs
kubectl logs -n ns-ajno7yq7 {pod-name}

# Check database cluster
kubectl get cluster -n ns-ajno7yq7 | grep {project-name}

# Get database credentials
kubectl get secret -n ns-ajno7yq7 {cluster-name}-conn-credential -o yaml

# Check ingresses
kubectl get ingress -n ns-ajno7yq7 | grep {project-name}

# Describe resource for events
kubectl describe deployment -n ns-ajno7yq7 {deployment-name}
```

### Updating Environment Variables
After adding/updating Environment records:
```typescript
// Trigger deployment update to inject new env vars
await fetch(`/api/projects/${projectId}/sync-database`, { method: 'POST' });
// This calls updateDeploymentEnvVars() which triggers pod restart
```

## Critical Issues & Solutions

### Issue 1: Database Not Found
**Symptom**: "No database cluster found for project X"
**Cause**: `project.databaseUrl` set but cluster doesn't exist in K8s
**Solution**: Always verify cluster exists before using `project.databaseUrl`:
```typescript
if (project.databaseUrl) {
  try {
    await k8sService.getDatabaseSecret(project.name, namespace);
    // Database exists
  } catch {
    // Create new database
    needCreateDatabase = true;
  }
}
```

### Issue 2: Kubernetes API Response Variations
**Symptom**: "Cannot read property 'items' of undefined"
**Cause**: API client returns either `response.body.items` or `response.items`
**Solution**: Always check both patterns (applied throughout kubernetes.ts)

### Issue 3: ttyd Terminal Blank/Disconnected
**Symptom**: Terminal URL loads but shows blank or disconnects
**Causes**:
- Missing WebSocket annotations on ingress
- Pod not running (check logs)
- ttyd process failed to start

**Solutions**:
- Verify ingress has proxy-set-headers for WebSocket upgrade
- Check pod logs: `kubectl logs {pod-name} -n ns-ajno7yq7`
- Ensure TTYD_PORT=7681 env var is set
- Verify entrypoint.sh executes: `ttyd -W bash`

### Issue 4: Sandbox Creation Timeout
**Symptom**: Database or pod creation hangs
**Cause**: Resource constraints or pending state
**Debug**:
```bash
# Check pod events
kubectl describe pod {pod-name} -n ns-ajno7yq7

# Check cluster status
kubectl get cluster {cluster-name} -n ns-ajno7yq7 -o yaml

# Look for:
# - ImagePullBackOff (wrong image tag)
# - Pending (resource limits)
# - CrashLoopBackOff (startup failure)
```

### Issue 5: Environment Variables Not Applied
**Symptom**: New env vars not showing in sandbox
**Solution**: Must call sync-database endpoint to trigger deployment update
```typescript
// After updating Environment records:
await k8sService.updateDeploymentEnvVars(projectName, namespace, envVars);
// This replaces the deployment spec and triggers pod restart
```

## Development Best Practices

### Project Name Handling
```typescript
// ALWAYS sanitize project names for Kubernetes:
const k8sProjectName = projectName
  .toLowerCase()
  .replace(/[^a-z0-9-]/g, '')
  .substring(0, 20);

// Use k8sProjectName for all K8s resource operations
```

### Resource Lifecycle
- **Stop vs Delete**: Stop scales to 0 replicas (preserves config), Delete removes resources
- **Database Persistence**: Databases are NOT deleted with sandbox (only on project deletion)
- **Random Suffixes**: 6-char suffix ensures unique resource names across sandbox recreations

### Version Management
**Single source of truth**: `lib/versions.ts`
```typescript
export function getRuntimeImage(): string {
  return 'fullstackagent/fullstack-web-runtime:v0.0.1-alpha.9';
}
```
Never hardcode image tags elsewhere. Always import from this file.

### Error Handling
```typescript
// Good: Detailed error with context
throw new Error(`Failed to create sandbox for ${projectId}: ${error.message}`);

// Bad: Generic error
throw new Error('Failed to create sandbox');
```

### Async Operations
```typescript
// Use parallel operations when possible:
await Promise.all([
  deleteDeployments(projectName),
  deleteServices(projectName),
  deleteIngresses(projectName)
]);

// But respect dependencies:
const dbInfo = await createDatabase(projectName);  // Must finish first
const sandbox = await createSandbox(projectName, dbInfo);  // Uses db credentials
```

## Runtime Image (runtime/)

**Contents**: Ubuntu 24.04 + Node.js 22 + Claude Code CLI + ttyd + development tools

**Auto-start Behavior** (`.bashrc`):
```bash
if [ ! -f "/tmp/.claude_started" ]; then
    touch "/tmp/.claude_started"
    echo "🤖 Starting Claude Code CLI..."
    claude
fi
```

**Exposed Ports**:
- 3000: Next.js dev server
- 3001: Alternative dev port
- 5000: Python/Flask
- 5173: Vite
- 7681: ttyd web terminal
- 8080: General HTTP

## Important Notes

- **Namespace**: No create permission - must use `ns-ajno7yq7` from kubeconfig
- **Deployment Domain**: Main app listens on `0.0.0.0:3000` (not localhost) for Sealos
- **Database Wait Time**: PostgreSQL cluster takes 2-3 minutes to reach "Running" state
- **Resource Quotas**: Conservative limits (20m CPU, 25Mi memory) allow high density
- **Ingress TLS**: Uses wildcard cert `wildcard-cert` secret for all *.usw.sealos.io domains
- **Stop/Start**: Preserves all data and configuration, only changes replica count

## Future Features (docs/iteration/v0.1.0.md)

Planned enhancements:
- Network config UI (port mapping, CNAME records)
- Auth provider setup (GitHub, Google OAuth configs)
- Payment integration (Stripe, PayPal)
- Enhanced GitHub integration (auto-create repos, commit changes)
- Deployment automation (GitHub Actions → Sealos)
- Custom domain mapping

## Key Files for Understanding

1. `lib/kubernetes.ts` - All K8s orchestration (1067 lines, most important)
2. `lib/versions.ts` - Runtime image version (source of truth)
3. `app/api/sandbox/[projectId]/route.ts` - Sandbox creation API flow
4. `prisma/schema.prisma` - Data models
5. `runtime/Dockerfile` - Container environment definition
6. `docs/prompt/TECHNICAL_DOCUMENTATION.md` - Detailed architecture
7. `RUNTIME_WORKFLOW.md` - Complete workflow documentation (Chinese)
