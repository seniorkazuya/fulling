const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUser() {
  try {
    const user = await prisma.user.findUnique({
      where: {
        email: 'fanux@sealos.io'
      }
    });

    if (user) {
      console.log('User found:');
      console.log('ID:', user.id);
      console.log('Email:', user.email);
      console.log('Name:', user.name);
      console.log('Has Password:', !!user.password);
      console.log('GitHub ID:', user.githubId);
      console.log('Created:', user.createdAt);
    } else {
      console.log('No user found with email fanux@sealos.io');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUser();