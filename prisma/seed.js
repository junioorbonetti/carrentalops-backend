const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash('erika1011', 10);
  await prisma.user.upsert({
    where: { email: 'junioor.bonetti@gmail.com' },
    update: {},
    create: { email: 'junioor.bonetti@gmail.com', password, name: 'Junior Bonetti' },
  });

  console.log('✓ Seed complete');
  console.log('  Email: junioor.bonetti@gmail.com');
  console.log('  Password: erika1011');
}

main().catch(console.error).finally(() => prisma.$disconnect());