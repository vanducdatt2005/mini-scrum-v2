const http = require('http');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const jwt = require('jsonwebtoken');

async function testAnalyticsRBAC() {
  console.log("🧪 Testing Analytics RBAC (Role-Based Access Control)...");

  // Tìm một project và một member có role MEMBER
  const project = await prisma.project.findFirst({
    where: { name: 'Văn Đức Đạt' }
  });
  
  // Tìm hoặc tạo một member có role MEMBER
  let memberUser = await prisma.user.findFirst({ where: { email: 'tungdatrang@gmail.com' } });
  
  const token = jwt.sign(
    { userId: memberUser.id, email: memberUser.email },
    "mini_scrum_secret"
  );

  const paths = [
    `/api/analytics/${project.id}/sprint/some-id/burndown`,
    `/api/analytics/${project.id}/velocity`,
    `/api/analytics/${project.id}/sprint/some-id/report?format=pdf`
  ];

  for (const path of paths) {
    console.log(`\nTesting Access for path: ${path}`);
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    };

    await new Promise((resolve) => {
      http.get(options, (res) => {
        console.log(`Response Status: ${res.statusCode}`);
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          if (res.statusCode === 403) {
            console.log("✅ Successfully blocked MEMBER from accessing analytics.");
          } else {
            console.log("❌ Failed: MEMBER was allowed access or received wrong error.");
          }
          resolve();
        });
      });
    });
  }

  await prisma.$disconnect();
}

testAnalyticsRBAC();
