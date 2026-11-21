const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const jwt = require('jsonwebtoken');
const { app, prisma, server } = require('../src/index');
const { serializeRetroNote, MAX_VOTES } = require('../src/routes/retroRoutes');
const { io: ClientIO } = require(path.resolve(__dirname, '../../frontend/node_modules/socket.io-client'));

test('SCRUM-75: Vote sticky note trong buổi Retro', async (t) => {
  let project;
  let userA, userB, userZ;
  let tokenA, tokenB, tokenZ;
  let retroSession;
  let note1, note2, note3, note4;
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
        name: `Retro Vote SCRUM-75 Project ${timestamp}`,
        description: 'Testing retro note voting',
      },
    });

    // 2. Tạo User A (Member)
    userA = await prisma.user.create({
      data: {
        email: `usera_vote_${timestamp}@example.com`,
        password: 'hashedpassword',
        fullName: 'User A',
        role: 'MEMBER',
      },
    });
    await prisma.projectMember.create({
      data: { userId: userA.id, projectId: project.id, role: 'DEV', status: 'ACCEPTED' },
    });

    // 3. Tạo User B (Member)
    userB = await prisma.user.create({
      data: {
        email: `userb_vote_${timestamp}@example.com`,
        password: 'hashedpassword',
        fullName: 'User B',
        role: 'MEMBER',
      },
    });
    await prisma.projectMember.create({
      data: { userId: userB.id, projectId: project.id, role: 'DEV', status: 'ACCEPTED' },
    });

    // 4. Tạo User Z (Người ngoài project)
    userZ = await prisma.user.create({
      data: {
        email: `userz_vote_${timestamp}@example.com`,
        password: 'hashedpassword',
        fullName: 'User Z (Outsider)',
        role: 'MEMBER',
      },
    });

    // Tokens
    tokenA = jwt.sign({ userId: userA.id, email: userA.email, role: 'MEMBER' }, jwtSecret);
    tokenB = jwt.sign({ userId: userB.id, email: userB.email, role: 'MEMBER' }, jwtSecret);
    tokenZ = jwt.sign({ userId: userZ.id, email: userZ.email, role: 'MEMBER' }, jwtSecret);

    // 5. Tạo buổi Retro và 4 notes
    retroSession = await prisma.retroSession.create({
      data: {
        projectId: project.id,
        title: `Retro Vote Session ${timestamp}`,
        status: 'OPEN',
        createdById: userA.id,
      },
    });

    note1 = await prisma.retroNote.create({
      data: {
        sessionId: retroSession.id,
        column: 'WENT_WELL',
        content: 'CI/CD pipeline mượt mà',
        authorId: userA.id,
        isAnonymous: true,
      },
    });

    note2 = await prisma.retroNote.create({
      data: {
        sessionId: retroSession.id,
        column: 'TO_IMPROVE',
        content: 'Cần viết unit test nhiều hơn',
        authorId: userB.id,
        isAnonymous: false,
      },
    });

    note3 = await prisma.retroNote.create({
      data: {
        sessionId: retroSession.id,
        column: 'TO_IMPROVE',
        content: 'Refactor code legacy',
        authorId: userA.id,
        isAnonymous: false,
      },
    });

    note4 = await prisma.retroNote.create({
      data: {
        sessionId: retroSession.id,
        column: 'ACTION_ITEM',
        content: 'Tổ chức workshop testing',
        authorId: userB.id,
        isAnonymous: true,
      },
    });

    // 6. Kết nối WebSockets cho User A và User B
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
    // TEST 1: Vote thành công tăng voteCount & emit socket không chứa userId
    // ==========================================
    await t.test('1. Vote thành công tăng count và socket payload không chứa userId', async () => {
      const socketVotePromise = new Promise((resolve) => {
        socketB.once('RETRO_NOTE_VOTED', (payload) => {
          resolve(payload);
        });
      });

      const res = await fetch(`${apiBase}/retros/${retroSession.id}/notes/${note1.id}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenA}`,
        },
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.id, note1.id);
      assert.equal(data.voteCount, 1);
      assert.equal(data.myVoted, true);
      assert.equal(data.myVotesLeft, 2);

      // Kiểm tra socket payload B nhận được
      const socketPayload = await socketVotePromise;
      assert.equal(socketPayload.noteId, note1.id);
      assert.equal(socketPayload.voteCount, 1);
      assert.equal(socketPayload.userId, undefined, 'Socket payload không được chứa userId');
      assert.equal(socketPayload.myVoted, undefined, 'Socket payload không được chứa myVoted');
    });

    // ==========================================
    // TEST 2: Vote lại cùng note → 409
    // ==========================================
    await t.test('2. Vote lại cùng note → 409 Bạn đã vote note này rồi', async () => {
      const res = await fetch(`${apiBase}/retros/${retroSession.id}/notes/${note1.id}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenA}`,
        },
      });

      assert.equal(res.status, 409);
      const data = await res.json();
      assert.equal(data.error, 'Bạn đã vote note này rồi');
    });

    // ==========================================
    // TEST 3: Vote lần thứ 4 → 400 (Hết 3 phiếu)
    // ==========================================
    await t.test('3. Dùng hết 3 phiếu, vote lần thứ 4 → 400 Bạn đã dùng hết 3 phiếu', async () => {
      // Phiếu thứ 2 (note2)
      const res2 = await fetch(`${apiBase}/retros/${retroSession.id}/notes/${note2.id}/vote`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${tokenA}` },
      });
      assert.equal(res2.status, 200);
      const data2 = await res2.json();
      assert.equal(data2.voteCount, 1);
      assert.equal(data2.myVotesLeft, 1);

      // Phiếu thứ 3 (note3)
      const res3 = await fetch(`${apiBase}/retros/${retroSession.id}/notes/${note3.id}/vote`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${tokenA}` },
      });
      assert.equal(res3.status, 200);
      const data3 = await res3.json();
      assert.equal(data3.voteCount, 1);
      assert.equal(data3.myVotesLeft, 0);

      // Cố vote lần thứ 4 (note4)
      const res4 = await fetch(`${apiBase}/retros/${retroSession.id}/notes/${note4.id}/vote`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${tokenA}` },
      });
      assert.equal(res4.status, 400);
      const data4 = await res4.json();
      assert.equal(data4.error, 'Bạn đã dùng hết 3 phiếu');
    });

    // ==========================================
    // TEST 4: Buổi CLOSED → 400
    // ==========================================
    await t.test('4. Buổi CLOSED → 400 Buổi Retrospective đã kết thúc, không thể vote', async () => {
      // Đóng buổi
      await prisma.retroSession.update({
        where: { id: retroSession.id },
        data: { status: 'CLOSED' },
      });

      const res = await fetch(`${apiBase}/retros/${retroSession.id}/notes/${note4.id}/vote`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${tokenB}` },
      });

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.match(data.error, /đã kết thúc/);

      // Mở lại buổi để test tiếp
      await prisma.retroSession.update({
        where: { id: retroSession.id },
        data: { status: 'OPEN' },
      });
    });

    // ==========================================
    // TEST 5: Người ngoài Project → 403
    // ==========================================
    await t.test('5. Người ngoài Project vote → 403 Forbidden', async () => {
      const res = await fetch(`${apiBase}/retros/${retroSession.id}/notes/${note4.id}/vote`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${tokenZ}` },
      });

      assert.equal(res.status, 403);
      const data = await res.json();
      assert.ok(data.error);
    });

    // ==========================================
    // TEST 6: 2 client thấy voteCount đồng bộ qua socket
    // ==========================================
    await t.test('6. 2 client thấy voteCount đồng bộ qua event RETRO_NOTE_VOTED', async () => {
      const socketVotePromiseA = new Promise((resolve) => {
        socketA.once('RETRO_NOTE_VOTED', (payload) => {
          resolve(payload);
        });
      });

      // User B vote cho note 1 (note1 trước đó đã có 1 vote từ A)
      const resB = await fetch(`${apiBase}/retros/${retroSession.id}/notes/${note1.id}/vote`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${tokenB}` },
      });
      assert.equal(resB.status, 200);
      const dataB = await resB.json();
      assert.equal(dataB.voteCount, 2);

      // Socket A nhận được event cập nhật voteCount = 2
      const socketPayload = await socketVotePromiseA;
      assert.equal(socketPayload.noteId, note1.id);
      assert.equal(socketPayload.voteCount, 2);
      assert.equal(socketPayload.userId, undefined);
    });

    // ==========================================
    // TEST 7: GET /retros/:id trả đúng voteCount, myVoted và myVotesLeft (không lộ người vote)
    // ==========================================
    await t.test('7. GET /retros/:id trả voteCount, myVoted, myVotesLeft (không danh sách người vote)', async () => {
      // User A gọi GET
      const resA = await fetch(`${apiBase}/retros/${retroSession.id}`, {
        headers: { 'Authorization': `Bearer ${tokenA}` },
      });
      assert.equal(resA.status, 200);
      const sessionA = await resA.json();

      assert.equal(sessionA.myVotesLeft, 0, 'User A đã dùng 3 phiếu nên myVotesLeft = 0');
      assert.equal(sessionA.maxVotes, 3);
      const note1ForA = sessionA.notes.find((n) => n.id === note1.id);
      assert.equal(note1ForA.voteCount, 2);
      assert.equal(note1ForA.myVoted, true);
      assert.equal(note1ForA.votes, undefined, 'Không được trả mảng votes');

      // User B gọi GET
      const resB = await fetch(`${apiBase}/retros/${retroSession.id}`, {
        headers: { 'Authorization': `Bearer ${tokenB}` },
      });
      assert.equal(resB.status, 200);
      const sessionB = await resB.json();

      assert.equal(sessionB.myVotesLeft, 2, 'User B mới dùng 1 phiếu nên myVotesLeft = 2');
      const note1ForB = sessionB.notes.find((n) => n.id === note1.id);
      assert.equal(note1ForB.voteCount, 2);
      assert.equal(note1ForB.myVoted, true);

      const note2ForB = sessionB.notes.find((n) => n.id === note2.id);
      assert.equal(note2ForB.voteCount, 1);
      assert.equal(note2ForB.myVoted, false, 'User B chưa vote note 2 nên myVoted = false');
      assert.equal(note2ForB.votes, undefined);
    });

  } finally {
    // Dọn dẹp sockets
    if (socketA && socketA.connected) socketA.disconnect();
    if (socketB && socketB.connected) socketB.disconnect();

    // Dọn dẹp DB test
    if (retroSession) {
      await prisma.retroVote.deleteMany({ where: { note: { sessionId: retroSession.id } } }).catch(() => {});
      await prisma.retroNote.deleteMany({ where: { sessionId: retroSession.id } }).catch(() => {});
      await prisma.retroSession.delete({ where: { id: retroSession.id } }).catch(() => {});
    }
    if (project) {
      await prisma.projectMember.deleteMany({ where: { projectId: project.id } }).catch(() => {});
      await prisma.project.delete({ where: { id: project.id } }).catch(() => {});
    }
    if (userA) await prisma.user.delete({ where: { id: userA.id } }).catch(() => {});
    if (userB) await prisma.user.delete({ where: { id: userB.id } }).catch(() => {});
    if (userZ) await prisma.user.delete({ where: { id: userZ.id } }).catch(() => {});

    await prisma.$disconnect();
    if (server && server.close) {
      await new Promise((resolve) => server.close(resolve));
    }
    process.exit(0);
  }
});

