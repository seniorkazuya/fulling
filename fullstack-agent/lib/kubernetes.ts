import * as k8s from '@kubernetes/client-node';
import fs from 'fs';
import path from 'path';
import { VERSIONS, getRuntimeImage } from './config/versions';

export class KubernetesService {
  private kc: k8s.KubeConfig;
  private k8sApi: k8s.CoreV1Api;
  private k8sAppsApi: k8s.AppsV1Api;
  private k8sNetworkingApi: k8s.NetworkingV1Api;

  constructor() {
    this.kc = new k8s.KubeConfig();

    // Load kubeconfig from file - CRITICAL: Must use absolute path and verify loading
    // Check both current directory and parent directory for .secret/kubeconfig
    let kubeconfigPath = path.join(process.cwd(), '.secret', 'kubeconfig');
    if (!fs.existsSync(kubeconfigPath)) {
      kubeconfigPath = path.join(process.cwd(), '..', '.secret', 'kubeconfig');
    }
    console.log(`Loading kubeconfig from: ${kubeconfigPath}`);

    if (fs.existsSync(kubeconfigPath)) {
      try {
        this.kc.loadFromFile(kubeconfigPath);
        const cluster = this.kc.getCurrentCluster();
        const context = this.kc.getCurrentContext();
        const contextObj = this.kc.getContextObject(context);
        console.log(`✅ Kubeconfig loaded successfully:`);
        console.log(`  - Server: ${cluster?.server}`);
        console.log(`  - Context: ${context}`);
        console.log(`  - Namespace: ${contextObj?.namespace}`);

        // Verify we have the correct cluster endpoint
        if (!cluster?.server || cluster.server.includes('localhost')) {
          throw new Error(`Invalid server endpoint: ${cluster?.server}`);
        }
      } catch (error) {
        console.error('❌ Failed to load kubeconfig:', error);
        throw new Error(`Failed to load kubeconfig from ${kubeconfigPath}: ${error}`);
      }
    } else {
      console.error(`❌ Kubeconfig file not found at: ${kubeconfigPath}`);
      throw new Error(`Kubeconfig file not found at: ${kubeconfigPath}`);
    }

    // Configure TLS settings for HTTPS endpoints
    const cluster = this.kc.getCurrentCluster();
    if (cluster && cluster.server && cluster.server.startsWith('https://')) {
      // For Sealos clusters, we trust the certificate
      cluster.skipTLSVerify = false;
    }

    this.k8sApi = this.kc.makeApiClient(k8s.CoreV1Api);
    this.k8sAppsApi = this.kc.makeApiClient(k8s.AppsV1Api);
    this.k8sNetworkingApi = this.kc.makeApiClient(k8s.NetworkingV1Api);

    console.log('✅ Kubernetes API clients initialized');
  }

  // Get the default namespace from kubeconfig
  getDefaultNamespace(): string {
    const currentContextName = this.kc.getCurrentContext();
    if (currentContextName) {
      const contextObj = this.kc.getContextObject(currentContextName);
      if (contextObj && contextObj.namespace) {
        return contextObj.namespace;
      }
    }
    // Fallback to the namespace from kubeconfig we know
    return 'ns-ajno7yq7';
  }

  async createPostgreSQLDatabase(projectName: string, namespace?: string) {
    namespace = namespace || this.getDefaultNamespace();
    const randomSuffix = this.generateRandomSuffix();
    // Convert project name to k8s-compatible format (lowercase, alphanumeric, hyphens)
    const k8sProjectName = projectName.toLowerCase().replace(/[^a-z0-9-]/g, '').substring(0, 20);
    const clusterName = `${k8sProjectName}-agentruntime-${randomSuffix}`;

    // 1. Create ServiceAccount (from yaml/database/account.yaml)
    const serviceAccount = {
      apiVersion: 'v1',
      kind: 'ServiceAccount',
      metadata: {
        labels: {
          'sealos-db-provider-cr': clusterName,
          'app.kubernetes.io/instance': clusterName,
          'app.kubernetes.io/managed-by': 'kbcli',
          'project.fullstackagent.io/name': k8sProjectName,
        },
        name: clusterName,
        namespace,
      },
    };

    await this.k8sApi.createNamespacedServiceAccount({ namespace, body: serviceAccount as any });

    // 2. Create Role
    const role = {
      apiVersion: 'rbac.authorization.k8s.io/v1',
      kind: 'Role',
      metadata: {
        labels: {
          'sealos-db-provider-cr': clusterName,
          'app.kubernetes.io/instance': clusterName,
          'app.kubernetes.io/managed-by': 'kbcli',
          'project.fullstackagent.io/name': k8sProjectName,
        },
        name: clusterName,
        namespace,
      },
      rules: [
        {
          apiGroups: ['*'],
          resources: ['*'],
          verbs: ['*'],
        },
      ],
    };

    const rbacApi = this.kc.makeApiClient(k8s.RbacAuthorizationV1Api);
    await rbacApi.createNamespacedRole({ namespace, body: role as any });

    // 3. Create RoleBinding
    const roleBinding = {
      apiVersion: 'rbac.authorization.k8s.io/v1',
      kind: 'RoleBinding',
      metadata: {
        labels: {
          'sealos-db-provider-cr': clusterName,
          'app.kubernetes.io/instance': clusterName,
          'app.kubernetes.io/managed-by': 'kbcli',
          'project.fullstackagent.io/name': k8sProjectName,
        },
        name: clusterName,
        namespace,
      },
      roleRef: {
        apiGroup: 'rbac.authorization.k8s.io',
        kind: 'Role',
        name: clusterName,
      },
      subjects: [
        {
          kind: 'ServiceAccount',
          name: clusterName,
        },
      ],
    };

    await rbacApi.createNamespacedRoleBinding({ namespace, body: roleBinding as any });

    // 4. Create KubeBlocks Cluster (from yaml/database/cluster.yaml)
    const cluster = {
      apiVersion: 'apps.kubeblocks.io/v1alpha1',
      kind: 'Cluster',
      metadata: {
        finalizers: ['cluster.kubeblocks.io/finalizer'],
        labels: {
          'clusterdefinition.kubeblocks.io/name': VERSIONS.POSTGRESQL_DEFINITION,
          'clusterversion.kubeblocks.io/name': VERSIONS.POSTGRESQL_VERSION,
          'sealos-db-provider-cr': clusterName,
          'project.fullstackagent.io/name': k8sProjectName,
        },
        annotations: {},
        name: clusterName,
        namespace,
      },
      spec: {
        affinity: {
          nodeLabels: {},
          podAntiAffinity: 'Preferred',
          tenancy: 'SharedNode',
          topologyKeys: ['kubernetes.io/hostname'],
        },
        clusterDefinitionRef: VERSIONS.POSTGRESQL_DEFINITION,
        clusterVersionRef: VERSIONS.POSTGRESQL_VERSION,
        componentSpecs: [
          {
            componentDefRef: 'postgresql',
            monitor: true,
            name: 'postgresql',
            noCreatePDB: false,
            replicas: 1,
            resources: VERSIONS.RESOURCES.DATABASE,
            serviceAccountName: clusterName,
            switchPolicy: {
              type: 'Noop',
            },
            volumeClaimTemplates: [
              {
                name: 'data',
                spec: {
                  accessModes: ['ReadWriteOnce'],
                  resources: {
                    requests: {
                      storage: VERSIONS.STORAGE.DATABASE_SIZE,
                    },
                  },
                  storageClassName: VERSIONS.STORAGE.STORAGE_CLASS,
                },
              },
            ],
          },
        ],
        terminationPolicy: 'Delete',
        tolerations: [],
      },
    };

    // Use custom resource API for KubeBlocks Cluster
    const customObjectsApi = this.kc.makeApiClient(k8s.CustomObjectsApi);
    await customObjectsApi.createNamespacedCustomObject({
      group: 'apps.kubeblocks.io',
      version: 'v1alpha1',
      namespace: namespace,
      plural: 'clusters',
      body: cluster
    });

    // Wait for the cluster to be ready and get actual credentials
    console.log(`⏳ Waiting for database cluster '${clusterName}' to be ready...`);
    const isReady = await this.waitForDatabaseReady(clusterName, namespace);

    if (isReady) {
      // Get actual credentials from the secret using direct cluster name lookup
      try {
        const secretName = `${clusterName}-conn-credential`;
        const secret = await this.k8sApi.readNamespacedSecret({ name: secretName, namespace });

        // Fix: Handle both response.body.data and response.data patterns
        const secretData = (secret as any).body?.data || (secret as any).data;
        if (!secretData) {
          throw new Error(`Secret ${secretName} has no data`);
        }

        const dbInfo = {
          host: secretData['host'] ? Buffer.from(secretData['host'], 'base64').toString() : `${clusterName}-postgresql.${namespace}.svc.cluster.local`,
          port: secretData['port'] ? parseInt(Buffer.from(secretData['port'], 'base64').toString()) : 5432,
          database: secretData['database'] ? Buffer.from(secretData['database'], 'base64').toString() : 'postgres',
          username: secretData['username'] ? Buffer.from(secretData['username'], 'base64').toString() : 'postgres',
          password: secretData['password'] ? Buffer.from(secretData['password'], 'base64').toString() : 'postgres',
          clusterName,
        };

        console.log(`✅ Database cluster '${clusterName}' created and ready`);
        return dbInfo;
      } catch (error) {
        console.error(`Failed to get credentials for new cluster '${clusterName}':`, error);
      }
    }

    // Fallback: return connection info with defaults if not ready yet
    console.log(`⚠️ Database cluster '${clusterName}' not ready yet, returning default connection info`);
    return {
      host: `${clusterName}-postgresql.${namespace}.svc.cluster.local`,
      port: 5432,
      database: 'postgres',
      username: 'postgres',
      password: 'postgres', // Default for KubeBlocks
      clusterName,
    };
  }

  async createSandbox(projectName: string, envVars: Record<string, string>, namespace?: string, databaseInfo?: { host: string; port: number; database: string; username: string; password: string; clusterName: string }) {
    namespace = namespace || this.getDefaultNamespace();
    const randomSuffix = this.generateRandomSuffix();
    // Convert project name to k8s-compatible format (lowercase, alphanumeric, hyphens)
    const k8sProjectName = projectName.toLowerCase().replace(/[^a-z0-9-]/g, '').substring(0, 20);
    const sandboxName = `${k8sProjectName}-agentruntime-${randomSuffix}`;

    // Generate random names for ports (based on YAML template)
    const port3000Name = this.generateRandomName();
    const port5000Name = this.generateRandomName();
    const port7681Name = this.generateRandomName(); // ttyd
    const port8080Name = this.generateRandomName();

    // Generate random domains for ingress
    const appDomain = this.generateRandomName();
    const ttydDomain = this.generateRandomName();

    // Load Claude Code environment variables from .secret/.env
    const claudeEnvPath = path.join(process.cwd(), '.secret', '.env');
    let claudeEnvVars: Record<string, string> = {};

    if (fs.existsSync(claudeEnvPath)) {
      const envContent = fs.readFileSync(claudeEnvPath, 'utf-8');
      envContent.split('\n').forEach(line => {
        // Skip comment lines and export statements
        if (line.startsWith('#') || !line.includes('=')) return;

        let cleanLine = line.replace(/^export\s+/, '');
        const [key, ...valueParts] = cleanLine.split('=');
        const value = valueParts.join('='); // Handle values with = signs

        if (key && value) {
          claudeEnvVars[key.trim()] = value.trim().replace(/^["']|["']$/g, '');
        }
      });
    }

    // Get database connection info for this project
    let dbConnectionString = '';
    if (databaseInfo) {
      // Use provided database info (from fresh database creation)
      dbConnectionString = `postgresql://${databaseInfo.username}:${databaseInfo.password}@${databaseInfo.host}:${databaseInfo.port}/${databaseInfo.database}?schema=public`;
      console.log(`📊 Using provided database credentials for '${databaseInfo.clusterName}'`);
    } else {
      // Try to get database info for existing projects
      try {
        const dbInfo = await this.getDatabaseSecret(k8sProjectName, namespace);
        dbConnectionString = `postgresql://${dbInfo.username}:${dbInfo.password}@${dbInfo.host}:${dbInfo.port}/${dbInfo.database}?schema=public`;
        console.log(`📊 Found existing database credentials for project '${k8sProjectName}'`);
      } catch (error) {
        console.error('Failed to get database info, will use default from environment:', error);
        // Don't throw error - allow sandbox creation to continue with default database
      }
    }

    // Prepare environment variables for the container
    const containerEnv = {
      ...claudeEnvVars,
      ...envVars,
      DATABASE_URL: dbConnectionString || claudeEnvVars.DATABASE,
      NODE_ENV: 'development',
      // ttyd configuration - simplified, no special parameters
      TTYD_PORT: '7681',
      TTYD_INTERFACE: '0.0.0.0',
      // No TTYD_BASE_PATH, no TTYD_WS_PATH - let ttyd use defaults
      // These were causing issues with WebSocket connections
    };

    // 1. Create Deployment with Sealos-compliant configuration
    const currentTime = new Date().toISOString().replace(/[-:T.]/g, '').substring(0, 14);

    const deployment = {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: {
        name: sandboxName,
        namespace,
        annotations: {
          originImageName: getRuntimeImage(),
          'deploy.cloud.sealos.io/minReplicas': '1',
          'deploy.cloud.sealos.io/maxReplicas': '1',
          'deploy.cloud.sealos.io/resize': '0Gi',
        },
        labels: {
          'cloud.sealos.io/app-deploy-manager': sandboxName,
          app: sandboxName,
          'project.fullstackagent.io/name': k8sProjectName,
        },
      },
      spec: {
        replicas: 1,
        revisionHistoryLimit: 1,
        selector: {
          matchLabels: {
            app: sandboxName,
          },
        },
        strategy: {
          type: 'RollingUpdate',
          rollingUpdate: {
            maxUnavailable: 0,
            maxSurge: 1,
          },
        },
        template: {
          metadata: {
            labels: {
              app: sandboxName,
              restartTime: currentTime,
              'project.fullstackagent.io/name': k8sProjectName,
            },
          },
          spec: {
            automountServiceAccountToken: false,
            containers: [
              {
                name: sandboxName,
                image: getRuntimeImage(),
                env: Object.entries(containerEnv).map(([key, value]) => ({
                  name: key,
                  value: String(value),
                })),
                resources: VERSIONS.RESOURCES.SANDBOX,
                ports: [
                  {
                    containerPort: 3000,
                    name: port3000Name,
                  },
                  {
                    containerPort: 5000,
                    name: port5000Name,
                  },
                  {
                    containerPort: 7681, // ttyd
                    name: port7681Name,
                  },
                  {
                    containerPort: 8080,
                    name: port8080Name,
                  },
                ],
                imagePullPolicy: 'Always',
                volumeMounts: [],
                // Let the container use its default command which should have ttyd configured
              },
            ],
            volumes: [],
          },
        },
      },
    };

    await this.k8sAppsApi.createNamespacedDeployment({ namespace, body: deployment as any });

    // 2. Create Service with Sealos labels
    const serviceName = `${sandboxName}-service`;
    const service = {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: {
        name: serviceName,
        namespace,
        labels: {
          'cloud.sealos.io/app-deploy-manager': sandboxName, // This label is critical
          'project.fullstackagent.io/name': k8sProjectName,
        },
      },
      spec: {
        ports: [
          {
            port: 3000,
            targetPort: 3000,
            name: port3000Name,
            protocol: 'TCP',
          },
          {
            port: 5000,
            targetPort: 5000,
            name: port5000Name,
            protocol: 'TCP',
          },
          {
            port: 7681, // ttyd
            targetPort: 7681,
            name: port7681Name,
            protocol: 'TCP',
          },
          {
            port: 8080,
            targetPort: 8080,
            name: port8080Name,
            protocol: 'TCP',
          },
        ],
        selector: {
          app: sandboxName,
        },
      },
    };

    await this.k8sApi.createNamespacedService({ namespace, body: service as any });

    // 3. Create multiple Ingress resources (one for each port)
    const ingresses = [
      // App ingress (port 3000)
      {
        apiVersion: 'networking.k8s.io/v1',
        kind: 'Ingress',
        metadata: {
          name: `${sandboxName}-app-ingress`,
          namespace,
          labels: {
            'cloud.sealos.io/app-deploy-manager': sandboxName,
            'cloud.sealos.io/app-deploy-manager-domain': appDomain,
            'project.fullstackagent.io/name': k8sProjectName,
          },
          annotations: {
            'kubernetes.io/ingress.class': 'nginx',
            'nginx.ingress.kubernetes.io/proxy-body-size': '32m',
            'nginx.ingress.kubernetes.io/ssl-redirect': 'false',
            'nginx.ingress.kubernetes.io/backend-protocol': 'HTTP',
            'nginx.ingress.kubernetes.io/client-body-buffer-size': '64k',
            'nginx.ingress.kubernetes.io/proxy-buffer-size': '64k',
            'nginx.ingress.kubernetes.io/proxy-send-timeout': '300',
            'nginx.ingress.kubernetes.io/proxy-read-timeout': '300',
            'nginx.ingress.kubernetes.io/server-snippet': `client_header_buffer_size 64k;\nlarge_client_header_buffers 4 128k;`,
          },
        },
        spec: {
          rules: [
            {
              host: `${appDomain}.usw.sealos.io`,
              http: {
                paths: [
                  {
                    pathType: 'Prefix',
                    path: '/',
                    backend: {
                      service: {
                        name: serviceName,
                        port: {
                          number: 3000,
                        },
                      },
                    },
                  },
                ],
              },
            },
          ],
          tls: [
            {
              hosts: [`${appDomain}.usw.sealos.io`],
              secretName: 'wildcard-cert',
            },
          ],
        },
      },
      // ttyd ingress (port 7681) - WebSocket support
      {
        apiVersion: 'networking.k8s.io/v1',
        kind: 'Ingress',
        metadata: {
          name: `${sandboxName}-ttyd-ingress`,
          namespace,
          labels: {
            'cloud.sealos.io/app-deploy-manager': sandboxName,
            'cloud.sealos.io/app-deploy-manager-domain': ttydDomain,
            'project.fullstackagent.io/name': k8sProjectName,
          },
          annotations: {
            'kubernetes.io/ingress.class': 'nginx',
            'nginx.ingress.kubernetes.io/proxy-body-size': '32m',
            'nginx.ingress.kubernetes.io/ssl-redirect': 'false',
            'nginx.ingress.kubernetes.io/backend-protocol': 'HTTP',
            'nginx.ingress.kubernetes.io/client-body-buffer-size': '64k',
            'nginx.ingress.kubernetes.io/proxy-buffer-size': '64k',
            'nginx.ingress.kubernetes.io/proxy-send-timeout': '300',
            'nginx.ingress.kubernetes.io/proxy-read-timeout': '300',
            'nginx.ingress.kubernetes.io/server-snippet': 'client_header_buffer_size 64k;\nlarge_client_header_buffers 4 128k;',
          },
        },
        spec: {
          rules: [
            {
              host: `${ttydDomain}.usw.sealos.io`,
              http: {
                paths: [
                  {
                    pathType: 'Prefix',
                    path: '/',
                    backend: {
                      service: {
                        name: serviceName,
                        port: {
                          number: 7681,
                        },
                      },
                    },
                  },
                ],
              },
            },
          ],
          tls: [
            {
              hosts: [`${ttydDomain}.usw.sealos.io`],
              secretName: 'wildcard-cert',
            },
          ],
        },
      },
    ];

    // Create each ingress
    for (const ingress of ingresses) {
      await this.k8sNetworkingApi.createNamespacedIngress({ namespace, body: ingress as any });
    }

    return {
      deploymentName: sandboxName,
      serviceName: serviceName,
      publicUrl: `https://${appDomain}.usw.sealos.io`,
      ttydUrl: `https://${ttydDomain}.usw.sealos.io`,
    };
  }

  async deleteSandbox(projectName: string, namespace?: string) {
    namespace = namespace || this.getDefaultNamespace();

    try {
      // Find all resources related to this project
      // Convert project name to k8s-compatible format
      const k8sProjectName = projectName.toLowerCase().replace(/[^a-z0-9-]/g, '').substring(0, 20);
      console.log(`🗑️ Deleting sandbox for project: ${projectName} (k8s: ${k8sProjectName})`);

      // Delete Deployments
      const deployments = await this.k8sAppsApi.listNamespacedDeployment({ namespace });
      // Fix: Handle both response.body.items and response.items patterns
      const deploymentItems = deployments.body?.items || (deployments as any).items || [];
      console.log(`📦 Deployments response:`, deployments.body ? 'has body' : 'no body', deploymentItems.length, 'items');
      const projectDeployments = deploymentItems.filter((dep: any) =>
        dep.metadata.name.startsWith(`${k8sProjectName}-agentruntime-`)
      );

      for (const deployment of projectDeployments) {
        try {
          await this.k8sAppsApi.deleteNamespacedDeployment({
            name: deployment.metadata.name,
            namespace
          });
          console.log(`Deleted deployment: ${deployment.metadata.name}`);
        } catch (error) {
          console.error(`Failed to delete deployment ${deployment.metadata.name}:`, error);
        }
      }

      // Delete Services
      const services = await this.k8sApi.listNamespacedService({ namespace });
      // Fix: Handle both response.body.items and response.items patterns
      const serviceItems = services.body?.items || (services as any).items || [];
      const projectServices = serviceItems.filter((svc: any) =>
        svc.metadata.name.startsWith(`${k8sProjectName}-agentruntime-`)
      );

      for (const service of projectServices) {
        try {
          await this.k8sApi.deleteNamespacedService({
            name: service.metadata.name,
            namespace
          });
          console.log(`Deleted service: ${service.metadata.name}`);
        } catch (error) {
          console.error(`Failed to delete service ${service.metadata.name}:`, error);
        }
      }

      // Delete Ingresses
      const ingresses = await this.k8sNetworkingApi.listNamespacedIngress({ namespace });
      // Fix: Handle both response.body.items and response.items patterns
      const ingressItems = ingresses.body?.items || (ingresses as any).items || [];
      const projectIngresses = ingressItems.filter((ing: any) =>
        ing.metadata.labels &&
        ing.metadata.labels['cloud.sealos.io/app-deploy-manager'] &&
        ing.metadata.labels['cloud.sealos.io/app-deploy-manager'].startsWith(`${k8sProjectName}-agentruntime-`)
      );

      for (const ingress of projectIngresses) {
        try {
          await this.k8sNetworkingApi.deleteNamespacedIngress({
            name: ingress.metadata.name,
            namespace
          });
          console.log(`Deleted ingress: ${ingress.metadata.name}`);
        } catch (error) {
          console.error(`Failed to delete ingress ${ingress.metadata.name}:`, error);
        }
      }

    } catch (error) {
      console.error('Failed to delete sandbox resources:', error);
    }
  }

  async getSandboxStatus(projectName: string, namespace?: string) {
    namespace = namespace || this.getDefaultNamespace();

    try {
      // Convert project name to k8s-compatible format
      const k8sProjectName = projectName.toLowerCase().replace(/[^a-z0-9-]/g, '').substring(0, 20);

      // Find deployment with new naming pattern
      const deployments = await this.k8sAppsApi.listNamespacedDeployment({ namespace });
      // Fix: Handle both response.body.items and response.items patterns
      const deploymentItems = deployments.body?.items || (deployments as any).items || [];
      const projectDeployment = deploymentItems.find((dep: any) =>
        dep.metadata.name.startsWith(`${k8sProjectName}-agentruntime-`)
      );

      if (!projectDeployment) {
        return 'TERMINATED';
      }

      const replicas = projectDeployment.status?.replicas || 0;
      const readyReplicas = projectDeployment.status?.readyReplicas || 0;

      if (readyReplicas === replicas && replicas > 0) {
        return 'RUNNING';
      } else if (replicas === 0) {
        return 'STOPPED';
      } else {
        return 'CREATING';
      }
    } catch (error: any) {
      if (error?.response?.statusCode === 404) {
        return 'TERMINATED';
      }
      return 'ERROR';
    }
  }

  async waitForDatabaseReady(clusterName: string, namespace?: string, timeoutMs: number = 120000): Promise<boolean> {
    namespace = namespace || this.getDefaultNamespace();
    const startTime = Date.now();
    const customObjectsApi = this.kc.makeApiClient(k8s.CustomObjectsApi);

    console.log(`⏳ Waiting for database cluster '${clusterName}' to be ready...`);

    while (Date.now() - startTime < timeoutMs) {
      try {
        // Check cluster status
        const cluster = await customObjectsApi.getNamespacedCustomObject({
          group: 'apps.kubeblocks.io',
          version: 'v1alpha1',
          namespace: namespace,
          plural: 'clusters',
          name: clusterName
        });

        const clusterObj = cluster.body || cluster;
        const status = (clusterObj as any)?.status?.phase;

        console.log(`📊 Cluster '${clusterName}' status: ${status}`);

        if (status === 'Running') {
          // Also check if the connection secret exists
          const secretName = `${clusterName}-conn-credential`;
          try {
            await this.k8sApi.readNamespacedSecret({ name: secretName, namespace });
            console.log(`✅ Database cluster '${clusterName}' is ready with credentials`);
            return true;
          } catch (secretError) {
            console.log(`⏳ Cluster running but credentials not ready yet...`);
          }
        }

        // Wait 3 seconds before checking again
        await new Promise(resolve => setTimeout(resolve, 3000));
      } catch (error) {
        console.log(`⏳ Cluster not found yet, continuing to wait...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    console.log(`⚠️ Timeout waiting for database cluster '${clusterName}' to be ready`);
    return false;
  }

  async updateDeploymentEnvVars(projectName: string, namespace: string, envVars: Record<string, string>) {
    namespace = namespace || this.getDefaultNamespace();

    // Convert project name to k8s-compatible format
    const k8sProjectName = projectName.toLowerCase().replace(/[^a-z0-9-]/g, '').substring(0, 20);

    try {
      // Find the deployment for this project
      const deployments = await this.k8sAppsApi.listNamespacedDeployment({ namespace });
      const deploymentItems = (deployments as any).body?.items || (deployments as any).items || [];
      const projectDeployment = deploymentItems.find((dep: any) =>
        dep.metadata.name.startsWith(`${k8sProjectName}-agentruntime-`)
      );

      if (!projectDeployment) {
        throw new Error(`No deployment found for project ${projectName}`);
      }

      const deploymentName = projectDeployment.metadata.name;

      // Load Claude Code environment variables from .secret/.env
      const claudeEnvPath = path.join(process.cwd(), '.secret', '.env');
      let claudeEnvVars: Record<string, string> = {};

      if (fs.existsSync(claudeEnvPath)) {
        const envContent = fs.readFileSync(claudeEnvPath, 'utf-8');
        envContent.split('\n').forEach(line => {
          if (line.startsWith('#') || !line.includes('=')) return;

          let cleanLine = line.replace(/^export\s+/, '');
          const [key, ...valueParts] = cleanLine.split('=');
          const value = valueParts.join('=');

          if (key && value) {
            claudeEnvVars[key.trim()] = value.trim().replace(/^["']|["']$/g, '');
          }
        });
      }

      // Get database connection string if available
      let dbConnectionString = '';
      try {
        const dbInfo = await this.getDatabaseSecret(k8sProjectName, namespace);
        dbConnectionString = `postgresql://${dbInfo.username}:${dbInfo.password}@${dbInfo.host}:${dbInfo.port}/${dbInfo.database}?schema=public`;
      } catch (error) {
        console.log('Could not get database info for environment update');
      }

      // Merge all environment variables
      const allEnvVars = {
        ...claudeEnvVars,
        ...envVars,
        DATABASE_URL: dbConnectionString || claudeEnvVars.DATABASE_URL,
        NODE_ENV: 'development',
        TTYD_PORT: '7681',
        TTYD_INTERFACE: '0.0.0.0',
      };

      // Update the deployment with new environment variables
      const updatedDeployment = {
        ...projectDeployment,
        spec: {
          ...projectDeployment.spec,
          template: {
            ...projectDeployment.spec.template,
            spec: {
              ...projectDeployment.spec.template.spec,
              containers: projectDeployment.spec.template.spec.containers.map((container: any) => {
                if (container.name === deploymentName) {
                  return {
                    ...container,
                    env: Object.entries(allEnvVars).map(([key, value]) => ({
                      name: key,
                      value: String(value),
                    })),
                  };
                }
                return container;
              }),
            },
          },
        },
      };

      // Apply the update
      await this.k8sAppsApi.replaceNamespacedDeployment({
        name: deploymentName,
        namespace,
        body: updatedDeployment,
      });

      console.log(`✅ Updated deployment ${deploymentName} with new environment variables`);

      // The deployment will automatically restart the pods with new environment variables
      return true;
    } catch (error) {
      console.error(`Failed to update deployment environment variables:`, error);
      throw error;
    }
  }

  async getDatabaseSecret(projectName: string, namespace?: string) {
    namespace = namespace || this.getDefaultNamespace();

    // Convert project name to k8s-compatible format
    const k8sProjectName = projectName.toLowerCase().replace(/[^a-z0-9-]/g, '').substring(0, 20);
    console.log(`🔍 Getting database secret for project: ${projectName} (k8s: ${k8sProjectName})`);

    // For KubeBlocks clusters, we need to find the cluster by project name
    // The cluster name follows pattern: [k8sProjectName]-agentruntime-[6chars]
    try {
      const customObjectsApi = this.kc.makeApiClient(k8s.CustomObjectsApi);
      const clusters = await customObjectsApi.listNamespacedCustomObject({
        group: 'apps.kubeblocks.io',
        version: 'v1alpha1',
        namespace: namespace,
        plural: 'clusters'
      });

      // CRITICAL FIX: The response structure varies by client version
      // Check if response has body property or items directly on response
      const clusterList = clusters.body || clusters;
      const clusterItems = (clusterList as any)?.items || [];

      console.log(`🗄️ KubeBlocks clusters response:`,
        clusters.body ? 'has body property' : 'no body property',
        clusterList ? 'has cluster list' : 'no cluster list',
        clusterItems.length > 0 ? `${clusterItems.length} items` : 'no items',
        clusterList ? `response keys: ${Object.keys(clusterList)}` : 'no cluster list keys'
      );

      if (!Array.isArray(clusterItems)) {
        console.error(`❌ Expected clusters.body.items to be an array, got:`, typeof clusterItems, clusterItems);
        throw new Error(`Invalid API response: expected items array, got ${typeof clusterItems}`);
      }

      // Try to find cluster with multiple naming patterns
      let projectCluster = clusterItems.find((cluster: any) =>
        cluster?.metadata?.name?.startsWith(`${k8sProjectName}-agentruntime-`)
      );

      // Fallback: Try simple project name pattern
      if (!projectCluster) {
        projectCluster = clusterItems.find((cluster: any) =>
          cluster?.metadata?.name === k8sProjectName
        );
      }

      // Fallback: Try exact project name match (for original project names)
      if (!projectCluster && projectName !== k8sProjectName) {
        projectCluster = clusterItems.find((cluster: any) =>
          cluster?.metadata?.name === projectName
        );
      }

      if (!projectCluster) {
        const availableClusters = clusterItems.map((c: any) => c?.metadata?.name).join(', ');
        throw new Error(`No database cluster found for project ${projectName} (k8s name: ${k8sProjectName}). Available clusters: ${availableClusters}`);
      }

      const clusterName = projectCluster.metadata.name;

      // KubeBlocks creates a secret with connection info
      const secretName = `${clusterName}-conn-credential`;

      try {
        const secret = await this.k8sApi.readNamespacedSecret({ name: secretName, namespace });

        // Fix: Handle both response.body and direct response patterns
        const secretData = secret.body?.data || (secret as any).data;
        if (!secretData) {
          throw new Error(`Secret ${secretName} has no data`);
        }

        return {
          host: Buffer.from(secretData['host'], 'base64').toString(),
          port: parseInt(Buffer.from(secretData['port'], 'base64').toString()),
          database: Buffer.from(secretData['database'], 'base64').toString(),
          username: Buffer.from(secretData['username'], 'base64').toString(),
          password: Buffer.from(secretData['password'], 'base64').toString(),
          clusterName,
        };
      } catch (secretError) {
        // Fallback to default connection info if secret doesn't exist yet
        return {
          host: `${clusterName}-postgresql.${namespace}.svc.cluster.local`,
          port: 5432,
          database: 'postgres',
          username: 'postgres',
          password: 'postgres', // Default for KubeBlocks
          clusterName,
        };
      }
    } catch (error) {
      throw new Error(`Failed to get database secret: ${error}`);
    }
  }

  // Generate random string for port names and domains (12 characters, lowercase letters)
  private generateRandomName(length: number = 12): string {
    const charset = 'abcdefghijklmnopqrstuvwxyz';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return result;
  }

  // Generate 6-character random suffix for resource names
  private generateRandomSuffix(): string {
    const charset = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return result;
  }
}

export const k8sService = new KubernetesService();