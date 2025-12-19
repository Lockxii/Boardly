const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  try {
    await prisma.$connect();
    console.log('✅ Connexion à la base de données réussie !');
    const userCount = await prisma.user.count();
    console.log(`Nombre d'utilisateurs : ${userCount}`);
  } catch (e) {
    console.error('❌ Échec de la connexion :', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
