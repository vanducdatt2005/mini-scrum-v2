const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { app, prisma, server } = require('../src/index');

test('SCRUM-73: Retrospective Session & Notes API tests', async (t) => {
  let project;
  let memberUser;
  let outsiderUser;
  let memberToken;
  let outsiderToken;
  let createdSessionId;

  try {
    const uniqueSuffix = Date.now();

    // 1. Tạo project test
    project = await prisma.project.create({
      data: {
        name: `Retro Test Project ${uniqueSuffix}`,
        description: 'Test project for retro',
      },
    });

    // 2. Tạo user thành viên project
    memberUser = await prisma.user.create({
      data: {
        email: `member_${uniqueSuffix}@example.com`,
        password: 'hashedpassword',
        fullName: 'Project Member',
        role: 'MEMBER',
      },
    });

    await prisma.projectMember.create({
      data: {
        userId: memberUser.id,
        projectId: project.id,
        role: 'DEV',
        status: 'ACCEPTED',
      },
    });

    // 3. Tạo user người ngoài project (không phải member)
    outsiderUser = await prisma.user.create({
      data: {
        email: `outsider_${uniqueSuffix}@example.com`,
        password: 'hashedpassword',
        fullName: 'Outsider User',
        role: 'MEMBER',
      },
    });

    memberToken = jwt.sign(
      { userId: memberUser.id, email: memberUser.email, role: 'MEMBER' },
      process.env.JWT_SECRET || 'mini_scrum_secret'
    );

    outsiderToken = jwt.sign(
      { userId: outsiderUser.id, email: outsiderUser.email, role: 'MEMBER' },
      process.env.JWT_SECRET || 'mini_scrum_secret'
    );

    const address = server.address();
    const port = address ? address.port : (process.env.PORT || 5000);
    const apiBase = `http://127.0.0.1:${port}/api`;

    // TEST 1: Người ngoài Project tạo buổi -> 403
    await t.test('1. Người ngoài Project gọi tạo buổi -> 403 Forbidden', async () => {
      const res = await fetch(`${apiBase}/projects/${project.id}/retros`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${outsiderToken}`,
        },
        body: JSON.stringify({
          title: 'Unauthorized Retro',
        }),
      });

      assert.equal(res.status, 403);
      const data = await res.json();
      assert.ok(data.error);
    });

    // TEST 2: Thành viên tạo buổi -> 201 Created
    await t.test('2. Thành viên Project tạo buổi Retrospective -> 201 Created', async () => {
      const res = await fetch(`${apiBase}/projects/${project.id}/retros`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${memberToken}`,
        },
        body: JSON.stringify({
          title: 'Sprint 1 Retrospective',
        }),
      });

      assert.equal(res.status, 201);
      const data = await res.json();
      assert.ok(data.id);
      assert.equal(data.title, 'Sprint 1 Retrospective');
      assert.equal(data.status, 'OPEN');
      assert.equal(data.projectId, project.id);
      assert.equal(data.createdById, memberUser.id);
      createdSessionId = data.id;
    });

    // TEST 3: Lấy danh sách buổi của Project (GET /projects/:id/retros)
    await t.test('3. Lấy danh sách buổi trong Project -> 200 OK (mới nhất trước)', async () => {
      const res = await fetch(`${apiBase}/projects/${project.id}/retros`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${memberToken}`,
        },
      });

      assert.equal(res.status, 200);
      const list = await res.json();
      assert.ok(Array.isArray(list));
      assert.ok(list.length >= 1);
      assert.equal(list[0].id, createdSessionId);
    });

    // TEST 4: Người ngoài Project lấy chi tiết buổi -> 403
    await t.test('4. Người ngoài Project xem buổi -> 403 Forbidden', async () => {
      const res = await fetch(`${apiBase}/retros/${createdSessionId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${outsiderToken}`,
        },
      });

      assert.equal(res.status, 403);
    });

    // TEST 5: Thêm sticky note đúng cột (WENT_WELL, TO_IMPROVE, ACTION_ITEM) -> 201
    await t.test('5. Thêm sticky note đúng cột -> 201 Created', async () => {
      const columns = ['WENT_WELL', 'TO_IMPROVE', 'ACTION_ITEM'];
      for (const col of columns) {
        const res = await fetch(`${apiBase}/retros/${createdSessionId}/notes`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${memberToken}`,
          },
          body: JSON.stringify({
            column: col,
            content: `Ghi chú cho cột ${col}`,
          }),
        });

        assert.equal(res.status, 201);
        const note = await res.json();
        assert.ok(note.id);
        assert.equal(note.column, col);
        assert.equal(note.content, `Ghi chú cho cột ${col}`);
        assert.equal(note.sessionId, createdSessionId);
      }
    });

    // TEST 6: GET /retros/:id trả buổi + notes nhóm theo cột
    await t.test('6. GET /retros/:id trả buổi + notes nhóm theo 3 cột', async () => {
      const res = await fetch(`${apiBase}/retros/${createdSessionId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${memberToken}`,
        },
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.id, createdSessionId);
      assert.ok(data.columns);
      assert.equal(data.columns.WENT_WELL.length, 1);
      assert.equal(data.columns.TO_IMPROVE.length, 1);
      assert.equal(data.columns.ACTION_ITEM.length, 1);
      assert.equal(data.columns.WENT_WELL[0].content, 'Ghi chú cho cột WENT_WELL');
    });

    // TEST 7: Thêm note với content rỗng -> 400
    await t.test('7. Thêm sticky note với content rỗng -> 400 Bad Request', async () => {
      const res = await fetch(`${apiBase}/retros/${createdSessionId}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${memberToken}`,
        },
        body: JSON.stringify({
          column: 'WENT_WELL',
          content: '   ',
        }),
      });

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.ok(data.error);
    });

    // TEST 8: Người ngoài Project thêm note -> 403
    await t.test('8. Người ngoài Project thêm sticky note -> 403 Forbidden', async () => {
      const res = await fetch(`${apiBase}/retros/${createdSessionId}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${outsiderToken}`,
        },
        body: JSON.stringify({
          column: 'WENT_WELL',
          content: 'Hacking from outside',
        }),
      });

      assert.equal(res.status, 403);
    });

    // TEST 9: Buổi CLOSED -> 400 khi thêm note
    await t.test('9. Buổi CLOSED -> 400 Bad Request khi cố thêm note', async () => {
      // Đóng buổi
      await prisma.retroSession.update({
        where: { id: createdSessionId },
        data: { status: 'CLOSED' },
      });

      const res = await fetch(`${apiBase}/retros/${createdSessionId}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${memberToken}`,
        },
        body: JSON.stringify({
          column: 'WENT_WELL',
          content: 'Note sau khi đóng',
        }),
      });

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.ok(data.error);
    });

  } catch (err) {
    console.error('RETRO TEST ERROR:', err);
    throw err;
  } finally {
    // Cleanup test data
    if (createdSessionId) {
      await prisma.retroNote.deleteMany({ where: { sessionId: createdSessionId } }).catch(() => {});
      await prisma.retroSession.deleteMany({ where: { id: createdSessionId } }).catch(() => {});
    }
    if (project?.id) {
      await prisma.projectMember.deleteMany({ where: { projectId: project.id } }).catch(() => {});
      await prisma.project.delete({ where: { id: project.id } }).catch(() => {});
    }
    if (memberUser?.id) {
      await prisma.user.delete({ where: { id: memberUser.id } }).catch(() => {});
    }
    if (outsiderUser?.id) {
      await prisma.user.delete({ where: { id: outsiderUser.id } }).catch(() => {});
    }
    await prisma.$disconnect();
    if (server && server.close) {
      await new Promise((resolve) => server.close(resolve));
    }
    process.exit(0);
  }
});

