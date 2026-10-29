const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    const activeSprint = await prisma.sprint.findFirst({
      where: { status: 'ACTIVE' },
      include: { project: true, stories: true }
    });
    if (activeSprint) {
      console.log('---ACTIVE_SPRINT_FOUND---');
      console.log(JSON.stringify(activeSprint, null, 2));
    } else {
      console.log('---NO_ACTIVE_SPRINT---');
      const anyProject = await prisma.project.findFirst({ include: { sprints: true } });
      console.log('---ANY_PROJECT---');
      console.log(JSON.stringify(anyProject, null, 2));
    }
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

check();
