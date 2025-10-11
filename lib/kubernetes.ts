import * as k8s from '@kubernetes/client-node';
import fs from 'fs';
import path from 'path';

export class KubernetesService {
  private kc: k8s.KubeConfig;
  private k8sApi: k8s.CoreV1Api;
  private k8sAppsApi: k8s.AppsV1Api;
  private k8sNetworkingApi: k8s.NetworkingV1Api;

  constructor() {
    this.kc = new k8s.KubeConfig();

    // Load kubeconfig from file - CRITICAL: Must use absolute path and verify loading
    const kubeconfigPath = path.join(process.cwd(), '.secret', 'kubeconfig');
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

  async createPostgreSQLDatabase(projectId: string, namespace?: string) {
    const ns = namespace || this.getDefaultNamespace();
    const dbName = `db-${projectId}`;

    // Create Secret for database credentials
    const secret = {
      metadata: {
        name: `${dbName}-secret`,
        namespace: ns,
      },
      type: 'Opaque',
      stringData: {
        'postgres-password': this.generatePassword(),
        'postgres-db': dbName,
        'postgres-user': 'postgres',
      },
    };

    await this.k8sApi.createNamespacedSecret(ns, secret);

    // Create PersistentVolumeClaim
    const pvc = {
      metadata: {
        name: `${dbName}-pvc`,
        namespace: ns,
      },
      spec: {
        accessModes: ['ReadWriteOnce'],
        resources: {
          requests: {
            storage: '1Gi',
          },
        },
      },
    };

    await this.k8sApi.createNamespacedPersistentVolumeClaim(ns, pvc);

    // Create StatefulSet for PostgreSQL
    const statefulSet = {
      metadata: {
        name: dbName,
        namespace: ns,
      },
      spec: {
        serviceName: dbName,
        replicas: 1,
        selector: {
          matchLabels: {
            app: dbName,
          },
        },
        template: {
          metadata: {
            labels: {
              app: dbName,
            },
          },
          spec: {
            containers: [
              {
                name: 'postgres',
                image: 'postgres:15-alpine',
                ports: [
                  {
                    containerPort: 5432,
                    name: 'postgres',
                  },
                ],
                env: [
                  {
                    name: 'POSTGRES_PASSWORD',
                    valueFrom: {
                      secretKeyRef: {
                        name: `${dbName}-secret`,
                        key: 'postgres-password',
                      },
                    },
                  },
                  {
                    name: 'POSTGRES_DB',
                    valueFrom: {
                      secretKeyRef: {
                        name: `${dbName}-secret`,
                        key: 'postgres-db',
                      },
                    },
                  },
                  {
                    name: 'POSTGRES_USER',
                    valueFrom: {
                      secretKeyRef: {
                        name: `${dbName}-secret`,
                        key: 'postgres-user',
                      },
                    },
                  },
                ],
                volumeMounts: [
                  {
                    name: 'postgres-storage',
                    mountPath: '/var/lib/postgresql/data',
                  },
                ],
              },
            ],
            volumes: [
              {
                name: 'postgres-storage',
                persistentVolumeClaim: {
                  claimName: `${dbName}-pvc`,
                },
              },
            ],
          },
        },
      },
    };

    await this.k8sAppsApi.createNamespacedStatefulSet(ns, statefulSet);

    // Create Service
    const service = {
      metadata: {
        name: dbName,
        namespace: ns,
      },
      spec: {
        selector: {
          app: dbName,
        },
        ports: [
          {
            port: 5432,
            targetPort: 5432,
            protocol: 'TCP',
          },
        ],
        type: 'ClusterIP',
      },
    };

    await this.k8sApi.createNamespacedService(ns, service);

    // Get database connection info
    const secretData = await this.k8sApi.readNamespacedSecret(`${dbName}-secret`, ns);

    return {
      host: `${dbName}.${ns}.svc.cluster.local`,
      port: 5432,
      database: dbName,
      username: 'postgres',
      password: Buffer.from(secretData.body.data!['postgres-password'], 'base64').toString(),
    };
  }

  async createSandbox(projectId: string, envVars: Record<string, string>, namespace?: string) {
    const ns = namespace || this.getDefaultNamespace();
    const sandboxName = `sandbox-${projectId}`;

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
    try {
      const dbInfo = await this.getDatabaseSecret(projectId, ns);
      dbConnectionString = `postgresql://${dbInfo.username}:${dbInfo.password}@${dbInfo.host}:${dbInfo.port}/${dbInfo.database}?schema=public`;
    } catch (error) {
      console.error('Failed to get database info, using default:', error);
    }

    // Prepare environment variables for the container
    const containerEnv = {
      ...claudeEnvVars,
      ...envVars,
      DATABASE_URL: dbConnectionString || claudeEnvVars.DATABASE,
      NODE_ENV: 'development',
      // ttyd configuration
      TTYD_PORT: '7681',
      TTYD_INTERFACE: '0.0.0.0',
      TTYD_BASE_PATH: '/',
      TTYD_MAX_CLIENTS: '0',
      TTYD_READONLY: 'false',
      TTYD_ALLOW_ORIGIN: '*',
    };

    // Create ConfigMap for environment variables
    const configMap = {
      metadata: {
        name: `${sandboxName}-env`,
        namespace: ns,
      },
      data: containerEnv,
    };

    await this.k8sApi.createNamespacedConfigMap(ns, configMap);

    // Create Deployment with fullstack-web-runtime image
    const deployment = {
      metadata: {
        name: sandboxName,
        namespace: ns,
        annotations: {
          'originImageName': 'fullstackagent/fullstack-web-runtime:latest',
        },
      },
      spec: {
        replicas: 1,
        selector: {
          matchLabels: {
            app: sandboxName,
          },
        },
        template: {
          metadata: {
            labels: {
              app: sandboxName,
            },
          },
          spec: {
            containers: [
              {
                name: 'sandbox',
                image: 'fullstackagent/fullstack-web-runtime:latest',
                imagePullPolicy: 'Always',
                ports: [
                  {
                    containerPort: 3000,
                    name: 'app',
                  },
                  {
                    containerPort: 7681,
                    name: 'ttyd',
                  },
                  {
                    containerPort: 5000,
                    name: 'python',
                  },
                  {
                    containerPort: 8080,
                    name: 'http',
                  },
                ],
                envFrom: [
                  {
                    configMapRef: {
                      name: `${sandboxName}-env`,
                    },
                  },
                ],
                resources: {
                  limits: {
                    memory: '2Gi',
                    cpu: '1000m',
                  },
                  requests: {
                    memory: '512Mi',
                    cpu: '250m',
                  },
                },
                workingDir: '/workspace',
                volumeMounts: [
                  {
                    name: 'workspace',
                    mountPath: '/workspace',
                  },
                ],
              },
            ],
            volumes: [
              {
                name: 'workspace',
                emptyDir: {},
              },
            ],
          },
        },
      },
    };

    await this.k8sAppsApi.createNamespacedDeployment(ns, deployment);

    // Create Service with multiple ports
    const service = {
      metadata: {
        name: sandboxName,
        namespace: ns,
      },
      spec: {
        selector: {
          app: sandboxName,
        },
        ports: [
          {
            name: 'app',
            port: 3000,
            targetPort: 3000,
            protocol: 'TCP',
          },
          {
            name: 'ttyd',
            port: 7681,
            targetPort: 7681,
            protocol: 'TCP',
          },
          {
            name: 'python',
            port: 5000,
            targetPort: 5000,
            protocol: 'TCP',
          },
          {
            name: 'http',
            port: 8080,
            targetPort: 8080,
            protocol: 'TCP',
          },
        ],
        type: 'ClusterIP',
      },
    };

    await this.k8sApi.createNamespacedService(ns, service);

    // Create Ingress for both app and ttyd
    const ingress = {
      metadata: {
        name: sandboxName,
        namespace: ns,
        annotations: {
          'kubernetes.io/ingress.class': 'nginx',
          'nginx.ingress.kubernetes.io/ssl-redirect': 'true',
          'nginx.ingress.kubernetes.io/proxy-read-timeout': '3600',
          'nginx.ingress.kubernetes.io/proxy-send-timeout': '3600',
          'nginx.ingress.kubernetes.io/proxy-body-size': '32m',
          // WebSocket support for ttyd
          'nginx.ingress.kubernetes.io/upstream-hash-by': '$remote_addr',
          'nginx.ingress.kubernetes.io/affinity': 'cookie',
          'nginx.ingress.kubernetes.io/affinity-mode': 'persistent',
        },
      },
      spec: {
        rules: [
          {
            host: `${sandboxName}.dgkwlntjskms.usw.sealos.io`,
            http: {
              paths: [
                {
                  path: '/',
                  pathType: 'Prefix',
                  backend: {
                    service: {
                      name: sandboxName,
                      port: {
                        number: 3000,
                      },
                    },
                  },
                },
              ],
            },
          },
          {
            host: `${sandboxName}-ttyd.dgkwlntjskms.usw.sealos.io`,
            http: {
              paths: [
                {
                  path: '/',
                  pathType: 'Prefix',
                  backend: {
                    service: {
                      name: sandboxName,
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
            hosts: [
              `${sandboxName}.dgkwlntjskms.usw.sealos.io`,
              `${sandboxName}-ttyd.dgkwlntjskms.usw.sealos.io`,
            ],
            secretName: `${sandboxName}-tls`,
          },
        ],
      },
    };

    await this.k8sNetworkingApi.createNamespacedIngress(ns, ingress);

    return {
      deploymentName: sandboxName,
      serviceName: sandboxName,
      publicUrl: `https://${sandboxName}.dgkwlntjskms.usw.sealos.io`,
      ttydUrl: `https://${sandboxName}-ttyd.dgkwlntjskms.usw.sealos.io`,
    };
  }

  async deleteSandbox(projectId: string, namespace?: string) {
    const ns = namespace || this.getDefaultNamespace();
    const sandboxName = `sandbox-${projectId}`;

    try {
      // Delete Ingress
      await this.k8sNetworkingApi.deleteNamespacedIngress(sandboxName, ns);
    } catch (error) {
      console.error('Failed to delete ingress:', error);
    }

    try {
      // Delete Service
      await this.k8sApi.deleteNamespacedService(sandboxName, ns);
    } catch (error) {
      console.error('Failed to delete service:', error);
    }

    try {
      // Delete Deployment
      await this.k8sAppsApi.deleteNamespacedDeployment(sandboxName, ns);
    } catch (error) {
      console.error('Failed to delete deployment:', error);
    }

    try {
      // Delete ConfigMap
      await this.k8sApi.deleteNamespacedConfigMap(`${sandboxName}-env`, ns);
    } catch (error) {
      console.error('Failed to delete configmap:', error);
    }
  }

  async getSandboxStatus(projectId: string, namespace?: string) {
    const ns = namespace || this.getDefaultNamespace();
    const sandboxName = `sandbox-${projectId}`;

    try {
      const deployment = await this.k8sAppsApi.readNamespacedDeploymentStatus(sandboxName, ns);
      const replicas = deployment.body.status?.replicas || 0;
      const readyReplicas = deployment.body.status?.readyReplicas || 0;

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

  async getDatabaseSecret(projectId: string, namespace?: string) {
    const ns = namespace || this.getDefaultNamespace();
    const dbName = `db-${projectId}`;

    try {
      const secret = await this.k8sApi.readNamespacedSecret(`${dbName}-secret`, ns);

      // Safely access the secret data
      if (!secret.body || !secret.body.data) {
        throw new Error(`Secret ${dbName}-secret exists but has no data`);
      }

      const secretData = secret.body.data;
      if (!secretData['postgres-password']) {
        throw new Error(`Secret ${dbName}-secret missing postgres-password field`);
      }

      return {
        host: `${dbName}.${ns}.svc.cluster.local`,
        port: 5432,
        database: dbName,
        username: 'postgres',
        password: Buffer.from(secretData['postgres-password'], 'base64').toString(),
      };
    } catch (error) {
      throw new Error(`Failed to get database secret: ${error}`);
    }
  }

  private generatePassword(length: number = 16): string {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  }
}

export const k8sService = new KubernetesService();