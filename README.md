# FullStack Agent - AI-Powered Full-Stack Development Platform

<div align="center">
  <img src="https://img.shields.io/badge/Next.js-15.5.4-black?style=for-the-badge&logo=next.js" alt="Next.js"/>
  <img src="https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/PostgreSQL-14-blue?style=for-the-badge&logo=postgresql" alt="PostgreSQL"/>
  <img src="https://img.shields.io/badge/Kubernetes-1.28-326ce5?style=for-the-badge&logo=kubernetes" alt="Kubernetes"/>
  <img src="https://img.shields.io/badge/Claude_Code-AI-purple?style=for-the-badge" alt="Claude Code"/>
</div>

## 🚀 Overview

FullStack Agent is an innovative AI-powered platform that enables users to create, develop, and deploy full-stack web applications through natural language interaction. Built on top of Claude Code CLI and Kubernetes, it provides isolated sandbox environments for secure and scalable application development.

<img width="1511" height="775" alt="image" src="https://github.com/user-attachments/assets/4683a22c-800b-45b7-91a3-6ed5114ea3c9" />


### ✨ Key Features

- **🤖 AI-Powered Development**: Leverage Claude Code to build applications using natural language
- **🔒 Isolated Sandboxes**: Each project runs in its own Kubernetes-managed container environment
- **🗄️ Automatic Database Provisioning**: PostgreSQL databases created on-demand using KubeBlocks
- **🌐 Web-Based Terminal**: Integrated ttyd terminal for direct environment access
- **🔐 GitHub Integration**: Seamless code repository management and version control
- **⚡ Real-time Progress Tracking**: Visual feedback during sandbox creation and deployment
- **🎨 Modern UI**: Built with Next.js 15, Tailwind CSS v4, and Shadcn/UI components

## 🛠️ Technology Stack

### Frontend
- **Framework**: Next.js 15.5.4 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **UI Components**: Shadcn/UI
- **State Management**: React Hooks

### Backend
- **Runtime**: Node.js
- **API**: Next.js API Routes
- **Database ORM**: Prisma
- **Authentication**: NextAuth v5 with GitHub OAuth

### Infrastructure
- **Container Orchestration**: Kubernetes
- **Database**: PostgreSQL (via KubeBlocks)
- **Web Terminal**: ttyd
- **Container Image**: fullstack-web-runtime (Custom Docker image with development tools)

## 📦 Installation

### Prerequisites

- Node.js 20.x or higher
- PostgreSQL database
- Kubernetes cluster with KubeBlocks installed
- GitHub OAuth application credentials

### Environment Setup

1. Clone the repository:
```bash
git clone https://github.com/FullstackAgent/FullstackAgent.git
cd FullstackAgent
```

2. Install dependencies:
```bash
cd fullstack-agent
npm install
```

3. Set up environment variables:

Create `.env.local` file:
```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/fullstackagent"

# GitHub OAuth
GITHUB_CLIENT_ID="your-github-client-id"
GITHUB_CLIENT_SECRET="your-github-client-secret"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-nextauth-secret"

# Kubernetes
KUBECONFIG_PATH="./.secret/kubeconfig"
```

4. Set up Kubernetes configuration:

Place your kubeconfig file in `.secret/kubeconfig`

5. Set up Claude Code environment:

Create `.secret/.env` file with your Anthropic API credentials:
```env
ANTHROPIC_API_KEY="your-anthropic-api-key"
```

6. Initialize the database:
```bash
npx prisma generate
npx prisma db push
```

7. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to access the application.

## 🏗️ Architecture

### System Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│   Web Browser   │────▶│   Next.js App   │────▶│   Kubernetes    │
│                 │     │                 │     │     Cluster     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │                         │
                               │                         ▼
                               │                 ┌─────────────────┐
                               │                 │   PostgreSQL    │
                               │                 │   (KubeBlocks)  │
                               │                 └─────────────────┘
                               │                         │
                               ▼                         ▼
                        ┌─────────────────┐     ┌─────────────────┐
                        │     GitHub      │     │  Sandbox Pods   │
                        │  Repositories   │     │  (with Claude)  │
                        └─────────────────┘     └─────────────────┘
```

### Database Schema

```prisma
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String?
  image         String?
  githubId      String    @unique
  accessToken   String?   // Encrypted
  projects      Project[]
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model Project {
  id                   String                @id @default(cuid())
  name                 String
  description          String?
  githubRepo           String?
  status               String                @default("active")
  databaseUrl          String?
  userId               String
  user                 User                  @relation(fields: [userId], references: [id], onDelete: Cascade)
  sandboxes            Sandbox[]
  environmentVariables EnvironmentVariable[]
  createdAt            DateTime              @default(now())
  updatedAt            DateTime              @updatedAt
}

model Sandbox {
  id                String   @id @default(cuid())
  projectId         String
  project           Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  k8sNamespace      String
  k8sDeploymentName String
  k8sServiceName    String
  publicUrl         String?
  ttydUrl           String?
  status            String
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}
```

## 🚢 Deployment

### Kubernetes Resources

The platform creates the following Kubernetes resources for each project:

1. **Database Cluster** (KubeBlocks):
   - PostgreSQL 14.8.0
   - 3Gi storage
   - Auto-generated credentials

2. **Sandbox Deployment**:
   - Custom fullstack-web-runtime image
   - Claude Code CLI pre-installed
   - Web terminal (ttyd) on port 7681
   - Application ports: 3000, 5000, 8080

3. **Services & Ingress**:
   - Internal service for pod networking
   - HTTPS ingress with SSL termination
   - WebSocket support for terminal

### Resource Limits

Default resource allocation per sandbox:
- CPU: 200m limit, 20m request
- Memory: 256Mi limit, 25Mi request
- Storage: 3Gi for database

## 🔧 Development

### Project Structure

```
fullstack-agent/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   ├── projects/          # Project management pages
│   └── layout.tsx         # Root layout
├── components/            # React components
│   ├── ui/               # Shadcn/UI components
│   └── ...               # Feature components
├── lib/                   # Core libraries
│   ├── auth.ts           # NextAuth configuration
│   ├── db.ts             # Prisma client
│   ├── kubernetes.ts     # Kubernetes service
│   └── github.ts         # GitHub integration
├── prisma/               # Database schema
├── yaml/                 # Kubernetes templates
└── public/               # Static assets
```

### Key Services

#### KubernetesService (`lib/kubernetes.ts`)
- Manages all Kubernetes operations
- Creates databases and sandboxes
- Handles pod lifecycle management

#### Authentication (`lib/auth.ts`)
- GitHub OAuth integration
- Session management
- User authorization

#### Database (`lib/db.ts`)
- Prisma ORM configuration
- Connection pooling

## 📚 API Documentation

### Sandbox Management

#### Create Sandbox
```http
POST /api/sandbox/[projectId]
Content-Type: application/json

{
  "envVars": {
    "KEY": "value"
  }
}
```

#### Get Sandbox Status
```http
GET /api/sandbox/[projectId]
```

#### Delete Sandbox
```http
DELETE /api/sandbox/[projectId]
```

### Project Management

#### Create Project
```http
POST /api/projects
Content-Type: application/json

{
  "name": "project-name",
  "description": "Project description"
}
```

## 🔒 Security

- **Authentication**: GitHub OAuth ensures only authorized users can access the platform
- **Isolation**: Each sandbox runs in its own Kubernetes namespace
- **Secrets Management**: Sensitive data stored in Kubernetes secrets
- **Network Policies**: Sandboxes isolated from each other
- **Resource Limits**: Prevents resource exhaustion attacks

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Setup

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm test`
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Anthropic](https://www.anthropic.com/) for Claude Code
- [Sealos](https://sealos.io/) for Kubernetes platform
- [KubeBlocks](https://kubeblocks.io/) for database management
- [ttyd](https://github.com/tsl0922/ttyd) for web terminal

## 📞 Contact

- GitHub: [@FullstackAgent](https://github.com/FullstackAgent)
- Issues: [GitHub Issues](https://github.com/FullstackAgent/FullstackAgent/issues)

---

<div align="center">
Built with ❤️ by the FullStack Agent Team
</div>
