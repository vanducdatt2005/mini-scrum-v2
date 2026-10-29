const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Kiểm tra sprint "haha" trong project Văn Đức Đạt
  const sprints = await prisma.sprint.findMany({
    where: { projectId: 'cmn9tbq730002coszsq3000m6' },
    include: { stories: { include: { statusHistory: true } } }
  });

  console.log('\n🏃 SPRINTS:');
  sprints.forEach(s => {
    console.log(`\n  Sprint: ${s.name} [${s.status}]`);
    console.log(`    startDate: ${s.startDate}`);
    console.log(`    endDate:   ${s.endDate}`);
    console.log(`    stories:   ${s.stories.length}`);
    console.log(`    storyPoints: ${s.stories.reduce((sum,x) => sum + (x.storyPoints||0), 0)}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
