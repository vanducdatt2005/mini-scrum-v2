const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const jwt = require('jsonwebtoken');
const { prisma, server } = require('../src/index');
const { io: ClientIO } = require(path.resolve(__dirname, '../../frontend/node_modules/socket.io-client'));

test('SCRUM-77: Chuyển Action Item đã có vote thành User Story trong Sprint Backlog', async (t) => {
  let project, otherProject;
  let userSM, userPO, userDev, userOutsider;
  let tokenSM, tokenPO, tokenDev, tokenOutsider;
  let sprintActive, sprintCompleted, otherSprint;
  let retroSession;
  let actionNoteVoted, actionNoteZeroVote, wentWellNote, actionNoteConcurrent, actionNoteDeleteTest;
  let socketDev;

  const address = server.address();
  const port = address ? address.port : (process.env.PORT || 5000);
  const apiBase = `http://127.0.0.1:${port}/api`;
  const serverUrl = `http://127.0.0.1:${port}`;
  const jwtSecret = process.env.JWT_SECRET || 'mini_scrum_secret';
  const ts = Date.now();

  try {
    // 1. Tạo projects
    project = await prisma.project.create({
      data: {
        name: `Retro SCRUM-77 Project ${ts}`,
        description: 'Testing convert action item to user story',
      },
    });

    otherProject = await prisma.project.create({
      data: {
        name: `Other Project ${ts}`,
        description: 'Other project for cross-project sprint test',
      },
    });

    // 2. Tạo users
    userSM = await prisma.user.create({
      data: {
        email: `sm_convert_${ts}@example.com`,
        password: 'hashedpassword',
        fullName: 'Scrum Master 77',
        role: 'MEMBER',
      },
    });
    await prisma.projectMember.create({
      data: { userId: userSM.id, projectId: project.id, role: 'SM', status: 'ACCEPTED' },
    });

    userPO = await prisma.user.create({
      data: {
        email: `po_convert_${ts}@example.com`,
        password: 'hashedpassword',
        fullName: 'Product Owner 77',
        role: 'MEMBER',
      },
    });
    await prisma.projectMember.create({
      data: { userId: userPO.id, projectId: project.id, role: 'PO', status: 'ACCEPTED' },
    });

    userDev = await prisma.user.create({
      data: {
        email: `dev_secret_author_${ts}@example.com`,
        password: 'hashedpassword',
        fullName: 'Secret Author Dev',
        role: 'MEMBER',
      },
    });
    await prisma.projectMember.create({
      data: { userId: userDev.id, projectId: project.id, role: 'DEV', status: 'ACCEPTED' },
    });

    userOutsider = await prisma.user.create({
      data: {
        email: `outsider_convert_${ts}@example.com`,
        password: 'hashedpassword',
        fullName: 'Outsider 77',
        role: 'MEMBER',
      },
    });

    tokenSM = jwt.sign({ userId: userSM.id, email: userSM.email, role: 'MEMBER' }, jwtSecret);
    tokenPO = jwt.sign({ userId: userPO.id, email: userPO.email, role: 'MEMBER' }, jwtSecret);
    tokenDev = jwt.sign({ userId: userDev.id, email: userDev.email, role: 'MEMBER' }, jwtSecret);
    tokenOutsider = jwt.sign({ userId: userOutsider.id, email: userOutsider.email, role: 'MEMBER' }, jwtSecret);

    // 3. Tạo sprints
    sprintActive = await prisma.sprint.create({
      data: {
        name: `Sprint 2 Active ${ts}`,
        status: 'ACTIVE',
        projectId: project.id,
      },
    });

    sprintCompleted = await prisma.sprint.create({
      data: {
        name: `Sprint 1 Completed ${ts}`,
        status: 'COMPLETED',
        projectId: project.id,
      },
    });

    otherSprint = await prisma.sprint.create({
      data: {
        name: `Other Project Sprint ${ts}`,
        status: 'PLANNED',
        projectId: otherProject.id,
      },
    });

    // 4. Tạo buổi Retro và các notes
    retroSession = await prisma.retroSession.create({
      data: {
        projectId: project.id,
        title: `Retro Sprint 1 ${ts}`,
        status: 'OPEN',
        createdById: userSM.id,
      },
    });

    actionNoteVoted = await prisma.retroNote.create({
      data: {
        sessionId: retroSession.id,
        column: 'ACTION_ITEM',
        content: 'Tự động hóa kiểm thử API trước khi merge',
        authorId: userDev.id,
        isAnonymous: true,
      },
    });
    await prisma.retroVote.create({
      data: { noteId: actionNoteVoted.id, userId: userSM.id },
    });

    actionNoteZeroVote = await prisma.retroNote.create({
      data: {
        sessionId: retroSession.id,
        column: 'ACTION_ITEM',
        content: 'Action item chưa có vote',
        authorId: userDev.id,
        isAnonymous: false,
      },
    });

    wentWellNote = await prisma.retroNote.create({
      data: {
        sessionId: retroSession.id,
        column: 'WENT_WELL',
        content: 'Team phối hợp rất tốt',
        authorId: userDev.id,
        isAnonymous: false,
      },
    });
    await prisma.retroVote.create({
      data: { noteId: wentWellNote.id, userId: userSM.id },
    });

    actionNoteConcurrent = await prisma.retroNote.create({
      data: {
        sessionId: retroSession.id,
        column: 'ACTION_ITEM',
        content: 'Cải thiện tốc độ build CI',
        authorId: userDev.id,
        isAnonymous: true,
      },
    });
    await prisma.retroVote.create({
      data: { noteId: actionNoteConcurrent.id, userId: userPO.id },
    });

    actionNoteDeleteTest = await prisma.retroNote.create({
      data: {
        sessionId: retroSession.id,
        column: 'ACTION_ITEM',
        content: 'Note sẽ bị xóa sau khi chuyển',
        authorId: userDev.id,
        isAnonymous: true,
      },
    });
    await prisma.retroVote.create({
      data: { noteId: actionNoteDeleteTest.id, userId: userSM.id },
    });

    // Kết nối socket để kiểm tra event RETRO_NOTE_CONVERTED
    socketDev = await new Promise((resolve, reject) => {
      const s = ClientIO(serverUrl, {
        auth: { token: tokenDev },
        transports: ['websocket'],
        reconnection: false,
      });
      s.on('connect', () => {
        s.emit('joinProject', project.id, () => resolve(s));
      });
      s.on('connect_error', reject);
      setTimeout(() => resolve(s), 1000);
    });

    const convertUrl = (noteId) => `${apiBase}/retros/${retroSession.id}/notes/${noteId}/convert`;

    // TEST 1: Member thường -> 403
    await t.test('Member thường không được chuyển -> 403', async () => {
      const res = await fetch(convertUrl(actionNoteVoted.id), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenDev}`,
        },
        body: JSON.stringify({ sprintId: sprintActive.id }),
      });
      assert.equal(res.status, 403);
    });

    // TEST 2: Người ngoài Project -> 403
    await t.test('Người ngoài Project không được chuyển -> 403', async () => {
      const res = await fetch(convertUrl(actionNoteVoted.id), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenOutsider}`,
        },
        body: JSON.stringify({ sprintId: sprintActive.id }),
      });
      assert.equal(res.status, 403);
    });

    // TEST 3: Note không phải ACTION_ITEM hoặc 0 vote -> 400
    await t.test('Note không phải ACTION_ITEM hoặc 0 vote -> 400', async () => {
      const resNonAction = await fetch(convertUrl(wentWellNote.id), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenSM}`,
        },
        body: JSON.stringify({ sprintId: sprintActive.id }),
      });
      assert.equal(resNonAction.status, 400);

      const resZeroVote = await fetch(convertUrl(actionNoteZeroVote.id), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenSM}`,
        },
        body: JSON.stringify({ sprintId: sprintActive.id }),
      });
      assert.equal(resZeroVote.status, 400);
    });

    // TEST 4: Sprint COMPLETED hoặc khác Project -> 400
    await t.test('Sprint COMPLETED hoặc khác Project -> 400', async () => {
      const resCompleted = await fetch(convertUrl(actionNoteVoted.id), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenSM}`,
        },
        body: JSON.stringify({ sprintId: sprintCompleted.id }),
      });
      assert.equal(resCompleted.status, 400);

      const resOther = await fetch(convertUrl(actionNoteVoted.id), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenSM}`,
        },
        body: JSON.stringify({ sprintId: otherSprint.id }),
      });
      assert.equal(resOther.status, 400);
    });

    // TEST 5: Chuyển thành công đúng sprint, có liên kết note, ẩn danh tác giả, emit socket
    let firstStoryId;
    await t.test('Chuyển thành công, giữ ẩn danh tác giả, emit RETRO_NOTE_CONVERTED', async () => {
      const socketEventPromise = new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Timeout chờ RETRO_NOTE_CONVERTED')), 3000);
        socketDev.once('RETRO_NOTE_CONVERTED', (payload) => {
          clearTimeout(timer);
          resolve(payload);
        });
      });

      const res = await fetch(convertUrl(actionNoteVoted.id), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenSM}`,
        },
        body: JSON.stringify({ sprintId: sprintActive.id }),
      });

      assert.equal(res.status, 201);
      const body = await res.json();
      assert.equal(body.alreadyConverted, false);
      assert.ok(body.story?.id);
      firstStoryId = body.story.id;

      assert.equal(body.story.title, 'Tự động hóa kiểm thử API trước khi merge');
      assert.equal(body.story.description, `Từ buổi Retrospective: ${retroSession.title}`);
      assert.equal(body.story.projectId, project.id);
      assert.equal(body.story.sprintId, sprintActive.id);
      assert.equal(body.story.priority, 'MEDIUM');
      assert.equal(body.story.sourceRetroNoteId, actionNoteVoted.id);

      // Không chứa thông tin tác giả note ẩn danh
      assert.equal(body.story.assigneeId, null);
      const serializedStory = JSON.stringify(body.story);
      assert.equal(serializedStory.includes(userDev.id), false);
      assert.equal(serializedStory.includes(userDev.fullName), false);
      assert.equal(serializedStory.includes(userDev.email), false);

      // Kiểm tra socket payload
      const socketPayload = await socketEventPromise;
      assert.equal(socketPayload.noteId, actionNoteVoted.id);
      assert.equal(socketPayload.story.id, firstStoryId);
      assert.equal(socketPayload.story.title, body.story.title);
      const serializedSocket = JSON.stringify(socketPayload);
      assert.equal(serializedSocket.includes(userDev.id), false);
      assert.equal(serializedSocket.includes('author'), false);

      // Kiểm tra serializer note trả về convertedStory
      const detailRes = await fetch(`${apiBase}/retros/${retroSession.id}`, {
        headers: { Authorization: `Bearer ${tokenDev}` },
      });
      assert.equal(detailRes.status, 200);
      const detail = await detailRes.json();
      const foundNote = detail.columns.ACTION_ITEM.find((n) => n.id === actionNoteVoted.id);
      assert.deepEqual(foundNote.convertedStory, { id: firstStoryId, title: body.story.title });
    });

    // TEST 6: Chuyển lần 2 trả story cũ và tổng story nguồn = 1 (Idempotent)
    await t.test('Chuyển lần 2 trả 200 {alreadyConverted: true, story} và tổng story = 1', async () => {
      const res = await fetch(convertUrl(actionNoteVoted.id), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenPO}`,
        },
        body: JSON.stringify({ sprintId: sprintActive.id }),
      });

      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.alreadyConverted, true);
      assert.equal(body.story.id, firstStoryId);

      const count = await prisma.userStory.count({
        where: { sourceRetroNoteId: actionNoteVoted.id },
      });
      assert.equal(count, 1);
    });

    // TEST 7: 2 request song song chỉ tạo 1 story
    await t.test('2 request song song chỉ tạo 1 story', async () => {
      const req1 = fetch(convertUrl(actionNoteConcurrent.id), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenSM}`,
        },
        body: JSON.stringify({ sprintId: sprintActive.id }),
      });
      const req2 = fetch(convertUrl(actionNoteConcurrent.id), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenPO}`,
        },
        body: JSON.stringify({ sprintId: sprintActive.id }),
      });

      const [res1, res2] = await Promise.all([req1, req2]);
      assert.ok([200, 201].includes(res1.status));
      assert.ok([200, 201].includes(res2.status));

      const body1 = await res1.json();
      const body2 = await res2.json();
      assert.equal(body1.story.id, body2.story.id);

      const count = await prisma.userStory.count({
        where: { sourceRetroNoteId: actionNoteConcurrent.id },
      });
      assert.equal(count, 1);
    });

    // TEST 8: Xóa note thì sourceRetroNoteId được set null
    await t.test('Xóa note nguồn thì UserStory.sourceRetroNoteId được set null', async () => {
      const res = await fetch(convertUrl(actionNoteDeleteTest.id), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenSM}`,
        },
        body: JSON.stringify({ sprintId: sprintActive.id }),
      });
      assert.equal(res.status, 201);
      const body = await res.json();
      const storyId = body.story.id;

      await prisma.retroNote.delete({ where: { id: actionNoteDeleteTest.id } });
      const storyAfter = await prisma.userStory.findUnique({ where: { id: storyId } });
      assert.ok(storyAfter);
      assert.equal(storyAfter.sourceRetroNoteId, null);
    });
  } finally {
    if (socketDev) socketDev.disconnect();
    if (project) {
      await prisma.userStory.deleteMany({ where: { projectId: project.id } });
      await prisma.retroSession.deleteMany({ where: { projectId: project.id } });
      await prisma.sprint.deleteMany({ where: { projectId: project.id } });
      await prisma.projectMember.deleteMany({ where: { projectId: project.id } });
      await prisma.project.delete({ where: { id: project.id } }).catch(() => {});
    }
    if (otherProject) {
      await prisma.sprint.deleteMany({ where: { projectId: otherProject.id } });
      await prisma.project.delete({ where: { id: otherProject.id } }).catch(() => {});
    }
    const userIds = [userSM?.id, userPO?.id, userDev?.id, userOutsider?.id].filter(Boolean);
    if (userIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } }).catch(() => {});
    }
    await prisma.$disconnect();
    server.close();
  }
});

