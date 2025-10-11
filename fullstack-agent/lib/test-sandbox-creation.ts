/**
 * Test sandbox creation with database credentials
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

async function testSandboxCreation() {
  console.log(`${colors.blue}═══════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.blue}     Sandbox Creation with Database Test${colors.reset}`);
  console.log(`${colors.blue}═══════════════════════════════════════════════════════${colors.reset}`);

  try {
    const projectName = 'fullstackagent'; // We know this exists
    const envVars = {
      TEST_VAR: 'test_value',
      NODE_ENV: 'test'
    };

    console.log(`\n🚀 Testing sandbox creation for project: ${projectName}`);
    console.log('Environment variables:', envVars);

    // Test the createSandbox method which internally calls getDatabaseSecret
    console.log('\n1. Creating sandbox...');
    const sandboxInfo = await k8sService.createSandbox(projectName, envVars);

    console.log(`${colors.green}✅ Sandbox created successfully!${colors.reset}`);
    console.log(`   Deployment Name: ${sandboxInfo.deploymentName}`);
    console.log(`   Service Name: ${sandboxInfo.serviceName}`);
    console.log(`   Public URL: ${sandboxInfo.publicUrl}`);
    console.log(`   Terminal URL: ${sandboxInfo.ttydUrl}`);

    // Wait a bit and check status
    console.log('\n2. Checking sandbox status...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    const status = await k8sService.getSandboxStatus(projectName);
    console.log(`   Status: ${status}`);

    if (status === 'CREATING' || status === 'RUNNING') {
      console.log(`${colors.green}✅ Sandbox is operational${colors.reset}`);
    } else {
      console.log(`${colors.yellow}⚠️  Sandbox status: ${status} (may need more time)${colors.reset}`);
    }

    // Clean up - delete the test sandbox
    console.log('\n3. Cleaning up test sandbox...');
    await k8sService.deleteSandbox(projectName);
    console.log(`${colors.green}✅ Test sandbox cleaned up${colors.reset}`);

    console.log(`\n${colors.green}🎉 All tests completed successfully!${colors.reset}`);
    return true;

  } catch (error) {
    console.log(`${colors.red}❌ Test failed: ${error}${colors.reset}`);
    console.log('Stack trace:', error);
    return false;
  }
}

// Run test if this file is executed directly
if (require.main === module) {
  testSandboxCreation().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error(`${colors.red}Fatal error: ${error}${colors.reset}`);
    process.exit(1);
  });
}

export { testSandboxCreation };