const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    const sprints = await prisma.sprint.findMany({
      select: { id: true, name: true, status: true }
    });
    console.log('---CHECK_RESULT_START---');
    console.log(JSON.stringify(sprints, null, 2));
    console.log('---CHECK_RESULT_END---');
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

check();
