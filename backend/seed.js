const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  // Create a test project
  //const project = await prisma.project.create({
   // data: {
      //id: "cm7u0p1z10000uxm4g9x7h2kd", // Matching the hardcoded ID in frontend
      //name: "Demo Scrum Project",
      //description: "A project to test US-009, 015, 016, 017, 018",
      //goal: "Complete the mini scrum management system features."
    //}
  //});

  //console.log("Created Project:", project.id);

  // Create initial user stories in backlog
  const stories = [
    { title: "Design the logic for US-009", priority: "High", priorityOrder: 0 },
    { title: "Implement Sprint Creation Modal (US-016)", priority: "Medium", priorityOrder: 1 },
    { title: "Add Drag-and-Drop library to frontend", priority: "High", priorityOrder: 2 },
    { title: "Optimize backend database queries", priority: "Low", priorityOrder: 3 },
  ];

  for (const s of stories) {
    await prisma.userStory.create({
      data: {
        ...s,
        projectId: "cm7u0p1z10000uxm4g9x7h2kd",
        status: "BACKLOG"
      }
    });
  }

  console.log("Seeded 4 user stories into backlog.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
