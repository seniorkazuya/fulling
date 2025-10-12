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
```
/fullstack-agent/           # Main application root
  ├── /app/                # Next.js App Router pages and API routes
  │   ├── /api/           # API endpoints
  │   └── /projects/      # Project management pages
  ├── /components/        # React components
  │   ├── /ui/           # Shadcn/UI base components
  │   └── ...            # Feature-specific components
  ├── /lib/              # Core service modules
  ├── /prisma/           # Database schema and migrations
  └── /yaml/             # Kubernetes YAML templates
/.secret/                  # Sensitive configuration files
/runtime/                  # Docker runtime configuration
```

### Key Service Modules

1. **KubernetesService** (`/lib/kubernetes.ts`):
   - Manages Kubernetes resources (pods, services, ingresses)
   - Creates PostgreSQL databases using KubeBlocks
   - Deploys sandbox environments with fullstack-web-runtime
   - Handles environment variable injection

2. **Authentication** (`/lib/auth.ts`):
   - GitHub OAuth integration
   - User session management with NextAuth v5
   - Protected route handling

3. **Database** (`/lib/db.ts`):
   - Prisma client configuration
   - Database connection management

4. **GitHub Integration** (`/lib/github.ts`):
   - Repository creation and management
   - Code commit functionality
   - Pull request automation

### Database Schema

Key models defined in `/prisma/schema.prisma`:

| Model | Description | Key Fields |
|-------|-------------|------------|
| **User** | GitHub-authenticated users | `id`, `email`, `githubId`, `githubToken` |
| **Project** | User projects | `id`, `name`, `status`, `githubRepo`, `databaseUrl` |
| **Environment** | Environment variables | `key`, `value`, `category`, `isSecret` |
| **Sandbox** | Kubernetes deployments | `k8sNamespace`, `publicUrl`, `ttydUrl`, `status` |

### Environment Variable Management

The platform uses a multi-layered approach for environment variables:

1. **Categories**:
   - `general`: User-defined custom variables
   - `auth`: OAuth configuration (managed separately)
   - `payment`: Payment integration (managed separately)
   - `database`: Database connection (auto-generated)

2. **Storage Locations**:
   - Database: `Environment` model stores all variables
   - Kubernetes: Injected into pods via deployment spec
   - UI: Separate configuration pages for each category

3. **Recent Simplification** (2025-10-12):
   - Environment variables page now shows simple key-value pairs
   - Removed complex secret management UI
   - Auth/payment/database have dedicated configuration pages

## Critical Implementation Details

### Environment Configuration

1. **Main Application** (`.env.local`):
   ```env
   DATABASE_URL=postgresql://...
   GITHUB_CLIENT_ID=...
   GITHUB_CLIENT_SECRET=...
   NEXTAUTH_URL=https://dgkwlntjskms.usw.sealos.io:3000
   NEXTAUTH_SECRET=...
   KUBECONFIG_PATH=./.secret/kubeconfig
   ```

2. **Claude Code Environment** (`.secret/.env`):
   - Contains ANTHROPIC API credentials
   - Automatically injected into sandbox containers

### Kubernetes Integration

⚠️ **IMPORTANT**: Kubernetes cluster is already provisioned. DO NOT attempt to create a new cluster.

**Configuration Details:**
- **Kubeconfig**: `.secret/kubeconfig` (MUST use this existing configuration)
- **Namespace**: `ns-ajno7yq7` (from kubeconfig, no create namespace permissions)
- **API Server**: `https://usw.sealos.io:6443`
- **Sandbox Image**: `fullstackagent/fullstack-web-runtime:v0.0.1-alpha.6`

**Exposed Ports:**
| Port | Service | Description |
|------|---------|-------------|
| 3000 | Next.js | Primary application |
| 7681 | ttyd | Web terminal |
| 5000 | Python/Flask | Python applications |
| 8080 | General HTTP | Other services |

### Sandbox Deployment Process

1. **Database Creation**: PostgreSQL via KubeBlocks Cluster
2. **Container Provisioning**: Deploy fullstack-web-runtime pod
3. **Network Configuration**: Setup Service and Ingress
4. **Terminal Initialization**: Start ttyd service
5. **Environment Ready**: Return public URLs

**Generated URLs:**
- App: `https://sandbox-{projectId}.dgkwlntjskms.usw.sealos.io`
- Terminal: `https://sandbox-{projectId}-ttyd.dgkwlntjskms.usw.sealos.io`

## User Workflow Implementation

### Standard Development Flow

1. **Project Creation**
   - User creates new project with name/description
   - System initializes project record in database

2. **Sandbox Provisioning**
   - User clicks "Create Sandbox"
   - System shows detailed progress (5 stages)
   - Database and container are provisioned

3. **Development**
   - Web terminal opens with Claude Code CLI
   - User inputs requirements in natural language
   - Claude implements the application

4. **Deployment**
   - Code commits to GitHub repository
   - Application accessible via public URL

### Configuration Management

**Recent UX Improvements** (2025-10-12):

The configuration system has been redesigned for clarity and consistency:

1. **Unified Configuration Pages**:
   - All configuration moved from sidebar to main display area
   - Each configuration type has a dedicated page
   - No nested interactions in secondary sidebar

2. **Configuration Pages**:
   - `/projects/[id]/environment`: Simple key-value environment variables
   - `/projects/[id]/auth`: OAuth provider configuration
   - `/projects/[id]/payment`: Payment integration settings
   - `/projects/[id]/database`: Database connection details
   - `/projects/[id]/github`: Repository management
   - `/projects/[id]/terminal`: Web terminal access

3. **Environment Variable Display**:
   - Shows environment variable names alongside values
   - Copy buttons for both variable names and values
   - Clear separation between different variable categories

## Technical Requirements and Constraints

### ⚠️ Kubernetes Client Configuration

**CRITICAL**: Never use localhost:8080 for Kubernetes API calls!

```typescript
// Correct implementation
const kubeconfigPath = path.join(process.cwd(), '.secret', 'kubeconfig');
if (fs.existsSync(kubeconfigPath)) {
  this.kc.loadFromFile(kubeconfigPath);
  const cluster = this.kc.getCurrentCluster();

  // Verify correct endpoint
  if (!cluster?.server || cluster.server.includes('localhost')) {
    throw new Error(`Invalid server endpoint: ${cluster?.server}`);
  }
}
```

### YAML Template Compliance

**ALWAYS follow the YAML templates in `/yaml` directory!**

Required labels and annotations:
- `cloud.sealos.io/app-deploy-manager`: Resource identifier
- `app.kubernetes.io/instance`: Instance name
- `app.kubernetes.io/managed-by`: Manager identifier

### Database Management with KubeBlocks

**Database Creation Process:**
1. Create ServiceAccount with required labels
2. Create Role with full permissions
3. Create RoleBinding
4. Create KubeBlocks Cluster resource
5. Wait for credential Secret generation

**Credential Retrieval:**
```typescript
const secretName = `${clusterName}-conn-credential`;
const secret = await k8sApi.readNamespacedSecret(secretName, namespace);
// Decode base64 credentials from secret.data
```

### Web Terminal (ttyd) Configuration

**Critical for ttyd functionality:**
1. Simple startup command: `ttyd -W bash`
2. Separate Ingress with WebSocket annotations
3. Port 7681 exposure
4. Proper nginx proxy headers

## UI/UX Design System

### 🎨 VSCode-Inspired Design

The UI follows a professional IDE aesthetic that has proven highly successful.

**Color Palette:**
```css
--background-primary: #1e1e1e    /* Main background */
--background-secondary: #252526  /* Cards/panels */
--background-tertiary: #2d2d30   /* Headers */
--border-color: #3e3e42          /* Borders */
--accent-blue: #0e639c           /* Primary actions */
```

**Layout Architecture:**
- **Dual Sidebar System**: Primary (navigation) + Secondary (settings)
- **Compact Spacing**: Efficient use of screen space
- **Dark Theme**: Professional development environment

**Component Standards:**
- Status indicators with color coding (green/yellow/red)
- Smooth hover transitions (200ms)
- Small, readable typography (text-xs, text-sm)
- Consistent spacing using Tailwind scale

## Development Principles

### ⚠️ Isolated Feature Modification

**Core Principle**: 在改一块功能的时候尽量不要影响别的正常功能，除非有依赖关系。

**Guidelines:**
1. **Scope changes carefully** - Identify boundaries before modifying
2. **Check dependencies** - Analyze impact on other features
3. **Minimize side effects** - Keep changes isolated
4. **Test adjacent features** - Verify related functionality
5. **Document dependencies** - Clear communication when updates affect multiple features

### Docker Image Management

**NEVER build images locally!** Use GitHub Actions:

1. **Workflow**: `.github/workflows/build-runtime-manual.yml`
2. **Trigger**: Push to main or manual dispatch
3. **Repository**: `fullstackagent/fullstack-web-runtime`
4. **Version tags**: `latest`, `v0.0.1-alpha.X`

### Common Development Tasks

| Task | Command/Location |
|------|-----------------|
| Add environment variables | Modify `KubernetesService.createSandbox()` |
| Update resources | Edit deployment spec in service |
| Add database models | Update schema.prisma → generate → push |
| Debug deployments | Use `k8sService.getSandboxStatus()` |
| Check logs | Use `kubectl logs` with kubeconfig |

## Security Considerations

- **OAuth tokens**: Encrypted storage in database
- **Database passwords**: Kubernetes Secrets
- **Environment variables**: Secure injection via deployment spec
- **SSL/TLS**: Enforced via Ingress annotations
- **CORS**: Configured for ttyd terminal access

## Recent Updates and Fixes

### 2025-10-12 Updates

1. **Configuration UI Refactor**:
   - Moved all configuration from sidebar to dedicated pages
   - Simplified environment variables to key-value pairs
   - Added environment variable name display in all configuration pages

2. **ttyd Terminal Fix**:
   - Resolved terminal access issues
   - Simplified startup command to official format
   - Fixed WebSocket connection configuration

3. **Database Configuration**:
   - Enhanced connection detail display
   - Added automatic DATABASE_URL persistence
   - Improved credential parsing and display

## Troubleshooting Guide

### Common Issues

1. **Kubernetes API Connection Failed**
   - Check kubeconfig exists at `.secret/kubeconfig`
   - Verify server endpoint is not localhost
   - Ensure namespace matches kubeconfig

2. **Terminal Not Loading**
   - Check ttyd pod is running
   - Verify Ingress has WebSocket annotations
   - Ensure correct ttyd URL format

3. **Database Connection Issues**
   - Wait for KubeBlocks Secret creation
   - Check Secret name format: `{cluster}-conn-credential`
   - Verify credential decoding from base64

4. **Environment Variables Not Showing**
   - Check Environment model in database
   - Verify category filtering in API
   - Ensure proper API response handling

## Contact and Support

For issues or improvements:
- GitHub Issues: Report bugs and feature requests
- Documentation: This file and inline code comments
- Logs: Check application and Kubernetes logs for debugging