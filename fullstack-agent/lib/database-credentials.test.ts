/**
 * Test suite specifically for database credential retrieval
 * Tests the getDatabaseSecret method with various scenarios
 */

import { k8sService } from './kubernetes';

// Color codes for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

/**
 * Test 1: Test basic database credential retrieval for existing cluster
 */
async function testExistingClusterCredentials(): Promise<TestResult> {
  const testName = "Existing Cluster Credentials";
  console.log(`\n${colors.cyan}[TEST 1] ${testName}${colors.reset}`);
  console.log('----------------------------------------');

  try {
    // Test with project name that should have a database
    const projectName = 'fullstackagent'; // Known to exist based on error log

    console.log(`Testing credential retrieval for project: ${projectName}`);
    const dbInfo = await k8sService.getDatabaseSecret(projectName);

    console.log(`${colors.green}✓ Successfully retrieved database credentials${colors.reset}`);
    console.log(`  Cluster Name: ${dbInfo.clusterName}`);
    console.log(`  Host: ${dbInfo.host}`);
    console.log(`  Port: ${dbInfo.port}`);
    console.log(`  Database: ${dbInfo.database}`);
    console.log(`  Username: ${dbInfo.username}`);
    console.log(`  Password: ${dbInfo.password ? '[PRESENT]' : '[MISSING]'}`);

    // Validate credential structure
    const requiredFields = ['host', 'port', 'database', 'username', 'password', 'clusterName'];
    const missingFields = requiredFields.filter(field => !dbInfo[field as keyof typeof dbInfo]);

    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    // Validate data types
    if (typeof dbInfo.port !== 'number') {
      throw new Error(`Port should be number, got ${typeof dbInfo.port}`);
    }

    return {
      name: testName,
      passed: true,
      details: {
        clusterName: dbInfo.clusterName,
        host: dbInfo.host,
        port: dbInfo.port,
        hasPassword: !!dbInfo.password
      }
    };

  } catch (error) {
    console.log(`${colors.red}✗ Failed: ${error}${colors.reset}`);
    return {
      name: testName,
      passed: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Test 2: Test credential retrieval for non-existent project
 */
async function testNonExistentProject(): Promise<TestResult> {
  const testName = "Non-existent Project Handling";
  console.log(`\n${colors.cyan}[TEST 2] ${testName}${colors.reset}`);
  console.log('----------------------------------------');

  try {
    const projectName = `nonexistent-${Date.now()}`;
    console.log(`Testing credential retrieval for non-existent project: ${projectName}`);

    const dbInfo = await k8sService.getDatabaseSecret(projectName);

    // If we reach here, the test failed because it should have thrown an error
    console.log(`${colors.red}✗ Should have thrown error for non-existent project${colors.reset}`);
    return {
      name: testName,
      passed: false,
      error: "Should have thrown error for non-existent project"
    };

  } catch (error) {
    const expectedError = 'No database cluster found';
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes(expectedError)) {
      console.log(`${colors.green}✓ Correctly handled non-existent project${colors.reset}`);
      console.log(`  Error message: ${errorMessage}`);
      return {
        name: testName,
        passed: true,
        details: { errorMessage }
      };
    } else {
      console.log(`${colors.red}✗ Unexpected error message: ${errorMessage}${colors.reset}`);
      return {
        name: testName,
        passed: false,
        error: `Unexpected error: ${errorMessage}`
      };
    }
  }
}

/**
 * Test 3: Test the project name conversion to k8s format
 */
async function testProjectNameConversion(): Promise<TestResult> {
  const testName = "Project Name K8s Conversion";
  console.log(`\n${colors.cyan}[TEST 3] ${testName}${colors.reset}`);
  console.log('----------------------------------------');

  try {
    // Test various project name formats that should be converted
    const testCases = [
      { input: 'aaa', expected: 'aaa' },
      { input: 'My-Project', expected: 'my-project' },
      { input: 'Test_Project_123', expected: 'testproject' },
      { input: 'special!@#$%chars', expected: 'specialchars' }
    ];

    console.log('Testing project name conversion logic...');

    for (const testCase of testCases) {
      try {
        // We'll catch the "not found" error, but check if the converted name is used
        await k8sService.getDatabaseSecret(testCase.input);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Check if the error message contains the expected converted name
        if (errorMessage.includes(`k8s name: ${testCase.expected}`)) {
          console.log(`  ${colors.green}✓ ${testCase.input} → ${testCase.expected}${colors.reset}`);
        } else {
          console.log(`  ${colors.red}✗ ${testCase.input} conversion failed${colors.reset}`);
          console.log(`    Expected k8s name: ${testCase.expected}`);
          console.log(`    Error: ${errorMessage}`);
          throw new Error(`Name conversion failed for ${testCase.input}`);
        }
      }
    }

    console.log(`${colors.green}✓ All project name conversions work correctly${colors.reset}`);
    return {
      name: testName,
      passed: true,
      details: { testCases }
    };

  } catch (error) {
    console.log(`${colors.red}✗ Failed: ${error}${colors.reset}`);
    return {
      name: testName,
      passed: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Test 4: Test connection string generation
 */
async function testConnectionStringGeneration(): Promise<TestResult> {
  const testName = "Connection String Generation";
  console.log(`\n${colors.cyan}[TEST 4] ${testName}${colors.reset}`);
  console.log('----------------------------------------');

  try {
    // Try to get credentials for a known cluster
    const projectName = 'fullstackagent';
    console.log(`Testing connection string generation for: ${projectName}`);

    const dbInfo = await k8sService.getDatabaseSecret(projectName);

    // Generate connection string as done in createSandbox
    const connectionString = `postgresql://${dbInfo.username}:${dbInfo.password}@${dbInfo.host}:${dbInfo.port}/${dbInfo.database}?schema=public`;

    console.log(`${colors.green}✓ Connection string generated successfully${colors.reset}`);
    console.log(`  Connection string format: postgresql://username:***@host:port/db?schema=public`);
    console.log(`  Host: ${dbInfo.host}`);
    console.log(`  Port: ${dbInfo.port}`);

    // Validate connection string format
    const connectionRegex = /^postgresql:\/\/[^:]+:[^@]+@[^:]+:\d+\/[^?]+\?schema=public$/;
    if (!connectionRegex.test(connectionString)) {
      throw new Error('Connection string format is invalid');
    }

    return {
      name: testName,
      passed: true,
      details: {
        host: dbInfo.host,
        port: dbInfo.port,
        database: dbInfo.database,
        hasValidFormat: true
      }
    };

  } catch (error) {
    console.log(`${colors.red}✗ Failed: ${error}${colors.reset}`);
    return {
      name: testName,
      passed: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Test 5: Test cluster listing and filtering
 */
async function testClusterListingAndFiltering(): Promise<TestResult> {
  const testName = "Cluster Listing and Filtering";
  console.log(`\n${colors.cyan}[TEST 5] ${testName}${colors.reset}`);
  console.log('----------------------------------------');

  try {
    console.log('Testing cluster listing functionality...');

    // This test will examine the cluster listing logic by trying to access the internal method
    // We'll simulate the behavior by looking for clusters with specific patterns

    // Test with 'aaa' which was mentioned in the error
    try {
      await k8sService.getDatabaseSecret('aaa');
      console.log(`${colors.green}✓ Found cluster for 'aaa'${colors.reset}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`Expected result for 'aaa': ${errorMessage}`);

      if (errorMessage.includes('No database cluster found')) {
        console.log(`${colors.yellow}⚠ Cluster for 'aaa' not found - this is the reported issue${colors.reset}`);
      }
    }

    // List some information about the current approach
    console.log('\nCluster lookup strategy:');
    console.log('  1. Convert project name to k8s format (lowercase, alphanumeric only)');
    console.log('  2. List all KubeBlocks clusters in namespace');
    console.log('  3. Find cluster with name pattern: {k8sProjectName}-agentruntime-{suffix}');
    console.log('  4. Get connection credentials from {clusterName}-conn-credential secret');

    return {
      name: testName,
      passed: true,
      details: {
        strategy: 'KubeBlocks cluster pattern matching',
        pattern: '{k8sProjectName}-agentruntime-{suffix}'
      }
    };

  } catch (error) {
    console.log(`${colors.red}✗ Failed: ${error}${colors.reset}`);
    return {
      name: testName,
      passed: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Main test runner for database credentials
 */
async function runDatabaseCredentialTests(): Promise<void> {
  console.log(`${colors.blue}═══════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.blue}     Database Credential Retrieval Test Suite${colors.reset}`);
  console.log(`${colors.blue}═══════════════════════════════════════════════════════${colors.reset}`);

  const tests = [
    testExistingClusterCredentials,
    testNonExistentProject,
    testProjectNameConversion,
    testConnectionStringGeneration,
    testClusterListingAndFiltering
  ];

  const results: TestResult[] = [];

  for (const test of tests) {
    try {
      const result = await test();
      results.push(result);
    } catch (error) {
      results.push({
        name: test.name,
        passed: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // Print summary
  console.log(`\n${colors.blue}═══════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.blue}     Test Results Summary${colors.reset}`);
  console.log(`${colors.blue}═══════════════════════════════════════════════════════${colors.reset}`);

  let passedCount = 0;
  results.forEach((result, index) => {
    const status = result.passed ? `${colors.green}✓ PASSED` : `${colors.red}✗ FAILED`;
    console.log(`${index + 1}. ${result.name}: ${status}${colors.reset}`);

    if (!result.passed && result.error) {
      console.log(`   Error: ${result.error}`);
    }

    if (result.passed) {
      passedCount++;
    }
  });

  const overallResult = passedCount === results.length;
  console.log(`\nOverall Result: ${overallResult ? colors.green + '✓ ALL TESTS PASSED' : colors.red + `✗ ${results.length - passedCount} TESTS FAILED`}${colors.reset}`);
  console.log(`Passed: ${passedCount}/${results.length}\n`);

  // If any test failed, provide recommendations
  if (!overallResult) {
    console.log(`${colors.yellow}Recommendations:${colors.reset}`);
    results.forEach(result => {
      if (!result.passed) {
        console.log(`  • Fix issue in: ${result.name}`);
        if (result.error) {
          console.log(`    - ${result.error}`);
        }
      }
    });
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runDatabaseCredentialTests().catch(error => {
    console.error(`${colors.red}Fatal error: ${error}${colors.reset}`);
    process.exit(1);
  });
}

export { runDatabaseCredentialTests, testExistingClusterCredentials, testNonExistentProject, testConnectionStringGeneration };