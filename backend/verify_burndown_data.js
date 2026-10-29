const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verify() {
  const sprintId = 'cmnxdnk8a000513477y1ooqbt';
  try {
    const sprint = await prisma.sprint.findUnique({
      where: { id: sprintId },
      include: { stories: { include: { statusHistory: true } } }
    });

    const totalPoints = sprint.stories.reduce((sum, s) => sum + (s.storyPoints || 0), 0);
    console.log('Total Points in Sprint:', totalPoints);

    // Filter stories that are DONE today
    const doneStories = sprint.stories.filter(s => 
      s.statusHistory.some(h => h.status === 'DONE')
    );

    console.log('Done Stories Count:', doneStories.length);
    console.log('Done Stories points:', doneStories.reduce((sum, s) => sum + (s.storyPoints || 0), 0));

    // Simulated Burndown calculation for 'today'
    const today = new Date();
    let remaining = totalPoints;
    sprint.stories.forEach(story => {
        const doneH = story.statusHistory.find(h => h.status === 'DONE' && h.changedAt <= today);
        if (doneH) remaining -= (story.storyPoints || 0);
    });

    console.log('Remaining Points Today:', remaining);
    if (remaining === 0) {
        console.log('---VERIFICATION_SUCCESS---');
    } else {
        console.log('---VERIFICATION_FAILURE---');
    }

  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

verify();
