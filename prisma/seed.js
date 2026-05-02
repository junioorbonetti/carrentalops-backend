const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash('fleet123', 10);
  await prisma.user.upsert({
    where: { email: 'demo@carrentalops.net' },
    update: {},
    create: { email: 'demo@carrentalops.net', password, name: 'Admin' },
  });

  console.log('✓ Seed complete');
  console.log('  Email: demo@carrentalops.net');
  console.log('  Password: fleet123');
}

main().catch(console.error).finally(() => prisma.$disconnect());
