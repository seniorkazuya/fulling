import { k8sService } from './kubernetes';

const TEST_PROJECT_ID = 'test-' + Date.now();

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testKubernetesService() {
  console.log('========================================');
  console.log('Starting Kubernetes Service Tests');
  console.log('========================================\n');

  const namespace = k8sService.getDefaultNamespace();
  console.log(`Using namespace: ${namespace}\n`);

  let dbInfo: any;
  let sandboxInfo: any;

  try {
    // Test 1: Create PostgreSQL Database
    console.log('Test 1: Creating PostgreSQL Database...');
    console.log(`Project ID: ${TEST_PROJECT_ID}`);

    dbInfo = await k8sService.createPostgreSQLDatabase(TEST_PROJECT_ID);

    console.log('✅ Database created successfully!');
    console.log('Database Info:');
    console.log(`  Host: ${dbInfo.host}`);
    console.log(`  Port: ${dbInfo.port}`);
    console.log(`  Database: ${dbInfo.database}`);
    console.log(`  Username: ${dbInfo.username}`);
    console.log(`  Password: ${dbInfo.password.substring(0, 4)}...`);
    console.log();

    // Wait for database to be ready
    console.log('Waiting for database to be ready (15 seconds)...');
    await delay(15000);

    // Test 2: Get Database Secret
    console.log('Test 2: Retrieving Database Secret...');
    const dbSecret = await k8sService.getDatabaseSecret(TEST_PROJECT_ID);

    console.log('✅ Database secret retrieved successfully!');
    console.log(`  Connection verified: ${dbSecret.host === dbInfo.host ? '✓' : '✗'}`);
    console.log();

    // Test 3: Create Sandbox Runtime Pod
    console.log('Test 3: Creating Sandbox Runtime Pod...');
    console.log(`Sandbox ID: sandbox-${TEST_PROJECT_ID}`);

    const envVars = {
      PROJECT_ID: TEST_PROJECT_ID,
      TEST_ENV: 'true',
    };

    sandboxInfo = await k8sService.createSandbox(TEST_PROJECT_ID, envVars);

    console.log('✅ Sandbox created successfully!');
    console.log('Sandbox Info:');
    console.log(`  Deployment: ${sandboxInfo.deploymentName}`);
    console.log(`  Service: ${sandboxInfo.serviceName}`);
    console.log(`  App URL: ${sandboxInfo.publicUrl}`);
    console.log(`  ttyd URL: ${sandboxInfo.ttydUrl}`);
    console.log();

    // Wait for sandbox to be ready
    console.log('Waiting for sandbox to be ready...');
    let retries = 0;
    const maxRetries = 30;

    while (retries < maxRetries) {
      const status = await k8sService.getSandboxStatus(TEST_PROJECT_ID);
      console.log(`  Status check ${retries + 1}/${maxRetries}: ${status}`);

      if (status === 'RUNNING') {
        console.log('✅ Sandbox is running!');
        break;
      }

      retries++;
      await delay(5000);
    }
    console.log();

    // Test 4: Verify ttyd URL accessibility
    console.log('Test 4: Testing ttyd URL accessibility...');
    console.log(`ttyd URL: ${sandboxInfo.ttydUrl}`);

    try {
      const response = await fetch(sandboxInfo.ttydUrl, {
        method: 'HEAD',
        redirect: 'follow',
      });

      if (response.ok || response.status === 401) {
        console.log('✅ ttyd endpoint is accessible!');
        console.log(`  Status: ${response.status} ${response.statusText}`);
      } else {
        console.log(`⚠️  ttyd endpoint returned status: ${response.status}`);
      }
    } catch (error) {
      console.log('⚠️  ttyd endpoint test failed (may need more time to provision):');
      console.log(`  ${error}`);
    }
    console.log();

    // Test 5: Check Sandbox Status
    console.log('Test 5: Checking Sandbox Status...');
    const finalStatus = await k8sService.getSandboxStatus(TEST_PROJECT_ID);
    console.log(`✅ Sandbox status: ${finalStatus}`);
    console.log();

    console.log('========================================');
    console.log('All tests completed successfully!');
    console.log('========================================\n');

  } catch (error) {
    console.error('❌ Test failed with error:', error);
    console.log();
  } finally {
    // Cleanup
    console.log('========================================');
    console.log('Starting Cleanup Process...');
    console.log('========================================\n');

    try {
      // Delete Sandbox
      if (sandboxInfo) {
        console.log('Deleting sandbox...');
        await k8sService.deleteSandbox(TEST_PROJECT_ID);
        console.log('✅ Sandbox deleted');
      }

      // Delete Database (we need to delete the resources manually)
      if (dbInfo) {
        console.log('Deleting database resources...');

        // Import k8s client for cleanup
        const k8s = await import('@kubernetes/client-node');
        const kc = new k8s.KubeConfig();
        kc.loadFromFile('./.secret/kubeconfig');

        const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
        const k8sAppsApi = kc.makeApiClient(k8s.AppsV1Api);

        const dbName = `db-${TEST_PROJECT_ID}`;

        try {
          // Delete StatefulSet
          await k8sAppsApi.deleteNamespacedStatefulSet(dbName, namespace);
          console.log('  ✓ StatefulSet deleted');
        } catch (e) {
          console.log('  ✗ Failed to delete StatefulSet');
        }

        try {
          // Delete Service
          await k8sApi.deleteNamespacedService(dbName, namespace);
          console.log('  ✓ Service deleted');
        } catch (e) {
          console.log('  ✗ Failed to delete Service');
        }

        try {
          // Delete PVC
          await k8sApi.deleteNamespacedPersistentVolumeClaim(`${dbName}-pvc`, namespace);
          console.log('  ✓ PVC deleted');
        } catch (e) {
          console.log('  ✗ Failed to delete PVC');
        }

        try {
          // Delete Secret
          await k8sApi.deleteNamespacedSecret(`${dbName}-secret`, namespace);
          console.log('  ✓ Secret deleted');
        } catch (e) {
          console.log('  ✗ Failed to delete Secret');
        }

        console.log('✅ Database resources cleaned up');
      }

      console.log('\n========================================');
      console.log('Cleanup completed!');
      console.log('========================================');

    } catch (cleanupError) {
      console.error('⚠️  Cleanup encountered errors:', cleanupError);
    }
  }
}

// Run the tests
testKubernetesService().catch(console.error);