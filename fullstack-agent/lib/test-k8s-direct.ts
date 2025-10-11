import * as k8s from '@kubernetes/client-node';
import * as fs from 'fs';
import * as path from 'path';

async function testDirectAPI() {
  const kc = new k8s.KubeConfig();

  // Load kubeconfig - try multiple locations
  let kubeconfigPath = path.join(process.cwd(), '.secret', 'kubeconfig');

  if (!fs.existsSync(kubeconfigPath)) {
    kubeconfigPath = path.join(process.cwd(), '..', '.secret', 'kubeconfig');
  }

  console.log('Loading kubeconfig from:', kubeconfigPath);

  if (fs.existsSync(kubeconfigPath)) {
    kc.loadFromFile(kubeconfigPath);
  } else {
    console.error('Kubeconfig file not found!');
    return;
  }

  const k8sApi = kc.makeApiClient(k8s.CoreV1Api);

  // Get current context
  const contexts = kc.getContexts();
  console.log('Available contexts:', contexts.map(c => c.name));

  const currentContextName = kc.getCurrentContext();
  console.log('Current context name:', currentContextName);

  const currentContext = contexts.find(c => c.name === currentContextName);
  console.log('Current context object:', currentContext);

  // Get namespace from context
  const namespace = currentContext?.namespace || 'ns-ajno7yq7';
  console.log('Using namespace:', namespace);
  console.log('Namespace type:', typeof namespace);
  console.log('Namespace is null?', namespace === null);
  console.log('Namespace is undefined?', namespace === undefined);

  // Test creating a simple ConfigMap
  const testName = `test-configmap-${Date.now()}`;

  const configMap = {
    metadata: {
      name: testName,
      namespace: namespace,
    },
    data: {
      'test-key': 'test-value',
    },
  };

  try {
    console.log('\nAttempting to create ConfigMap...');
    console.log('ConfigMap object:', JSON.stringify(configMap, null, 2));

    // The new API expects a request object with namespace and body properties
    const response = await k8sApi.createNamespacedConfigMap({
      namespace: namespace,
      body: configMap as any
    });
    console.log('✅ ConfigMap created successfully!');
    console.log('Response:', response.metadata?.name);

    // Clean up - delete the test ConfigMap
    console.log('\nCleaning up...');
    await k8sApi.deleteNamespacedConfigMap({
      name: testName,
      namespace: namespace
    });
    console.log('✅ ConfigMap deleted successfully!');

  } catch (error: any) {
    console.error('❌ Error:', error.message || error);
    if (error.response) {
      console.error('Response body:', error.response.body);
    }
  }
}

testDirectAPI().catch(console.error);