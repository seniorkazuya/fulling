# CLAUDE.md

AI Full-Stack Engineering Agent Platform built with Next.js, PostgreSQL, and Kubernetes.

## Core Technology Stack

- **Framework**: Next.js 15.5.4 (App Router)
- **Database**: PostgreSQL with Prisma ORM
- **UI**: Shadcn/UI with Tailwind CSS v4
- **Authentication**: NextAuth v5 with GitHub OAuth
- **Container Orchestration**: Kubernetes API integration
- **Development Runtime**: Docker-based fullstack-web-runtime
- **Web Terminal**: ttyd for browser-based terminal access

## Development Commands

```bash
npm install           # Install dependencies
npm run dev          # Development server (0.0.0.0:3000)
npm run build        # Build for production
npx prisma generate  # Generate Prisma client
npx prisma db push   # Push schema changes to database
```

## Project Architecture

### Directory Structure
```
/fullstack-agent/
  ├── /app/          # Next.js App Router pages and API routes
  ├── /components/   # React components
  ├── /lib/          # Core service modules
  ├── /prisma/       # Database schema
  ├── /yaml/         # Kubernetes YAML templates
  /.secret/          # Sensitive configuration files
```

### Key Services
- **KubernetesService** (`/lib/kubernetes.ts`): Manages K8s resources, PostgreSQL via KubeBlocks, sandbox deployments
- **Authentication** (`/lib/auth.ts`): GitHub OAuth, session management
- **Database** (`/lib/db.ts`): Prisma client configuration
- **GitHub Integration** (`/lib/github.ts`): Repository management and commits

### Database Schema
Key models in `/prisma/schema.prisma`:
- **User**: GitHub-authenticated users (`id`, `email`, `githubId`, `githubToken`)
- **Project**: User projects (`id`, `name`, `status`, `githubRepo`, `databaseUrl`)
- **Environment**: Environment variables (`key`, `value`, `category`, `isSecret`)
- **Sandbox**: Kubernetes deployments (`k8sNamespace`, `publicUrl`, `ttydUrl`, `status`)

## Critical Implementation Details

### Kubernetes Integration
⚠️ **IMPORTANT**: Cluster is already provisioned. DO NOT create new cluster.

**Configuration:**
- **Kubeconfig**: `.secret/kubeconfig` (MUST use existing config)
- **Namespace**: `ns-ajno7yq7` (from kubeconfig)
- **API Server**: `https://usw.sealos.io:6443`
- **Sandbox Image**: `fullstackagent/fullstack-web-runtime:v0.0.1-alpha.8`

**Critical Rules:**
- NEVER use localhost:8080 for Kubernetes API calls
- ALWAYS follow YAML templates in `/yaml` directory
- Required labels: `cloud.sealos.io/app-deploy-manager`, `app.kubernetes.io/instance`, `app.kubernetes.io/managed-by`

### Environment Configuration
**Main Application** (`.env.local`):
```env
DATABASE_URL=postgresql://...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
NEXTAUTH_URL=https://dgkwlntjskms.usw.sealos.io:3000
NEXTAUTH_SECRET=...
KUBECONFIG_PATH=./.secret/kubeconfig
```

### Sandbox Deployment Process
1. Database Creation via KubeBlocks Cluster
2. Deploy fullstack-web-runtime pod
3. Setup Service and Ingress
4. Initialize ttyd service
5. Return public URLs

**Generated URLs:**
- App: `https://sandbox-{projectId}.dgkwlntjskms.usw.sealos.io`
- Terminal: `https://sandbox-{projectId}-ttyd.dgkwlntjskms.usw.sealos.io`

### ttyd Configuration
- Startup command: `ttyd -W bash`
- Port: 7681
- Separate Ingress with WebSocket annotations

## Development Principles

### Isolated Feature Modification
在改一块功能的时候尽量不要影响别的正常功能，除非有依赖关系。

1. Scope changes carefully
2. Check dependencies
3. Minimize side effects
4. Test adjacent features

### Docker Image Management
**NEVER build images locally!** Use GitHub Actions:
- Workflow: `.github/workflows/build-runtime-manual.yml`
- Repository: `fullstackagent/fullstack-web-runtime`

## Common Development Tasks

| Task | Command/Location |
|------|-----------------|
| Add environment variables | Modify `KubernetesService.createSandbox()` |
| Update resources | Edit deployment spec in service |
| Add database models | Update schema.prisma → generate → push |
| Debug deployments | Use `k8sService.getSandboxStatus()` |
| Check logs | Use `kubectl logs` with kubeconfig |

## Troubleshooting

### Common Issues
1. **Kubernetes API Connection Failed**
   - Check kubeconfig at `.secret/kubeconfig`
   - Verify server endpoint is not localhost
   - Ensure namespace matches kubeconfig

2. **Terminal Not Loading**
   - Check ttyd pod status
   - Verify Ingress WebSocket annotations
   - Ensure correct ttyd URL format

3. **Database Connection Issues**
   - Wait for KubeBlocks Secret creation
   - Check Secret name: `{cluster}-conn-credential`
   - Verify base64 credential decoding

## Security
- OAuth tokens: Encrypted storage in database
- Database passwords: Kubernetes Secrets
- Environment variables: Secure injection via deployment spec
- SSL/TLS: Enforced via Ingress annotations