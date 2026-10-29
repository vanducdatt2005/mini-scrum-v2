const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { email: 'tungdatrang@gmail.com' },
        { fullName: { contains: 'Tung' } }
      ]
    }
  });

  console.log('--- Users found ---');
  console.log(JSON.stringify(users, null, 2));

  for (const user of users) {
    const invites = await prisma.projectMember.findMany({
      where: { userId: user.id },
      include: { project: true }
    });
    console.log(`--- Invites for ${user.email} (${user.id}) ---`);
    console.log(JSON.stringify(invites, null, 2));
  }
}

check().catch(console.error);
