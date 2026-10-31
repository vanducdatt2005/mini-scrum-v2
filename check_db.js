const fs = require('fs');
const env = fs.readFileSync('backend/.env', 'utf8');
env.split('\n').forEach(line => {
  const parts = line.split('=');
  const k = parts[0];
  const v = parts.slice(1).join('=');
  if (k && v) process.env[k.trim()] = v.trim().replace(/^["']|["']$/g, '');
});

const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const prisma = new PrismaClient();
async function check() {
  const tasks = await prisma.task.findMany({
    where: { title: '1233' },
    select: { id: true, title: true, description: true, status: true, storyId: true, createdAt: true }
  });
  console.log('TASKS_COUNT:', tasks.length);
  tasks.forEach(t => console.log('TASK:', t.id, t.title, JSON.stringify(t.description), t.status, t.createdAt));
  await prisma.$disconnect();
}
check();

