/**
 * Script to list and examine existing KubeBlocks clusters
 */

import { k8sService } from './kubernetes';
import * as k8s from '@kubernetes/client-node';

async function listExistingClusters() {
  console.log('🔍 Listing existing KubeBlocks clusters...\n');

  try {
    // Create API client
    const kc = new k8s.KubeConfig();
    let kubeconfigPath = require('path').join(process.cwd(), '.secret', 'kubeconfig');
    if (!require('fs').existsSync(kubeconfigPath)) {
      kubeconfigPath = require('path').join(process.cwd(), '..', '.secret', 'kubeconfig');
    }

    kc.loadFromFile(kubeconfigPath);
    const customObjectsApi = kc.makeApiClient(k8s.CustomObjectsApi);
    const namespace = k8sService.getDefaultNamespace();

    // List all KubeBlocks clusters
    const clustersResponse = await customObjectsApi.listNamespacedCustomObject({
      group: 'apps.kubeblocks.io',
      version: 'v1alpha1',
      namespace: namespace,
      plural: 'clusters'
    });

    // Use the same logic as the fixed getDatabaseSecret method
    const clusterList = clustersResponse.body || clustersResponse;
    const clusterItems = (clusterList as any)?.items || [];

    console.log(`Found ${clusterItems.length} KubeBlocks clusters in namespace '${namespace}':\n`);

    clusterItems.forEach((cluster: any, index: number) => {
      const name = cluster.metadata?.name;
      const labels = cluster.metadata?.labels || {};
      const status = cluster.status?.phase || 'Unknown';

      console.log(`${index + 1}. Cluster: ${name}`);
      console.log(`   Status: ${status}`);
      console.log(`   Labels:`);
      Object.entries(labels).forEach(([key, value]) => {
        console.log(`     ${key}: ${value}`);
      });

      // Check if this matches any expected patterns
      console.log(`   Pattern Analysis:`);

      // Check current pattern: {k8sProjectName}-agentruntime-{suffix}
      const agentRuntimeMatch = name?.match(/^(.+?)-agentruntime-(.+)$/);
      if (agentRuntimeMatch) {
        console.log(`     ✅ Matches agentruntime pattern: project='${agentRuntimeMatch[1]}', suffix='${agentRuntimeMatch[2]}'`);
      } else {
        console.log(`     ❌ Does NOT match agentruntime pattern`);
      }

      // Check if it just ends with a project name
      const simpleProjectMatch = name?.match(/^(.+)-postgresql$/);
      if (simpleProjectMatch) {
        console.log(`     ✅ Matches simple postgresql pattern: project='${simpleProjectMatch[1]}'`);
      }

      // Check for 'fullstackagent' variations
      if (name?.includes('fullstackagent')) {
        console.log(`     🎯 Contains 'fullstackagent' - this might be our target!`);
      }

      console.log('');
    });

    // Also check for credential secrets
    console.log('🔑 Looking for credential secrets...\n');
    const coreApi = kc.makeApiClient(k8s.CoreV1Api);
    const secretsResponse = await coreApi.listNamespacedSecret({ namespace });

    // Handle the same response structure issue
    const secretList = secretsResponse.body || secretsResponse;
    const secretItems = (secretList as any)?.items || [];

    const credentialSecrets = secretItems.filter((secret: any) =>
      secret.metadata?.name?.includes('conn-credential')
    );

    console.log(`Found ${credentialSecrets.length} credential secrets:`);
    credentialSecrets.forEach((secret: any, index: number) => {
      const name = secret.metadata?.name;
      const clusterName = name?.replace('-conn-credential', '');
      console.log(`${index + 1}. ${name} (cluster: ${clusterName})`);
    });

  } catch (error) {
    console.error('❌ Error listing clusters:', error);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  listExistingClusters().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { listExistingClusters };