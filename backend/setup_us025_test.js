const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function setup() {
  try {
    // 1. Create or Find User
    const user = await prisma.user.upsert({
      where: { email: 'test_us025@example.com' },
      update: {},
      create: {
        email: 'test_us025@example.com',
        password: 'password123',
        fullName: 'Test US025',
      }
    });

    // 2. Create Project
    const project = await prisma.project.create({
      data: {
        name: 'US-025 Burndown Test Project',
        description: 'Auto-generated for testing burndown chart',
        members: {
          create: { userId: user.id, role: 'OWNER' }
        }
      }
    });

    // 3. Create Sprint
    const now = new Date();
    const startDate = new Date(now);
    const endDate = new Date(now);
    endDate.setDate(now.getDate() + 7);

    const sprint = await prisma.sprint.create({
      data: {
        name: 'Sprint 1',
        status: 'ACTIVE',
        startDate: startDate,
        endDate: endDate,
        projectId: project.id,
      }
    });

    // 4. Create User Story
    const story = await prisma.userStory.create({
      data: {
        title: 'User Story for Burndown',
        storyPoints: 10,
        status: 'TODO',
        projectId: project.id,
        sprintId: sprint.id,
      }
    });

    console.log('---SETUP_SUCCESS---');
    console.log(JSON.stringify({ projectId: project.id, sprintId: sprint.id, storyId: story.id, userId: user.id }, null, 2));

  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

setup();
