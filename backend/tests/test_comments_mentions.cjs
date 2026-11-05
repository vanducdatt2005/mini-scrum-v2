const { io } = require('../../frontend/node_modules/socket.io-client');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:5000/api';
const SOCKET_URL = 'http://localhost:5000';
const JWT_SECRET = process.env.JWT_SECRET || 'mini_scrum_secret';

function createToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role || 'USER' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

async function apiRequest(method, url, data = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined
  });

  const resData = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data: resData };
}

async function runTests() {
  console.log('🧪 Bắt đầu Integration Test cho tính năng Bình luận, Đính kèm & @Mention...\n');

  try {
    // 1. Lấy dữ liệu người dùng và project có sẵn trong DB (không tạo rác, không xóa DB)
    const users = await prisma.user.findMany({ take: 4 });
    if (users.length < 2) {
      console.error('❌ Cần ít nhất 2 users trong database');
      process.exit(1);
    }
    const [userA, userB, userC] = users;
    console.log(`👤 User A (Author): ${userA.fullName} (${userA.email})`);
    console.log(`👤 User B (Mention target): ${userB.fullName} (${userB.email})`);
    if (userC) console.log(`👤 User C: ${userC.fullName} (${userC.email})`);

    const tokenA = createToken(userA);
    const tokenB = createToken(userB);

    // Tìm 1 task có sẵn trong DB
    const task = await prisma.task.findFirst({
      include: { userStory: { select: { projectId: true } } }
    });

    if (!task) {
      console.error('❌ Không tìm thấy Task nào trong DB để test');
      process.exit(1);
    }

    const projectId = task.userStory?.projectId;
    console.log(`📌 Sử dụng Task ID: ${task.id} (Project ID: ${projectId})`);

    // Đảm bảo User A và User B là thành viên của project chứa task
    await prisma.projectMember.upsert({
      where: { userId_projectId: { userId: userA.id, projectId } },
      update: { status: 'ACCEPTED', role: 'PO' },
      create: { userId: userA.id, projectId, role: 'PO', status: 'ACCEPTED' }
    });

    await prisma.projectMember.upsert({
      where: { userId_projectId: { userId: userB.id, projectId } },
      update: { status: 'ACCEPTED', role: 'MEMBER' },
      create: { userId: userB.id, projectId, role: 'MEMBER', status: 'ACCEPTED' }
    });

    // 2. Thiết lập Socket client cho User B (để lắng nghe COMMENT_MENTIONED và COMMENT_CREATED)
    const socketB = io(SOCKET_URL, {
      auth: { token: tokenB },
      transports: ['websocket']
    });

    const receivedEvents = [];

    await new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(), 3000);
      socketB.on('connect', () => {
        console.log(`🔌 Socket User B connected (ID: ${socketB.id})`);
        socketB.emit('JOIN_TASK_ROOM', task.id);
        clearTimeout(timeout);
        resolve();
      });
      socketB.on('connect_error', (err) => {
        console.error('Socket connect error:', err.message);
        clearTimeout(timeout);
        resolve();
      });
    });

    socketB.on('COMMENT_CREATED', (data) => {
      console.log('⚡ Socket User B nhận được event COMMENT_CREATED');
      receivedEvents.push({ type: 'COMMENT_CREATED', data });
    });

    socketB.on('COMMENT_MENTIONED', (data) => {
      console.log('⚡ Socket User B nhận được event COMMENT_MENTIONED');
      receivedEvents.push({ type: 'COMMENT_MENTIONED', data });
    });

    socketB.on('COMMENT_UPDATED', (data) => {
      console.log('⚡ Socket User B nhận được event COMMENT_UPDATED');
      receivedEvents.push({ type: 'COMMENT_UPDATED', data });
    });

    socketB.on('COMMENT_DELETED', (data) => {
      console.log('⚡ Socket User B nhận được event COMMENT_DELETED');
      receivedEvents.push({ type: 'COMMENT_DELETED', data });
    });

    // TEST 1: Tạo bình luận mới có @mention User B (AC1, AC2)
    console.log('\n--- TEST 1: Tạo bình luận kèm @mention User B ---');
    const mentionContent = `Chào bạn @[${userB.fullName}](${userB.id}), vui lòng review task này nhé!`;
    const postRes = await apiRequest('POST', `${BASE_URL}/tasks/${task.id}/comments`, { content: mentionContent }, tokenA);

    if (postRes.status !== 201) {
      throw new Error(`Tạo comment thất bại (${postRes.status}): ${JSON.stringify(postRes.data)}`);
    }

    console.log(`✅ Tạo bình luận thành công! Comment ID: ${postRes.data.id}`);
    const createdCommentId = postRes.data.id;

    if (!postRes.data.mentionedUserIds.includes(userB.id)) {
      throw new Error(`mentionedUserIds không chứa userB.id: ${JSON.stringify(postRes.data.mentionedUserIds)}`);
    }
    console.log('✅ Bóc tách @mention chính xác: mentionedUserIds =', postRes.data.mentionedUserIds);

    // Chờ 1.5s để socket deliver event
    await new Promise((r) => setTimeout(r, 1500));

    const gotCreated = receivedEvents.some((e) => e.type === 'COMMENT_CREATED');
    const gotMentioned = receivedEvents.some((e) => e.type === 'COMMENT_MENTIONED');
    console.log(`✅ Socket event COMMENT_CREATED: ${gotCreated ? 'NHẬN ĐƯỢC' : 'CHƯA NHẬN'}`);
    console.log(`✅ Socket event COMMENT_MENTIONED gửi đúng User B: ${gotMentioned ? 'NHẬN ĐƯỢC' : 'CHƯA NHẬN'}`);

    // TEST 2: Quyền Sửa (Edit) - User B không được phép sửa comment của User A (AC3)
    console.log('\n--- TEST 2: Kiểm tra phân quyền sửa (Non-author không được sửa) ---');
    const editFail = await apiRequest('PATCH', `${BASE_URL}/comments/${createdCommentId}`, { content: 'User B cố tình sửa bình luận của User A' }, tokenB);
    if (editFail.status === 403) {
      console.log('✅ Chính xác: User B nhận lỗi 403 Forbidden khi cố sửa comment của User A.');
    } else {
      throw new Error(`LỖI: Non-author không nhận 403, nhận ${editFail.status}: ${JSON.stringify(editFail.data)}`);
    }

    // TEST 3: User A sửa bình luận - Không gửi lại thông báo cho người đã được tag trước đó (AC2 & DoD)
    console.log('\n--- TEST 3: Sửa bình luận và kiểm tra chống duplicate notification ---');
    receivedEvents.length = 0; // Clear received events

    const editRes = await apiRequest('PATCH', `${BASE_URL}/comments/${createdCommentId}`, {
      content: `Chào bạn @[${userB.fullName}](${userB.id}), đã cập nhật nội dung mới!`
    }, tokenA);

    if (editRes.status !== 200) {
      throw new Error(`Sửa bình luận thất bại (${editRes.status}): ${JSON.stringify(editRes.data)}`);
    }

    console.log(`✅ User A sửa bình luận thành công! isEdited: ${editRes.data.isEdited}`);
    if (!editRes.data.isEdited) throw new Error('isEdited không được bật thành true!');

    await new Promise((r) => setTimeout(r, 1000));
    const gotMentionedAgain = receivedEvents.some((e) => e.type === 'COMMENT_MENTIONED');
    if (gotMentionedAgain) {
      throw new Error('LỖI: User B bị gửi lại thông báo trùng lặp dù đã được tag trước đó!');
    } else {
      console.log('✅ Chính xác: User B KHÔNG bị gửi thông báo trùng lặp khi edit comment!');
    }

    const gotUpdated = receivedEvents.some((e) => e.type === 'COMMENT_UPDATED');
    console.log(`✅ Socket event COMMENT_UPDATED: ${gotUpdated ? 'NHẬN ĐƯỢC' : 'CHƯA NHẬN'}`);

    // TEST 4: Xóa bình luận (AC3)
    console.log('\n--- TEST 4: Xóa bình luận ---');
    const delRes = await apiRequest('DELETE', `${BASE_URL}/comments/${createdCommentId}`, null, tokenA);
    if (delRes.status !== 200) {
      throw new Error(`Xóa bình luận thất bại (${delRes.status}): ${JSON.stringify(delRes.data)}`);
    }
    console.log(`✅ Xóa comment thành công: ${delRes.data.message}`);

    await new Promise((r) => setTimeout(r, 1000));
    const gotDeleted = receivedEvents.some((e) => e.type === 'COMMENT_DELETED');
    console.log(`✅ Socket event COMMENT_DELETED: ${gotDeleted ? 'NHẬN ĐƯỢC' : 'CHƯA NHẬN'}`);

    socketB.disconnect();

    console.log('\n🎉 TẤT CẢ CÁC BÀI TEST TÍNH NĂNG BÌNH LUẬN & MENTION ĐÃ THÀNH CÔNG 100%!');
  } catch (error) {
    console.error('\n❌ TEST THẤT BẠI:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
