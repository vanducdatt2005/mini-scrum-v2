const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { app, prisma, server } = require('../src/index');

test('Hạn chế quyền đóng buổi Retro: PO/SM mới được đóng, thành viên -> 403', async (t) => {
  let project;
  let devUser, smUser, poUser;
  let devToken, smToken, poToken;
  let retroSession;
  let note;

  const address = server.address();
  const port = address ? address.port : (process.env.PORT || 5000);
  const apiBase = `http://127.0.0.1:${port}/api`;
  const jwtSecret = process.env.JWT_SECRET || 'mini_scrum_secret';
  const timestamp = Date.now();

  try {
    // 1. Tạo project test
    project = await prisma.project.create({
      data: {
        name: `Retro Close Permission Project ${timestamp}`,
        description: 'Testing retro close permission',
      },
    });

    // 2. Tạo DEV User
    devUser = await prisma.user.create({
      data: {
        email: `dev_close_${timestamp}@example.com`,
        password: 'hashedpassword',
        fullName: 'Dev User',
        role: 'MEMBER',
      },
    });
    await prisma.projectMember.create({
      data: { userId: devUser.id, projectId: project.id, role: 'DEV', status: 'ACCEPTED' },
    });

    // 3. Tạo SM User
    smUser = await prisma.user.create({
      data: {
        email: `sm_close_${timestamp}@example.com`,
        password: 'hashedpassword',
        fullName: 'Scrum Master',
        role: 'MEMBER',
      },
    });
    await prisma.projectMember.create({
      data: { userId: smUser.id, projectId: project.id, role: 'SM', status: 'ACCEPTED' },
    });

    // 4. Tạo PO User
    poUser = await prisma.user.create({
      data: {
        email: `po_close_${timestamp}@example.com`,
        password: 'hashedpassword',
        fullName: 'Product Owner',
        role: 'MEMBER',
      },
    });
    await prisma.projectMember.create({
      data: { userId: poUser.id, projectId: project.id, role: 'PO', status: 'ACCEPTED' },
    });

    devToken = jwt.sign({ userId: devUser.id, email: devUser.email, role: 'MEMBER' }, jwtSecret);
    smToken = jwt.sign({ userId: smUser.id, email: smUser.email, role: 'MEMBER' }, jwtSecret);
    poToken = jwt.sign({ userId: poUser.id, email: poUser.email, role: 'MEMBER' }, jwtSecret);

    // 5. Tạo 1 buổi Retrospective (OPEN) và 1 note
    retroSession = await prisma.retroSession.create({
      data: {
        projectId: project.id,
        title: 'Sprint 1 Retrospective',
        status: 'OPEN',
      },
    });

    note = await prisma.retroNote.create({
      data: {
        sessionId: retroSession.id,
        authorId: devUser.id,
        column: 'WENT_WELL',
        content: 'Code review cẩn thận',
        isAnonymous: false,
      },
    });

    // Test 1: DEV cố gắng đóng buổi Retro -> 403
    await t.test('1. Member (DEV) đóng buổi Retro -> 403', async () => {
      const res = await fetch(`${apiBase}/retros/${retroSession.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${devToken}`,
        },
        body: JSON.stringify({ status: 'CLOSED' }),
      });

      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.error, 'Chỉ Product Owner hoặc Scrum Master mới được đóng buổi');

      // Kiểm tra trạng thái DB vẫn OPEN
      const check = await prisma.retroSession.findUnique({ where: { id: retroSession.id } });
      assert.strictEqual(check.status, 'OPEN');
    });

    // Test 2: Scrum Master đóng buổi Retro -> 200, status: CLOSED
    await t.test('2. SM đóng buổi Retro -> 200, status = CLOSED', async () => {
      const res = await fetch(`${apiBase}/retros/${retroSession.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${smToken}`,
        },
        body: JSON.stringify({ status: 'CLOSED' }),
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.status, 'CLOSED');

      const check = await prisma.retroSession.findUnique({ where: { id: retroSession.id } });
      assert.strictEqual(check.status, 'CLOSED');
    });

    // Test 3: Sau khi đóng, thêm note trả về 400
    await t.test('3. Sau khi đóng, thêm note -> 400', async () => {
      const res = await fetch(`${apiBase}/retros/${retroSession.id}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${devToken}`,
        },
        body: JSON.stringify({
          column: 'TO_IMPROVE',
          content: 'Thêm note khi buổi đã đóng',
        }),
      });

      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.match(data.error, /đã kết thúc/i);
    });

    // Test 4: Sau khi đóng, vote note trả về 400
    await t.test('4. Sau khi đóng, vote note -> 400', async () => {
      const res = await fetch(`${apiBase}/retros/${retroSession.id}/notes/${note.id}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${devToken}`,
        },
      });

      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.match(data.error, /đã kết thúc/i);
    });

    // Test 5: PO mở lại buổi và đóng buổi thành công
    await t.test('5. PO mở lại buổi (OPEN) và đóng lại (CLOSED) -> 200', async () => {
      // Reopen by PO
      const reopenRes = await fetch(`${apiBase}/retros/${retroSession.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${poToken}`,
        },
        body: JSON.stringify({ status: 'OPEN' }),
      });
      assert.strictEqual(reopenRes.status, 200);
      const reopenData = await reopenRes.json();
      assert.strictEqual(reopenData.status, 'OPEN');

      // Close by PO
      const closeRes = await fetch(`${apiBase}/retros/${retroSession.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${poToken}`,
        },
        body: JSON.stringify({ status: 'CLOSED' }),
      });
      assert.strictEqual(closeRes.status, 200);
      const closeData = await closeRes.json();
      assert.strictEqual(closeData.status, 'CLOSED');
    });

  } finally {
    // Dọn dẹp dữ liệu test
    try {
      if (retroSession) {
        await prisma.retroVote.deleteMany({ where: { note: { sessionId: retroSession.id } } }).catch(() => {});
        await prisma.retroNote.deleteMany({ where: { sessionId: retroSession.id } }).catch(() => {});
        await prisma.retroSession.delete({ where: { id: retroSession.id } }).catch(() => {});
      }
      if (project) {
        await prisma.projectMember.deleteMany({ where: { projectId: project.id } }).catch(() => {});
        await prisma.project.delete({ where: { id: project.id } }).catch(() => {});
      }
      if (devUser) await prisma.user.delete({ where: { id: devUser.id } }).catch(() => {});
      if (smUser) await prisma.user.delete({ where: { id: smUser.id } }).catch(() => {});
      if (poUser) await prisma.user.delete({ where: { id: poUser.id } }).catch(() => {});
    } catch (cleanupErr) {
      console.warn('Lỗi cleanup:', cleanupErr.message);
    }
    await prisma.$disconnect();
    if (server && server.close) {
      await new Promise((resolve) => server.close(resolve));
    }
    process.exit(0);
  }
});
