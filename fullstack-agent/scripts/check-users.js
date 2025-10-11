const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== Checking all users in database ===\n');

  // Get all users
  const users = await prisma.user.findMany({
    include: {
      projects: true
    }
  });

  console.log(`Total users: ${users.length}\n`);

  users.forEach(user => {
    console.log('User:');
    console.log('  ID:', user.id);
    console.log('  Email:', user.email);
    console.log('  Name:', user.name);
    console.log('  GitHub ID:', user.githubId);
    console.log('  Created:', user.createdAt);
    console.log('  Projects:', user.projects.length);

    if (user.projects.length > 0) {
      console.log('  Project List:');
      user.projects.forEach(project => {
        console.log(`    - ${project.id}: ${project.name} (${project.status})`);
      });
    }
    console.log('---');
  });

  // Check the specific project
  console.log('\n=== Checking specific project ===\n');
  const projectId = 'cmgluqbeo00016y4svoocp4xw';
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      user: true
    }
  });

  if (project) {
    console.log('Project Owner:');
    console.log('  User ID:', project.user.id);
    console.log('  Email:', project.user.email);
    console.log('  Name:', project.user.name);
    console.log('  GitHub ID:', project.user.githubId);
  }

  // Look for users with name containing 'fanux'
  console.log('\n=== Searching for fanux ===\n');
  const fanuxUsers = await prisma.user.findMany({
    where: {
      OR: [
        { name: { contains: 'fanux', mode: 'insensitive' } },
        { email: { contains: 'fanux', mode: 'insensitive' } }
      ]
    }
  });

  if (fanuxUsers.length > 0) {
    console.log('Found users related to fanux:');
    fanuxUsers.forEach(user => {
      console.log('  ID:', user.id);
      console.log('  Email:', user.email);
      console.log('  Name:', user.name);
    });
  } else {
    console.log('No users found with name/email containing "fanux"');
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