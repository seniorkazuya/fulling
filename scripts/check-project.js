const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const projectId = 'cmgluqbeo00016y4svoocp4xw';

  // Check if project exists
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      user: true,
      sandboxes: true,
      environments: true
    }
  });

  if (project) {
    console.log('Project found:', {
      id: project.id,
      name: project.name,
      status: project.status,
      userId: project.userId,
      sandboxes: project.sandboxes.length,
      environments: project.environments.length
    });
  } else {
    console.log('Project not found with ID:', projectId);

    // Check if there are any users in the database
    const users = await prisma.user.findMany();
    console.log('Total users in database:', users.length);

    if (users.length > 0) {
      console.log('First user:', {
        id: users[0].id,
        email: users[0].email,
        name: users[0].name
      });

      // Create the project for the first user
      console.log('\nCreating project for user...');
      const newProject = await prisma.project.create({
        data: {
          id: projectId,
          name: 'Fullstack Agent',
          description: 'AI-powered fullstack development platform',
          userId: users[0].id,
          status: 'READY'
        }
      });

      // Create a sandbox for the project
      const sandbox = await prisma.sandbox.create({
        data: {
          projectId: newProject.id,
          k8sNamespace: 'default',
          k8sDeploymentName: 'fullstack-agent',
          k8sServiceName: 'fullstack-agent-service',
          publicUrl: 'https://dgkwlntjskms.usw.sealos.io',
          status: 'RUNNING'
        }
      });

      console.log('Project created successfully:', newProject);
      console.log('Sandbox created:', sandbox);
    } else {
      console.log('\nNo users found. You need to log in first through the application.');
      console.log('Visit: https://dgkwlntjskms.usw.sealos.io/login');
    }
  }
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });