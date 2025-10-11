/**
 * Simulate real sandbox creation to identify the actual error
 * This creates a real project in the database and tests the full flow
 */

import { prisma } from './db';
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

async function simulateRealSandboxCreation() {
  console.log(`${colors.blue}═══════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.blue}     Simulating Real Sandbox Creation Flow${colors.reset}`);
  console.log(`${colors.blue}═══════════════════════════════════════════════════════${colors.reset}`);

  const testProjectName = 'test-sandbox-sim';
  let testProject: any;

  try {
    // Step 1: Create a test project in the database (like a real user would)
    console.log('\n1. Creating test project in database...');

    // First check if project already exists
    const existingProject = await prisma.project.findFirst({
      where: { name: testProjectName }
    });

    if (existingProject) {
      console.log(`   Using existing project: ${existingProject.id}`);
      testProject = existingProject;
    } else {
      testProject = await prisma.project.create({
        data: {
          name: testProjectName,
          description: 'Test project for simulating sandbox creation',
          userId: 'test-user-id', // This would be a real user ID
          status: 'READY',
          githubRepo: null,
          databaseUrl: null
        }
      });
      console.log(`   Created project: ${testProject.id}`);
    }

    // Step 2: Simulate the API route logic
    console.log('\n2. Simulating API route logic...');

    const projectId = testProject.id;
    const k8sNamespace = k8sService.getDefaultNamespace();
    const allEnvVars = {
      TEST_VAR: 'simulation_test',
      NODE_ENV: 'test'
    };

    console.log(`   Project ID: ${projectId}`);
    console.log(`   Namespace: ${k8sNamespace}`);
    console.log(`   Environment variables:`, allEnvVars);

    // Step 3: Check if project needs database creation
    console.log('\n3. Checking database requirements...');

    let databaseCredentials = undefined;
    if (!testProject.databaseUrl) {
      console.log(`   Project needs database creation`);

      try {
        console.log(`   Creating PostgreSQL database for project: ${testProject.name}`);
        const dbInfo = await k8sService.createPostgreSQLDatabase(testProject.name, k8sNamespace);

        databaseCredentials = dbInfo;
        console.log(`   Database created: ${dbInfo.clusterName}`);

        // Update project with database URL
        const databaseUrl = `postgresql://${dbInfo.username}:${dbInfo.password}@${dbInfo.host}:${dbInfo.port}/${dbInfo.database}?schema=public`;
        await prisma.project.update({
          where: { id: projectId },
          data: {
            databaseUrl: databaseUrl,
          },
        });
        console.log(`   Project updated with database URL`);

      } catch (dbError) {
        console.log(`${colors.red}   ❌ Database creation failed: ${dbError}${colors.reset}`);
        throw dbError;
      }
    } else {
      console.log(`   Project already has database: ${testProject.databaseUrl}`);
    }

    // Step 4: Create sandbox
    console.log('\n4. Creating sandbox deployment...');

    try {
      const sandboxInfo = await k8sService.createSandbox(testProject.name, allEnvVars, k8sNamespace, databaseCredentials);

      console.log(`${colors.green}   ✅ Sandbox created successfully!${colors.reset}`);
      console.log(`   Deployment: ${sandboxInfo.deploymentName}`);
      console.log(`   Public URL: ${sandboxInfo.publicUrl}`);
      console.log(`   Terminal URL: ${sandboxInfo.ttydUrl}`);

      // Step 5: Update/create sandbox record
      console.log('\n5. Updating database records...');

      const existingSandbox = await prisma.sandbox.findFirst({
        where: { projectId: projectId }
      });

      let sandbox;
      if (existingSandbox) {
        sandbox = await prisma.sandbox.update({
          where: { id: existingSandbox.id },
          data: {
            k8sNamespace,
            k8sDeploymentName: sandboxInfo.deploymentName,
            k8sServiceName: sandboxInfo.serviceName,
            publicUrl: sandboxInfo.publicUrl,
            ttydUrl: sandboxInfo.ttydUrl,
            status: "CREATING",
          },
        });
        console.log(`   Updated existing sandbox record`);
      } else {
        sandbox = await prisma.sandbox.create({
          data: {
            projectId: projectId,
            k8sNamespace,
            k8sDeploymentName: sandboxInfo.deploymentName,
            k8sServiceName: sandboxInfo.serviceName,
            publicUrl: sandboxInfo.publicUrl,
            ttydUrl: sandboxInfo.ttydUrl,
            status: "CREATING",
          },
        });
        console.log(`   Created new sandbox record`);
      }

      // Step 6: Test status checking
      console.log('\n6. Testing sandbox status...');
      await new Promise(resolve => setTimeout(resolve, 3000));

      const status = await k8sService.getSandboxStatus(testProject.name, k8sNamespace);
      console.log(`   Current status: ${status}`);

      if (status === 'RUNNING') {
        await prisma.sandbox.update({
          where: { id: sandbox.id },
          data: { status: "RUNNING" },
        });
        console.log(`   Updated sandbox to RUNNING status`);
      }

      console.log(`\n${colors.green}🎉 Simulation completed successfully!${colors.reset}`);
      console.log(`\n${colors.cyan}Results:${colors.reset}`);
      console.log(`  • Project created: ${testProject.name}`);
      console.log(`  • Database created: ${databaseCredentials?.clusterName || 'Not needed'}`);
      console.log(`  • Sandbox deployed: ${sandboxInfo.deploymentName}`);
      console.log(`  • Terminal URL: ${sandboxInfo.ttydUrl}`);
      console.log(`  • Status: ${status}`);

      return {
        success: true,
        projectId: testProject.id,
        sandboxInfo,
        status
      };

    } catch (sandboxError) {
      console.log(`${colors.red}   ❌ Sandbox creation failed: ${sandboxError}${colors.reset}`);
      throw sandboxError;
    }

  } catch (error) {
    console.log(`${colors.red}❌ Simulation failed: ${error}${colors.reset}`);
    console.log('Stack trace:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Run simulation if this file is executed directly
if (require.main === module) {
  simulateRealSandboxCreation().then(result => {
    console.log('\n' + '='.repeat(60));
    console.log(result.success ? 'SIMULATION SUCCESSFUL' : 'SIMULATION FAILED');
    console.log('='.repeat(60));
    process.exit(result.success ? 0 : 1);
  }).catch(error => {
    console.error(`${colors.red}Fatal error: ${error}${colors.reset}`);
    process.exit(1);
  });
}

export { simulateRealSandboxCreation };