import * as k8s from '@kubernetes/client-node';
import fs from 'fs';
import path from 'path';

async function testDirectK8sCall() {
  const kc = new k8s.KubeConfig();

  // Load kubeconfig from file
  const kubeconfigPath = path.join(process.cwd(), '.secret', 'kubeconfig');
  kc.loadFromFile(kubeconfigPath);

  const k8sApi = kc.makeApiClient(k8s.CoreV1Api);

  // Get namespace
  const currentContext = kc.getCurrentContext();
  const namespace = currentContext?.namespace || 'ns-ajno7yq7';

  console.log('Testing direct K8s API call...');
  console.log('Namespace:', namespace);

  // Create a test secret
  const secret = {
    metadata: {
      name: 'test-secret-' + Date.now(),
      namespace: namespace,
    },
    type: 'Opaque',
    stringData: {
      'test-key': 'test-value',
    },
  } as k8s.V1Secret;

  try {
    console.log('Creating secret with namespace:', namespace);
    console.log('Secret object:', JSON.stringify(secret, null, 2));

    // The correct API call should be (namespace, body)
    const result = await k8sApi.createNamespacedSecret(namespace, secret);
    console.log('✅ Secret created successfully!');
    console.log('Secret name:', result.body.metadata?.name);

    // Clean up
    await k8sApi.deleteNamespacedSecret(secret.metadata!.name!, namespace);
    console.log('✅ Secret deleted');
  } catch (error: any) {
    console.error('❌ Failed:', error?.response?.body || error.message || error);
  }
}

testDirectK8sCall().catch(console.error);