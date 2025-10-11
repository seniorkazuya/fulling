/**
 * Test suite for Kubernetes service
 * Tests the creation of sandbox pods, database, and cleanup
 */

import { k8sService } from './kubernetes';
import * as https from 'https';

// Test configuration
const TEST_PROJECT_ID = `test-${Date.now()}`;
const TEST_ENV_VARS = {
  TEST_VAR: 'test_value',
  NODE_ENV: 'test'
};

// Color codes for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Test utilities
async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function checkUrlAccessible(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      resolve(res.statusCode !== undefined && res.statusCode < 500);
    }).on('error', () => {
      resolve(false);
    });
  });
}

// Test functions
async function testCreatePostgreSQLDatabase() {
  console.log(`\n${colors.cyan}[TEST 1] Testing PostgreSQL Database Creation${colors.reset}`);
  console.log('----------------------------------------');

  try {
    console.log(`Creating database for project: ${TEST_PROJECT_ID}...`);
    const dbInfo = await k8sService.createPostgreSQLDatabase(TEST_PROJECT_ID);

    console.log(`${colors.green}✓ Database created successfully${colors.reset}`);
    console.log(`  Host: ${dbInfo.host}`);
    console.log(`  Port: ${dbInfo.port}`);
    console.log(`  Database: ${dbInfo.database}`);
    console.log(`  Username: ${dbInfo.username}`);
    console.log(`  Password: ${dbInfo.password ? '[HIDDEN]' : 'N/A'}`);

    // Verify we can retrieve the database secret
    console.log('\nVerifying database secret retrieval...');
    const secretInfo = await k8sService.getDatabaseSecret(TEST_PROJECT_ID);

    if (secretInfo.password === dbInfo.password) {
      console.log(`${colors.green}✓ Database secret retrieved successfully${colors.reset}`);
      return true;
    } else {
      console.log(`${colors.red}✗ Database secret mismatch${colors.reset}`);
      return false;
    }
  } catch (error) {
    console.log(`${colors.red}✗ Failed to create database: ${error}${colors.reset}`);
    return false;
  }
}

async function testCreateSandbox() {
  console.log(`\n${colors.cyan}[TEST 2] Testing Sandbox Pod Creation${colors.reset}`);
  console.log('----------------------------------------');

  try {
    console.log(`Creating sandbox for project: ${TEST_PROJECT_ID}...`);
    const sandboxInfo = await k8sService.createSandbox(TEST_PROJECT_ID, TEST_ENV_VARS);

    console.log(`${colors.green}✓ Sandbox created successfully${colors.reset}`);
    console.log(`  Deployment: ${sandboxInfo.deploymentName}`);
    console.log(`  Service: ${sandboxInfo.serviceName}`);
    console.log(`  Public URL: ${sandboxInfo.publicUrl}`);
    console.log(`  ttyd URL: ${sandboxInfo.ttydUrl}`);

    // Wait for pod to be ready
    console.log('\nWaiting for pod to be ready...');
    let retries = 30; // Wait up to 60 seconds
    let status = 'CREATING';

    while (retries > 0 && status !== 'RUNNING') {
      await delay(2000);
      status = await k8sService.getSandboxStatus(TEST_PROJECT_ID);
      console.log(`  Status: ${status} (${31 - retries}/30)`);
      retries--;
    }

    if (status === 'RUNNING') {
      console.log(`${colors.green}✓ Pod is running${colors.reset}`);

      // Test ttyd URL accessibility
      console.log('\nTesting ttyd URL accessibility...');
      console.log(`  Checking: ${sandboxInfo.ttydUrl}`);

      // Wait a bit more for ingress to be ready
      await delay(5000);

      const isAccessible = await checkUrlAccessible(sandboxInfo.ttydUrl);
      if (isAccessible) {
        console.log(`${colors.green}✓ ttyd URL is accessible${colors.reset}`);
      } else {
        console.log(`${colors.yellow}⚠ ttyd URL not accessible (might need more time for ingress)${colors.reset}`);
      }

      return true;
    } else {
      console.log(`${colors.red}✗ Pod failed to reach RUNNING state${colors.reset}`);
      return false;
    }
  } catch (error) {
    console.log(`${colors.red}✗ Failed to create sandbox: ${error}${colors.reset}`);
    return false;
  }
}

async function testCleanup() {
  console.log(`\n${colors.cyan}[TEST 3] Testing Cleanup${colors.reset}`);
  console.log('----------------------------------------');

  try {
    console.log('Deleting sandbox...');
    await k8sService.deleteSandbox(TEST_PROJECT_ID);
    console.log(`${colors.green}✓ Sandbox deleted${colors.reset}`);

    // Verify sandbox is deleted
    await delay(2000);
    const status = await k8sService.getSandboxStatus(TEST_PROJECT_ID);

    if (status === 'TERMINATED' || status === 'ERROR') {
      console.log(`${colors.green}✓ Sandbox successfully removed (status: ${status})${colors.reset}`);
    } else {
      console.log(`${colors.yellow}⚠ Sandbox status: ${status} (might still be terminating)${colors.reset}`);
    }

    // Note: We're not deleting the database in this test as it would require
    // deleting StatefulSet, Service, PVC, and Secret separately
    console.log(`${colors.yellow}Note: Database resources not deleted (manual cleanup required)${colors.reset}`);

    return true;
  } catch (error) {
    console.log(`${colors.red}✗ Failed during cleanup: ${error}${colors.reset}`);
    return false;
  }
}

// Main test runner
async function runTests() {
  console.log(`${colors.blue}═══════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.blue}     Kubernetes Service Test Suite${colors.reset}`);
  console.log(`${colors.blue}═══════════════════════════════════════════════════════${colors.reset}`);

  const results = {
    database: false,
    sandbox: false,
    cleanup: false
  };

  try {
    // Run tests sequentially
    results.database = await testCreatePostgreSQLDatabase();

    if (results.database) {
      results.sandbox = await testCreateSandbox();

      if (results.sandbox) {
        // Wait a bit before cleanup to ensure everything is stable
        console.log('\n⏳ Waiting before cleanup...');
        await delay(5000);
      }
    }

    // Always attempt cleanup
    results.cleanup = await testCleanup();

  } catch (error) {
    console.error(`${colors.red}Unexpected error during tests: ${error}${colors.reset}`);
  }

  // Print summary
  console.log(`\n${colors.blue}═══════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.blue}     Test Summary${colors.reset}`);
  console.log(`${colors.blue}═══════════════════════════════════════════════════════${colors.reset}`);

  console.log(`Database Creation: ${results.database ? colors.green + '✓ PASSED' : colors.red + '✗ FAILED'}${colors.reset}`);
  console.log(`Sandbox Creation:  ${results.sandbox ? colors.green + '✓ PASSED' : colors.red + '✗ FAILED'}${colors.reset}`);
  console.log(`Cleanup:          ${results.cleanup ? colors.green + '✓ PASSED' : colors.red + '✗ FAILED'}${colors.reset}`);

  const allPassed = results.database && results.sandbox && results.cleanup;
  console.log(`\nOverall Result: ${allPassed ? colors.green + '✓ ALL TESTS PASSED' : colors.red + '✗ SOME TESTS FAILED'}${colors.reset}`);

  // Exit with appropriate code
  process.exit(allPassed ? 0 : 1);
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(error => {
    console.error(`${colors.red}Fatal error: ${error}${colors.reset}`);
    process.exit(1);
  });
}

export { runTests, testCreatePostgreSQLDatabase, testCreateSandbox, testCleanup };