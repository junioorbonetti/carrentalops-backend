const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash('erika1011', 10);
  await prisma.user.upsert({
    where: { email: 'juniorbonetti' },
    update: {},
    create: { email: 'juniorbonetti', password, name: 'Junior Bonetti' },
  });

  console.log('✓ Seed complete');
  console.log('  Email: juniorbonetti);
  console.log('  Password: erika1011');
}

main().catch(console.error).finally(() => prisma.$disconnect());
