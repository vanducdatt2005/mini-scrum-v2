const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const jwt = require('jsonwebtoken');
const { app, prisma, server } = require('../src/index');
const { serializeRetroNote } = require('../src/routes/retroRoutes');
const { io: ClientIO } = require(path.resolve(__dirname, '../../frontend/node_modules/socket.io-client'));

test('SCRUM-74: Sticky note ẩn danh & Đồng bộ realtime cho buổi Retro', async (t) => {
  let project;
  let userA, userB, userSM, userZ;
  let tokenA, tokenB, tokenSM, tokenZ;
  let retroSession;
  let socketA, socketB;

  const address = server.address();
  const port = address ? address.port : (process.env.PORT || 5000);
  const apiBase = `http://127.0.0.1:${port}/api`;
  const serverUrl = `http://127.0.0.1:${port}`;
  const jwtSecret = process.env.JWT_SECRET || 'mini_scrum_secret';
  const timestamp = Date.now();

  try {
    // 1. Tạo project test
    project = await prisma.project.create({
      data: {
        name: `Retro SCRUM-74 Project ${timestamp}`,
        description: 'Testing anonymous notes and realtime sync',
      },
    });

    // 2. Tạo User A (Tác giả, Member)
    userA = await prisma.user.create({
      data: {
        email: `usera_${timestamp}@example.com`,
        password: 'hashedpassword',
        fullName: 'User A (Author)',
        role: 'MEMBER',
      },
    });
    await prisma.projectMember.create({
      data: { userId: userA.id, projectId: project.id, role: 'DEV', status: 'ACCEPTED' },
    });

    // 3. Tạo User B (Đồng nghiệp, Member)
    userB = await prisma.user.create({
      data: {
        email: `userb_${timestamp}@example.com`,
        password: 'hashedpassword',
        fullName: 'User B (Peer)',
        role: 'MEMBER',
      },
    });
    await prisma.projectMember.create({
      data: { userId: userB.id, projectId: project.id, role: 'DEV', status: 'ACCEPTED' },
    });

    // 4. Tạo User SM (Scrum Master trong Project)
    userSM = await prisma.user.create({
      data: {
        email: `usersm_${timestamp}@example.com`,
        password: 'hashedpassword',
        fullName: 'Scrum Master S',
        role: 'MEMBER',
      },
    });
    await prisma.projectMember.create({
      data: { userId: userSM.id, projectId: project.id, role: 'SM', status: 'ACCEPTED' },
    });

    // 5. Tạo User Z (Người ngoài Project)
    userZ = await prisma.user.create({
      data: {
        email: `userz_${timestamp}@example.com`,
        password: 'hashedpassword',
        fullName: 'User Z (Outsider)',
        role: 'MEMBER',
      },
    });

    // Tokens
    tokenA = jwt.sign({ userId: userA.id, email: userA.email, role: 'MEMBER' }, jwtSecret);
    tokenB = jwt.sign({ userId: userB.id, email: userB.email, role: 'MEMBER' }, jwtSecret);
    tokenSM = jwt.sign({ userId: userSM.id, email: userSM.email, role: 'MEMBER' }, jwtSecret);
    tokenZ = jwt.sign({ userId: userZ.id, email: userZ.email, role: 'MEMBER' }, jwtSecret);

    // Tạo buổi Retrospective
    retroSession = await prisma.retroSession.create({
      data: {
        projectId: project.id,
        title: `Sprint 1 Retrospective ${timestamp}`,
        status: 'OPEN',
        createdById: userA.id,
      },
    });

    // Kết nối WebSockets cho User A và User B
    const connectSocket = (token, pId) => {
      return new Promise((resolve, reject) => {
        const s = ClientIO(serverUrl, {
          auth: { token },
          transports: ['websocket'],
          reconnection: false,
        });
        s.on('connect', () => {
          s.emit('joinProject', pId, () => {
            resolve(s);
          });
        });
        s.on('connect_error', reject);
        setTimeout(() => resolve(s), 1000);
      });
    };

    socketA = await connectSocket(tokenA, project.id);
    socketB = await connectSocket(tokenB, project.id);

    // ==========================================
    // TEST 1: Unit test hàm serializeRetroNote
    // ==========================================
    await t.test('1. serializeRetroNote: Ẩn danh vs Thường, API vs Socket', () => {
      const mockRawNote = {
        id: 'note-1',
        sessionId: retroSession.id,
        column: 'TO_IMPROVE',
        content: 'Họp daily quá dài',
        authorId: userA.id,
        isAnonymous: true,
        createdAt: new Date(),
        author: { id: userA.id, fullName: 'User A (Author)', email: 'usera@test.com' },
      };

      // API call của chính tác giả User A:
      const apiAuthorResult = serializeRetroNote(mockRawNote, userA.id);
      assert.equal(apiAuthorResult.isAnonymous, true);
      assert.equal(apiAuthorResult.isMine, true);
      assert.equal(apiAuthorResult.author, undefined, 'Note ẩn danh KHÔNG được có author');
      assert.equal(apiAuthorResult.authorId, undefined, 'Note ẩn danh KHÔNG được có authorId');

      // API call của người khác (User B hoặc Scrum Master):
      const apiOtherResult = serializeRetroNote(mockRawNote, userB.id);
      assert.equal(apiOtherResult.isAnonymous, true);
      assert.equal(apiOtherResult.isMine, false);
      assert.equal(apiOtherResult.author, undefined);
      assert.equal(apiOtherResult.authorId, undefined);

      // Event socket broadcast (không truyền currentUserId):
      const socketResult = serializeRetroNote(mockRawNote);
      assert.equal(socketResult.isAnonymous, true);
      assert.equal(socketResult.isMine, undefined, 'Socket broadcast không chứa isMine');
      assert.equal(socketResult.author, undefined, 'Socket broadcast ẩn danh không chứa author');
      assert.equal(socketResult.authorId, undefined, 'Socket broadcast không chứa authorId');

      // Note thường (isAnonymous = false):
      const regularRawNote = { ...mockRawNote, isAnonymous: false };
      const apiRegular = serializeRetroNote(regularRawNote, userA.id);
      assert.equal(apiRegular.isAnonymous, false);
      assert.equal(apiRegular.isMine, true);
      assert.ok(apiRegular.author);
      assert.equal(apiRegular.author.id, userA.id);
      assert.equal(apiRegular.author.name, 'User A (Author)');
    });

    let anonNoteId = null;
    let normalNoteId = null;

    // ==========================================
    // TEST 2: POST /retros/:id/notes với isAnonymous = true
    // ==========================================
    await t.test('2. POST /retros/:id/notes (Ẩn danh): User A tạo note ẩn danh -> Không lộ tác giả', async () => {
      // Chuẩn bị listener socket của User B để kiểm tra TC-US074-06
      const socketEventPromise = new Promise((resolve) => {
        socketB.once('RETRO_NOTE_CREATED', (payload) => {
          resolve(payload);
        });
      });

      const res = await fetch(`${apiBase}/retros/${retroSession.id}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          column: 'TO_IMPROVE',
          content: 'Họp daily quá dài',
          isAnonymous: true,
        }),
      });

      assert.equal(res.status, 201);
      const data = await res.json();
      anonNoteId = data.id;

      // Kiểm tra API response trả về cho tác giả A
      assert.ok(data.id);
      assert.equal(data.content, 'Họp daily quá dài');
      assert.equal(data.column, 'TO_IMPROVE');
      assert.equal(data.isAnonymous, true);
      assert.equal(data.isMine, true);
      assert.equal(data.author, undefined, 'API response không có author');
      assert.equal(data.authorId, undefined, 'API response không có authorId');

      // Kiểm tra socket payload mà User B nhận được (TC-US074-06)
      const socketPayload = await socketEventPromise;
      assert.equal(socketPayload.id, data.id);
      assert.equal(socketPayload.content, 'Họp daily quá dài');
      assert.equal(socketPayload.isAnonymous, true);
      assert.equal(socketPayload.author, undefined, 'Socket payload không có author');
      assert.equal(socketPayload.authorId, undefined, 'Socket payload không có authorId');
      assert.equal(socketPayload.isMine, undefined, 'Socket payload không có isMine');
    });

    // ==========================================
    // TEST 3: POST /retros/:id/notes với isAnonymous = false
    // ==========================================
    await t.test('3. POST /retros/:id/notes (Thường): User A tạo note thường -> Có tác giả', async () => {
      const res = await fetch(`${apiBase}/retros/${retroSession.id}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          column: 'WENT_WELL',
          content: 'Teamwork tốt',
          isAnonymous: false,
        }),
      });

      assert.equal(res.status, 201);
      const data = await res.json();
      normalNoteId = data.id;

      assert.equal(data.content, 'Teamwork tốt');
      assert.equal(data.isAnonymous, false);
      assert.equal(data.isMine, true);
      assert.ok(data.author);
      assert.equal(data.author.id, userA.id);
      assert.equal(data.author.name, 'User A (Author)');
    });

    // ==========================================
    // TEST 4: GET /retros/:id bởi User B và Scrum Master
    // TC-US074-04 & TC-US074-05
    // ==========================================
    await t.test('4. GET /retros/:id bởi User B và Scrum Master: Note ẩn danh không lộ thông tin', async () => {
      // 4a. User B gọi
      const resB = await fetch(`${apiBase}/retros/${retroSession.id}`, {
        headers: { 'Authorization': `Bearer ${tokenB}` },
      });
      assert.equal(resB.status, 200);
      const dataB = await resB.json();

      const anonNoteForB = dataB.columns.TO_IMPROVE.find((n) => n.id === anonNoteId);
      assert.ok(anonNoteForB);
      assert.equal(anonNoteForB.isAnonymous, true);
      assert.equal(anonNoteForB.isMine, false);
      assert.equal(anonNoteForB.author, undefined, 'User B không thấy author');
      assert.equal(anonNoteForB.authorId, undefined, 'User B không thấy authorId');

      const normalNoteForB = dataB.columns.WENT_WELL.find((n) => n.id === normalNoteId);
      assert.ok(normalNoteForB);
      assert.equal(normalNoteForB.isAnonymous, false);
      assert.equal(normalNoteForB.isMine, false);
      assert.equal(normalNoteForB.author.name, 'User A (Author)');

      // 4b. Scrum Master gọi (TC-US074-05)
      const resSM = await fetch(`${apiBase}/retros/${retroSession.id}`, {
        headers: { 'Authorization': `Bearer ${tokenSM}` },
      });
      assert.equal(resSM.status, 200);
      const dataSM = await resSM.json();

      const anonNoteForSM = dataSM.columns.TO_IMPROVE.find((n) => n.id === anonNoteId);
      assert.ok(anonNoteForSM);
      assert.equal(anonNoteForSM.isAnonymous, true);
      assert.equal(anonNoteForSM.isMine, false);
      assert.equal(anonNoteForSM.author, undefined, 'Scrum Master KHÔNG thấy author');
      assert.equal(anonNoteForSM.authorId, undefined, 'Scrum Master KHÔNG thấy authorId');

      // 4c. Tác giả User A gọi lại (F5 - TC-US074-11)
      const resA = await fetch(`${apiBase}/retros/${retroSession.id}`, {
        headers: { 'Authorization': `Bearer ${tokenA}` },
      });
      assert.equal(resA.status, 200);
      const dataA = await resA.json();
      const anonNoteForA = dataA.columns.TO_IMPROVE.find((n) => n.id === anonNoteId);
      assert.ok(anonNoteForA);
      assert.equal(anonNoteForA.isMine, true, 'Tác giả vẫn nhận isMine: true khi reload trang');
      assert.equal(anonNoteForA.author, undefined);
    });

    // ==========================================
    // TEST 5: Người khác (User B, Scrum Master) sửa note -> 403 Forbidden
    // TC-US074-12 & TC-US074-13
    // ==========================================
    await t.test('5. PATCH /retros/:id/notes/:noteId: Người khác / Scrum Master sửa -> 403 Forbidden', async () => {
      // User B sửa note của A -> 403
      const resB = await fetch(`${apiBase}/retros/${retroSession.id}/notes/${anonNoteId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenB}`,
        },
        body: JSON.stringify({ content: 'User B cố tình sửa' }),
      });
      assert.equal(resB.status, 403);

      // Scrum Master sửa note của A -> 403
      const resSM = await fetch(`${apiBase}/retros/${retroSession.id}/notes/${anonNoteId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenSM}`,
        },
        body: JSON.stringify({ content: 'Scrum Master cố tình sửa' }),
      });
      assert.equal(resSM.status, 403);
    });

    // ==========================================
    // TEST 6: Tác giả sửa note ẩn danh & Realtime update
    // TC-US074-07 & TC-US074-09 & TC-US074-15
    // ==========================================
    await t.test('6. Tác giả User A sửa note ẩn danh -> 200 OK & Realtime RETRO_NOTE_UPDATED không lộ tác giả', async () => {
      const socketUpdatePromise = new Promise((resolve) => {
        socketB.once('RETRO_NOTE_UPDATED', (payload) => {
          resolve(payload);
        });
      });

      const res = await fetch(`${apiBase}/retros/${retroSession.id}/notes/${anonNoteId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          content: 'Họp daily nên ngắn hơn',
        }),
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.content, 'Họp daily nên ngắn hơn');
      assert.equal(data.isAnonymous, true, 'Note vẫn ẩn danh sau khi sửa');
      assert.equal(data.isMine, true);
      assert.equal(data.author, undefined);
      assert.equal(data.authorId, undefined);

      // Socket payload nhận được bởi User B (TC-US074-07)
      const socketPayload = await socketUpdatePromise;
      assert.equal(socketPayload.id, anonNoteId);
      assert.equal(socketPayload.content, 'Họp daily nên ngắn hơn');
      assert.equal(socketPayload.isAnonymous, true);
      assert.equal(socketPayload.author, undefined, 'Socket update không lộ author');
      assert.equal(socketPayload.authorId, undefined, 'Socket update không lộ authorId');
    });

    // ==========================================
    // TEST 7: Người khác (User B, Scrum Master) xóa note -> 403 Forbidden
    // ==========================================
    await t.test('7. DELETE /retros/:id/notes/:noteId: Người khác / Scrum Master xóa -> 403 Forbidden', async () => {
      const resB = await fetch(`${apiBase}/retros/${retroSession.id}/notes/${anonNoteId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${tokenB}` },
      });
      assert.equal(resB.status, 403);

      const resSM = await fetch(`${apiBase}/retros/${retroSession.id}/notes/${anonNoteId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${tokenSM}` },
      });
      assert.equal(resSM.status, 403);
    });

    // ==========================================
    // TEST 8: Tác giả xóa note ẩn danh & Realtime delete
    // TC-US074-10 & TC-US074-16
    // ==========================================
    await t.test('8. Tác giả User A xóa note ẩn danh -> 200 OK & Realtime RETRO_NOTE_DELETED', async () => {
      const socketDeletePromise = new Promise((resolve) => {
        socketB.once('RETRO_NOTE_DELETED', (payload) => {
          resolve(payload);
        });
      });

      const res = await fetch(`${apiBase}/retros/${retroSession.id}/notes/${anonNoteId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${tokenA}` },
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.id, anonNoteId);

      const socketPayload = await socketDeletePromise;
      assert.equal(socketPayload.id, anonNoteId);

      // Xác nhận trong DB đã bị xóa
      const checkDb = await prisma.retroNote.findUnique({ where: { id: anonNoteId } });
      assert.equal(checkDb, null);
    });

    // ==========================================
    // TEST 9: Người ngoài project (User Z) gọi API -> 403 Forbidden
    // TC-US074-23
    // ==========================================
    await t.test('9. Người ngoài Project gọi API -> 403 Forbidden', async () => {
      const resGet = await fetch(`${apiBase}/retros/${retroSession.id}`, {
        headers: { 'Authorization': `Bearer ${tokenZ}` },
      });
      assert.equal(resGet.status, 403);

      const resPost = await fetch(`${apiBase}/retros/${retroSession.id}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenZ}`,
        },
        body: JSON.stringify({
          column: 'WENT_WELL',
          content: 'Hacker note',
        }),
      });
      assert.equal(resPost.status, 403);
    });

  } finally {
    // Dọn dẹp sockets
    if (socketA && socketA.connected) socketA.disconnect();
    if (socketB && socketB.connected) socketB.disconnect();

    // Dọn dẹp DB test
    if (project) {
      await prisma.retroNote.deleteMany({ where: { session: { projectId: project.id } } }).catch(() => {});
      await prisma.retroSession.deleteMany({ where: { projectId: project.id } }).catch(() => {});
      await prisma.projectMember.deleteMany({ where: { projectId: project.id } }).catch(() => {});
      await prisma.project.delete({ where: { id: project.id } }).catch(() => {});
    }
    if (userA) await prisma.user.delete({ where: { id: userA.id } }).catch(() => {});
    if (userB) await prisma.user.delete({ where: { id: userB.id } }).catch(() => {});
    if (userSM) await prisma.user.delete({ where: { id: userSM.id } }).catch(() => {});
    if (userZ) await prisma.user.delete({ where: { id: userZ.id } }).catch(() => {});

    await prisma.$disconnect();
    if (server && server.close) {
      await new Promise((resolve) => server.close(resolve));
    }
    process.exit(0);
  }
});
