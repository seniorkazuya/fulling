# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an **AI Full-Stack Engineering Agent Platform** built with Next.js, PostgreSQL, and Kubernetes. The platform enables users to create, develop, and deploy full-stack web applications through natural language interaction with AI agents.

## Core Technology Stack

- **Framework**: Next.js 15.5.4 (App Router)
- **Database**: PostgreSQL with Prisma ORM
- **UI Components**: Shadcn/UI with Tailwind CSS v4
- **Authentication**: NextAuth v5 with GitHub OAuth
- **Container Orchestration**: Kubernetes API integration
- **Development Runtime**: Docker-based fullstack-web-runtime image
- **Web Terminal**: ttyd for browser-based terminal access

## Development Commands

```bash
# Install dependencies
npm install

# Run development server (listens on 0.0.0.0:3000)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint

# Database migrations
npx prisma generate    # Generate Prisma client
npx prisma db push     # Push schema changes to database
npx prisma studio      # Open Prisma Studio GUI
```

## Project Architecture

### Directory Structure
- `/app` - Next.js App Router pages and API routes
- `/lib` - Core service modules (database, auth, Kubernetes, GitHub)
- `/prisma` - Database schema and migrations
- `/yaml` - Kubernetes YAML templates for database and sandbox deployments
- `/.secret` - Sensitive configuration files (kubeconfig, environment variables)
- `/fullstack-agent` - Main Next.js application code

### Key Service Modules

1. **KubernetesService** (`/lib/kubernetes.ts`):
   - Manages Kubernetes resources (pods, services, ingresses)
   - Creates PostgreSQL databases for projects
   - Deploys sandbox environments with fullstack-web-runtime
   - Handles environment variable injection from `.secret/.env`

2. **Authentication** (`/lib/auth.ts`):
   - GitHub OAuth integration
   - User session management with NextAuth

3. **Database** (`/lib/db.ts`):
   - Prisma client configuration
   - Database connection management

4. **GitHub Integration** (`/lib/github.ts`):
   - Repository creation and management
   - Code commit functionality

### Database Schema

Key models defined in `/prisma/schema.prisma`:
- **User**: GitHub-authenticated users with projects
- **Project**: User projects with status tracking
- **Environment**: Project-specific environment variables (auth, payment, general)
- **Sandbox**: Kubernetes deployment information for project sandboxes

## Critical Implementation Details

### Environment Configuration

1. **Main Application** (`.env.local`):
   - `DATABASE_URL`: PostgreSQL connection string
   - `GITHUB_CLIENT_ID/SECRET`: GitHub OAuth credentials
   - `NEXTAUTH_URL`: Application URL (https://dgkwlntjskms.usw.sealos.io:3000)
   - `KUBECONFIG_PATH`: Path to Kubernetes config (`./.secret/kubeconfig`)

2. **Claude Code Environment** (`.secret/.env`):
   - Contains ANTHROPIC API credentials for Claude Code CLI
   - Automatically injected into sandbox containers

### Kubernetes Integration

⚠️ **IMPORTANT**: Kubernetes cluster is already provisioned. DO NOT attempt to create a new cluster.

- **Kubeconfig Location**: `.secret/kubeconfig` (MUST use this existing configuration)
- **Namespace**: Uses `ns-ajno7yq7` (from kubeconfig, no create namespace permissions)
- **Cluster**: Pre-configured cluster - use existing connection from kubeconfig
- **Sandbox Image**: `fullstackagent/fullstack-web-runtime:latest`
- **Exposed Ports**:
  - 3000 (Next.js app)
  - 7681 (ttyd web terminal)
  - 5000 (Python/Flask)
  - 8080 (General HTTP)

### Sandbox Deployment Process

1. Creates PostgreSQL database via StatefulSet
2. Deploys sandbox container with environment variables
3. Configures Service for internal networking
4. Sets up Ingress for public access with SSL
5. Returns URLs:
   - App: `https://sandbox-{projectId}.dgkwlntjskms.usw.sealos.io`
   - Terminal: `https://sandbox-{projectId}-ttyd.dgkwlntjskms.usw.sealos.io`

## User Workflow Implementation

Based on `/prompt.md`, the core user flow:

1. User creates a project
2. System provisions PostgreSQL database via Kubernetes API
3. System creates isolated sandbox with fullstack-web-runtime
4. **Enhanced**: Detailed progress indication during sandbox creation with 5 stages:
   - **Database Creation**: PostgreSQL database provisioning with KubeBlocks
   - **Container Provisioning**: Deploying fullstack-web-runtime pod with resources
   - **Network Configuration**: Setting up services and ingress for public access
   - **Terminal Initialization**: Starting ttyd web terminal service
   - **Environment Ready**: Sandbox fully operational and ready for development
5. Web terminal opens with Claude Code CLI
6. User inputs requirements for Claude to implement
7. Code commits to GitHub repository
8. Application accessible via public URL

### UX Improvements (2025-10-11)

**Problem Solved**: Users previously experienced "点击创建 Sandbox 之后直接跳转回创建页面了，需要等待直到创建成功打开 terminal， 可以展示一下中间创建过程，防止用户盲目等待"

**Solution Implemented**:
- **SandboxProgress Component** (`/components/sandbox-progress.tsx`): Real-time progress tracking with detailed stages
- **Enhanced Terminal Component**: Integrated progress display during sandbox creation
- **Intelligent Polling**: 2-second intervals with stage progression based on elapsed time
- **Visual Feedback**: Icons, colors, and descriptions for each stage
- **Time Tracking**: Shows elapsed time and duration for completed stages
- **Error Handling**: Clear error indication with specific stage failure information

**Key Features**:
- Progress stages with status indicators (pending, in_progress, completed, error)
- Smooth transitions between stages with appropriate timing
- Educational content explaining what's happening during creation
- Seamless transition from progress view to terminal iframe when ready

## Important Constraints

1. **No namespace creation**: Use existing namespace from kubeconfig
2. **Remote development**: Application must listen on `0.0.0.0:3000`
3. **External domain**: `https://dgkwlntjskms.usw.sealos.io`
4. **Docker runtime**: Fullstack-web-runtime image includes all necessary tools

## Critical Configuration Requirements

### ⚠️ Kubernetes Client Configuration (CRITICAL)

**NEVER use localhost:8080 for Kubernetes API calls!**

The Kubernetes client MUST properly load the kubeconfig file to connect to the correct cluster endpoint. Common issues:

- **Wrong**: `http://localhost:8080/api/v1/...` (default fallback)
- **Correct**: `https://usw.sealos.io:6443/api/v1/...` (from kubeconfig)

**Root Cause**: If kubeconfig loading fails silently, the client falls back to default localhost:8080, causing all API calls to fail with ECONNREFUSED.

**Required Implementation**:
```typescript
// Load kubeconfig with proper error handling and verification
const kubeconfigPath = path.join(process.cwd(), '.secret', 'kubeconfig');
if (fs.existsSync(kubeconfigPath)) {
  this.kc.loadFromFile(kubeconfigPath);
  const cluster = this.kc.getCurrentCluster();

  // CRITICAL: Verify correct server endpoint
  if (!cluster?.server || cluster.server.includes('localhost')) {
    throw new Error(`Invalid server endpoint: ${cluster?.server}`);
  }
} else {
  throw new Error(`Kubeconfig file not found at: ${kubeconfigPath}`);
}
```

**Debugging Steps**:
1. Check kubeconfig file exists at `.secret/kubeconfig`
2. Verify server endpoint in logs: should be `https://usw.sealos.io:6443`
3. Ensure namespace is `ns-ajno7yq7` from kubeconfig context
4. Never fall back to `loadFromDefault()` - it uses localhost

## YAML Template Compliance (CRITICAL)

### ⚠️ Kubernetes Resource Creation Requirements

**ALWAYS follow the YAML templates in `/yaml` directory!**

The `/yaml/README.md` states: "调用 K8s 接口创建 deployment service ingress 等对象时，时严格参考本目录下面的 yaml 文件，不能省略里面的重要信息，比如 label 信息和其它字段，除了一些必要字段有变化之外其他通用内容都需要保留。"

### Database Creation (KubeBlocks)

**Wrong**: Using StatefulSet/PVC directly
**Correct**: Using KubeBlocks Cluster resource

```typescript
// Must use KubeBlocks Cluster (apps.kubeblocks.io/v1alpha1)
// with proper ServiceAccount, Role, RoleBinding
// Reference: yaml/database/cluster.yaml, yaml/database/account.yaml
```

Required steps:
1. Create ServiceAccount with labels: `sealos-db-provider-cr`, `app.kubernetes.io/instance`, `app.kubernetes.io/managed-by`
2. Create Role with full permissions (`apiGroups: ['*']`)
3. Create RoleBinding linking ServiceAccount to Role
4. Create KubeBlocks Cluster with proper affinity, resources, and storage class

### Database Credential Retrieval

**KubeBlocks Database Password Access**:

After creating a KubeBlocks database cluster, connection credentials are automatically stored in a Kubernetes Secret with the naming pattern: `[cluster-name]-conn-credential`.

**Implementation Example**:
```typescript
// Get database credentials from KubeBlocks-generated secret
const secretName = `${clusterName}-conn-credential`;
const secret = await this.k8sApi.readNamespacedSecret({ name: secretName, namespace });

// Decode base64 credentials
const credentials = {
  host: Buffer.from(secret.data!['host'], 'base64').toString(),
  port: parseInt(Buffer.from(secret.data!['port'], 'base64').toString()),
  database: Buffer.from(secret.data!['database'], 'base64').toString(),
  username: Buffer.from(secret.data!['username'], 'base64').toString(),
  password: Buffer.from(secret.data!['password'], 'base64').toString(),
};
```

**Secret Structure Example**:
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: fullstackagent-conn-credential
  namespace: ns-ajno7yq7
data:
  endpoint: [base64-encoded-endpoint]
  host: [base64-encoded-host]
  password: [base64-encoded-password]
  port: [base64-encoded-port]
  username: [base64-encoded-username]
type: Opaque
```

**Important Notes**:
- All credential fields are base64-encoded in the Secret
- The secret is automatically created by KubeBlocks after cluster provisioning
- Secret name format: `{clusterName}-conn-credential`
- Always check if secret exists before accessing, as it may take time to be created

### Sandbox Deployment (Sealos Platform)

**Critical Labels and Annotations**:
- `cloud.sealos.io/app-deploy-manager`: Resource name (REQUIRED on all resources)
- `originImageName`: Original container image annotation
- `deploy.cloud.sealos.io/minReplicas`, `maxReplicas`, `resize`: Sealos scaling annotations

**Naming Convention**:
- Format: `[project-name]-agentruntime-[6位随机数]`
- Port names: 12-character random strings (lowercase letters)
- Domain names: 12-character random strings (lowercase letters)

**Ingress Requirements**:
- One Ingress per exposed port
- Use `wildcard-cert` for TLS (not auto-generated certificates)
- Domains: `{random-12-chars}.usw.sealos.io`
- Labels: `cloud.sealos.io/app-deploy-manager-domain`
- Specific nginx annotations for proxy settings and WebSocket support

**Resource Limits** (from YAML templates):
```yaml
requests:
  cpu: 20m
  memory: 25Mi
limits:
  cpu: 200m
  memory: 256Mi
```

### Web Terminal (ttyd) Configuration

For ttyd to work properly:
1. Container command override to fix ttyd startup options
2. Separate Ingress with WebSocket support
3. Annotations: `nginx.ingress.kubernetes.io/proxy-set-headers` for WebSocket
4. Port 7681 exposure with random port name

## Common Tasks

### Adding Environment Variables to Sandbox
Modify the `containerEnv` object in `KubernetesService.createSandbox()` method

### Updating Sandbox Resources
Edit the `resources` section in the deployment spec (memory/CPU limits)

### Adding New Database Models
1. Update `/prisma/schema.prisma`
2. Run `npx prisma generate`
3. Run `npx prisma db push`

### Debugging Kubernetes Deployments
Check deployment status using `k8sService.getSandboxStatus()` method

## Security Considerations

- GitHub OAuth tokens stored encrypted in database
- Kubernetes secrets used for database passwords
- Environment variables injected via ConfigMaps
- SSL/TLS enforced via Ingress annotations
- CORS configured for ttyd web terminal access