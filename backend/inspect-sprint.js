const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const sprintId = 'cmnskydxp0006bcbfnjbtj7i1';
  
  const sprint = await prisma.sprint.findUnique({
    where: { id: sprintId },
    include: {
      stories: {
        include: {
          assignee: { select: { id: true, fullName: true, email: true } }
        }
      },
      project: {
        include: {
          members: {
            include: { user: true }
          }
        }
      }
    }
  });

  if (!sprint) {
    console.log('Sprint not found');
    return;
  }

  console.log(`\nSprint: ${sprint.name} [Status: ${sprint.status}]`);
  console.log('User Stories in this sprint:');
  sprint.stories.forEach(s => {
    console.log(`- ID: ${s.id}, Title: "${s.title}", Status: ${s.status}, SP: ${s.storyPoints}, AssigneeId: ${s.assigneeId}, Assignee: ${s.assignee ? s.assignee.fullName : 'None'}`);
  });

  console.log('\nProject Members:');
  sprint.project.members.forEach(m => {
    console.log(`- UserID: ${m.userId}, FullName: ${m.user.fullName}, Role: ${m.role}`);
  });

  const summary = await prisma.sprintSummary.findUnique({
    where: { sprintId },
    include: {
      contributions: {
        include: { user: true }
      }
    }
  });

  if (summary) {
    console.log('\nSprint Summary:');
    console.log(`- totalSP: ${summary.totalSP}, totalHours: ${summary.totalHours}, completionRate: ${summary.completionRate}`);
    console.log('Contributions saved:');
    summary.contributions.forEach(c => {
      console.log(`- User: ${c.user.fullName}, SP: ${c.storyPoints}, Hours: ${c.hoursWorked}, Stories: ${c.storiesCompleted}, Role: ${c.roleInSprint}, Pct: ${c.contributionPct}`);
    });
  } else {
    console.log('\nNo Sprint Summary found in DB');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
