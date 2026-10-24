const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const email = 'demo@polyrag.ai';
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (!existingUser) {
    const passwordHash = await bcrypt.hash('Demo@12345', 10);
    const user = await prisma.user.create({
      data: {
        email,
        name: 'Demo User',
        passwordHash,
        defaultLanguage: 'auto',
        interfaceLanguage: 'en',
        theme: 'system',
      },
    });
    console.log(`✓ Seeded demo user: ${user.email} (Password: Demo@12345)`);
  } else {
    console.log(`Demo user ${email} already exists.`);
  }
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
