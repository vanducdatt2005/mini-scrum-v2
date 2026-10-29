const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function complete() {
  const storyId = 'cmnxdnk9900071347afvgljhy';
  try {
    // 1. Update Story
    await prisma.userStory.update({
      where: { id: storyId },
      data: { status: 'DONE' }
    });

    // 2. Create History
    await prisma.userStoryStatusHistory.create({
      data: {
        storyId: storyId,
        status: 'DONE',
        changedAt: new Date()
      }
    });

    console.log('---STORY_COMPLETED_SUCCESSFULLY---');
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

complete();
