/**
 * Debug test to diagnose Kubernetes API response issues
 */

import { k8sService } from './kubernetes';
import * as k8s from '@kubernetes/client-node';

// Color codes for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

async function debugKubernetesAPI() {
  console.log(`${colors.blue}═══════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.blue}     Kubernetes API Debug Test${colors.reset}`);
  console.log(`${colors.blue}═══════════════════════════════════════════════════════${colors.reset}`);

  try {
    // Initialize the KubernetesService to see if kubeconfig loads properly
    console.log('\n1. Testing KubernetesService initialization...');
    const namespace = k8sService.getDefaultNamespace();
    console.log(`   Default namespace: ${namespace}`);

    // Test basic Kubernetes API calls
    console.log('\n2. Testing basic Kubernetes API calls...');

    // Create API client directly with same logic as KubernetesService
    const kc = new k8s.KubeConfig();
    let kubeconfigPath = require('path').join(process.cwd(), '.secret', 'kubeconfig');
    if (!require('fs').existsSync(kubeconfigPath)) {
      kubeconfigPath = require('path').join(process.cwd(), '..', '.secret', 'kubeconfig');
    }
    console.log(`   Loading kubeconfig from: ${kubeconfigPath}`);

    kc.loadFromFile(kubeconfigPath);
    const customObjectsApi = kc.makeApiClient(k8s.CustomObjectsApi);
    const coreApi = kc.makeApiClient(k8s.CoreV1Api);

    // Test 1: List secrets (this should work)
    try {
      console.log('\n3. Testing Core API - List Secrets...');
      const secrets = await coreApi.listNamespacedSecret({ namespace });
      console.log(`   ✅ Secrets API works: found ${secrets.body.items?.length || 0} secrets`);

      // Look for any credential secrets
      const credentialSecrets = secrets.body.items?.filter(secret =>
        secret.metadata?.name?.includes('conn-credential')
      ) || [];

      console.log(`   Found ${credentialSecrets.length} credential secrets:`);
      credentialSecrets.forEach(secret => {
        console.log(`     - ${secret.metadata?.name}`);
      });

    } catch (error) {
      console.log(`   ❌ Secrets API failed: ${error}`);
    }

    // Test 2: List KubeBlocks clusters (this is failing)
    try {
      console.log('\n4. Testing Custom Objects API - List KubeBlocks Clusters...');

      const clustersResponse = await customObjectsApi.listNamespacedCustomObject({
        group: 'apps.kubeblocks.io',
        version: 'v1alpha1',
        namespace: namespace,
        plural: 'clusters'
      });

      console.log(`   Raw response analysis:`);
      console.log(`     - Response type: ${typeof clustersResponse}`);
      console.log(`     - Response keys: ${Object.keys(clustersResponse)}`);
      console.log(`     - Body type: ${typeof clustersResponse.body}`);
      console.log(`     - Body is null: ${clustersResponse.body === null}`);
      console.log(`     - Body is undefined: ${clustersResponse.body === undefined}`);

      if (clustersResponse.body) {
        console.log(`     - Body keys: ${Object.keys(clustersResponse.body)}`);
        console.log(`     - Has items: ${clustersResponse.body.hasOwnProperty('items')}`);
        console.log(`     - Items type: ${typeof (clustersResponse.body as any).items}`);
        console.log(`     - Items length: ${Array.isArray((clustersResponse.body as any).items) ? (clustersResponse.body as any).items.length : 'N/A'}`);
      }

      // Check if we get any clusters
      const body = clustersResponse.body as any;
      if (body && body.items && Array.isArray(body.items)) {
        console.log(`   ✅ KubeBlocks API works: found ${body.items.length} clusters`);
        body.items.forEach((cluster: any, index: number) => {
          console.log(`     ${index + 1}. ${cluster.metadata?.name} (${cluster.kind})`);
        });
      } else {
        console.log(`   ⚠️  KubeBlocks API returned unexpected format`);
      }

    } catch (error) {
      console.log(`   ❌ KubeBlocks API failed: ${error}`);

      // Check if this is a CRD not found error
      if (error instanceof Error && error.message.includes('the server could not find the requested resource')) {
        console.log(`   💡 This suggests KubeBlocks CRDs are not installed`);
      }
    }

    // Test 3: Try alternative approaches
    console.log('\n5. Testing alternative resource discovery...');

    try {
      // Try to list all custom resource definitions
      const apiExtensionsApi = kc.makeApiClient(k8s.ApiextensionsV1Api);
      const crds = await apiExtensionsApi.listCustomResourceDefinition();

      const kubeblocksCSRDs = crds.body.items.filter(crd =>
        crd.metadata?.name?.includes('kubeblocks') ||
        crd.spec?.group?.includes('kubeblocks')
      );

      console.log(`   Found ${kubeblocksCSRDs.length} KubeBlocks CRDs:`);
      kubeblocksCSRDs.forEach(crd => {
        console.log(`     - ${crd.metadata?.name}`);
      });

      if (kubeblocksCSRDs.length === 0) {
        console.log(`   ⚠️  No KubeBlocks CRDs found - KubeBlocks may not be installed`);
      }

    } catch (error) {
      console.log(`   ❌ CRD listing failed: ${error}`);
    }

    // Test 4: Look for existing database pods/deployments
    console.log('\n6. Looking for existing database resources...');

    try {
      const deployments = await k8sService.getSandboxStatus('fullstackagent');
      console.log(`   Sandbox status for 'fullstackagent': ${deployments}`);
    } catch (error) {
      console.log(`   Sandbox status check failed: ${error}`);
    }

  } catch (error) {
    console.log(`${colors.red}Fatal error during debug: ${error}${colors.reset}`);
  }
}

// Run debug if this file is executed directly
if (require.main === module) {
  debugKubernetesAPI().catch(error => {
    console.error(`${colors.red}Fatal error: ${error}${colors.reset}`);
    process.exit(1);
  });
}

export { debugKubernetesAPI };