const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { app, prisma, server } = require('../src/index');

test('Optimistic Locking for Task tests', async (t) => {
  let task;
  try {
  // Chuẩn bị dữ liệu test
  let user = await prisma.user.findFirst();
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: `test_user_${Date.now()}@example.com`,
        password: 'hashedpassword',
        fullName: 'Test User'
      }
    });
  }

  let story = await prisma.userStory.findFirst();
  if (!story) {
    let project = await prisma.project.findFirst();
    if (!project) {
      project = await prisma.project.create({
        data: { name: 'Test Project' }
      });
    }
    story = await prisma.userStory.create({
      data: {
        title: 'Test Story',
        projectId: project.id
      }
    });
  }

  // Tạo 1 task thử nghiệm với version ban đầu
  task = await prisma.task.create({
    data: {
      title: 'Initial Task Title',
      description: 'Initial Description',
      status: 'TODO',
      storyId: story.id,
      version: 1
    }
  });

  const token = jwt.sign(
    { userId: user.id, email: user.email, role: 'ADMIN' },
    process.env.JWT_SECRET || 'mini_scrum_secret'
  );

  const address = server.address();
  const port = address ? address.port : (process.env.PORT || 5000);
  const baseUrl = `http://127.0.0.1:${port}/api/tasks/${task.id}`;

  await t.test('1. Thiếu version -> Trả về 400 Bad Request', async () => {
    const res = await fetch(baseUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        title: 'Title without version'
      })
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /version/i);
  });

  await t.test('2. V_request == V_db -> Thành công (200) và version tăng đúng 1', async () => {
    const currentDbTask = await prisma.task.findUnique({ where: { id: task.id } });
    const currentVersion = currentDbTask.version;

    const res = await fetch(baseUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        title: 'Updated Title Valid Version',
        version: currentVersion
      })
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.title, 'Updated Title Valid Version');
    assert.equal(body.version, currentVersion + 1);
    assert.ok(body.updated_at);
  });

  await t.test('3. Hai request cùng V_current cho 1 task -> Request 1 thành công (200), Request 2 nhận 409 VERSION_MISMATCH', async () => {
    // Lấy version hiện tại
    const currentDbTask = await prisma.task.findUnique({ where: { id: task.id } });
    const vCurrent = currentDbTask.version;

    // Gửi tuần tự / song song 2 request cùng mang vCurrent
    const req1 = fetch(baseUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        title: 'User A Change',
        version: vCurrent
      })
    });

    const req2 = fetch(baseUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        title: 'User B Change',
        version: vCurrent
      })
    });

    const [res1, res2] = await Promise.all([req1, req2]);
    const responses = [
      { res: res1, body: await res1.json() },
      { res: res2, body: await res2.json() }
    ];

    const successRes = responses.find(r => r.res.status === 200);
    const conflictRes = responses.find(r => r.res.status === 409);

    assert.ok(successRes, 'Phải có 1 request thành công 200');
    assert.ok(conflictRes, 'Phải có 1 request xung đột 409');

    // Kiểm tra request thành công: version = vCurrent + 1
    assert.equal(successRes.body.version, vCurrent + 1);

    // Kiểm tra request 409: có code VERSION_MISMATCH và latestTask
    assert.equal(conflictRes.body.code, 'VERSION_MISMATCH');
    assert.ok(conflictRes.body.latestTask);
    assert.equal(conflictRes.body.latestTask.version, vCurrent + 1);
    assert.ok(conflictRes.body.updatedBy);
    assert.ok(conflictRes.body.message);
  });

  } catch (err) {
    console.error('TEST ERROR DETAILS:', err);
    throw err;
  } finally {
    if (task?.id) {
      await prisma.task.delete({ where: { id: task.id } }).catch(() => {});
    }
    await prisma.$disconnect();
    await new Promise(resolve => server.close(resolve));
    process.exit(0);
  }
});
