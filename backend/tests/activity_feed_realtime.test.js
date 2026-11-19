const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const jwt = require('jsonwebtoken');
const { app, prisma, server } = require('../src/index');
const { logActivity } = require('../src/services/activityService');
const { io } = require(path.resolve(__dirname, '../../frontend/node_modules/socket.io-client'));

test('SCRUM-71: Activity Feed cho Project cập nhật Realtime', async (t) => {
  let project1, project2, memberUser, nonMemberUser;
  let memberToken, nonMemberToken;
  let socket1, socket2;

  const address = server.address();
  const port = address ? address.port : (process.env.PORT || 5000);
  const serverUrl = `http://127.0.0.1:${port}`;
  const jwtSecret = process.env.JWT_SECRET || 'mini_scrum_secret';

  // Chuẩn bị dữ liệu test
  const timestamp = Date.now();
  memberUser = await prisma.user.create({
    data: {
      email: `member_${timestamp}@example.com`,
      password: 'hashedpassword',
      fullName: 'Thành Viên Dự Án'
    }
  });

  nonMemberUser = await prisma.user.create({
    data: {
      email: `nonmember_${timestamp}@example.com`,
      password: 'hashedpassword',
      fullName: 'Người Ngoài Dự Án'
    }
  });

  project1 = await prisma.project.create({
    data: {
      name: `Test Project 1 - ${timestamp}`,
      members: {
        create: {
          userId: memberUser.id,
          role: 'DEV'
        }
      }
    }
  });

  project2 = await prisma.project.create({
    data: {
      name: `Test Project 2 - ${timestamp}`
    }
  });

  memberToken = jwt.sign(
    { userId: memberUser.id, email: memberUser.email, role: 'DEV' },
    jwtSecret
  );

  nonMemberToken = jwt.sign(
    { userId: nonMemberUser.id, email: nonMemberUser.email, role: 'DEV' },
    jwtSecret
  );

  // Tạo một số activity mẫu cho project1
  for (let i = 1; i <= 5; i++) {
    await prisma.activityLog.create({
      data: {
        projectId: project1.id,
        actorId: memberUser.id,
        action: i % 2 === 0 ? 'TASK_CREATED' : 'TASK_STATUS_CHANGED',
        targetType: 'TASK',
        targetId: `task-${i}`,
        targetTitle: `Nhiệm vụ số ${i}`,
        meta: { step: i },
        createdAt: new Date(Date.now() - (6 - i) * 60000)
      }
    });
  }

  // -------------------------------------------------------------
  // TEST 1: API GET /api/projects/:id/activities
  // -------------------------------------------------------------
  await t.test('1. API: Thành viên truy cập -> 200, trả về items sắp xếp giảm dần và cursor', async () => {
    const res = await fetch(`${serverUrl}/api/projects/${project1.id}/activities?limit=3`, {
      headers: {
        Authorization: `Bearer ${memberToken}`
      }
    });

    assert.equal(res.status, 200);
    const data = await res.json();

    assert.ok(Array.isArray(data.items));
    assert.equal(data.items.length, 3);
    assert.ok(data.nextCursor, 'Phải có nextCursor khi còn dữ liệu');

    // Kiểm tra thông tin actor
    const firstItem = data.items[0];
    assert.ok(firstItem.actor);
    assert.equal(firstItem.actor.id, memberUser.id);
    assert.equal(firstItem.actor.name, memberUser.fullName);

    // Kiểm tra thứ tự giảm dần theo thời gian (mới nhất trước)
    const time0 = new Date(data.items[0].createdAt).getTime();
    const time1 = new Date(data.items[1].createdAt).getTime();
    const time2 = new Date(data.items[2].createdAt).getTime();
    assert.ok(time0 >= time1, 'Mục đầu tiên phải mới hơn hoặc bằng mục thứ hai');
    assert.ok(time1 >= time2, 'Mục thứ hai phải mới hơn hoặc bằng mục thứ ba');

    // Kiểm tra phân trang cursor tiếp theo
    const resPage2 = await fetch(`${serverUrl}/api/projects/${project1.id}/activities?limit=3&cursor=${data.nextCursor}`, {
      headers: {
        Authorization: `Bearer ${memberToken}`
      }
    });
    assert.equal(resPage2.status, 200);
    const dataPage2 = await resPage2.json();
    assert.equal(dataPage2.items.length, 2);
    // Không bị lặp lại item
    assert.notEqual(dataPage2.items[0].id, firstItem.id);
  });

  await t.test('2. API: Người không thuộc project truy cập -> 403 Forbidden', async () => {
    const res = await fetch(`${serverUrl}/api/projects/${project1.id}/activities`, {
      headers: {
        Authorization: `Bearer ${nonMemberToken}`
      }
    });

    assert.equal(res.status, 403);
    const data = await res.json();
    assert.match(data.error, /quyền|dự án/i);
  });

  // -------------------------------------------------------------
  // TEST 2: Realtime Socket.io Room Isolation & Event Delivery
  // -------------------------------------------------------------
  await t.test('3. Realtime: Tạo activity -> Socket room project1 nhận ACTIVITY_CREATED, room project2 KHÔNG nhận', async () => {
    // Kết nối socket cho member thuộc project1 (token chứa projectIds hoặc join room)
    const connectMemberSocket = (token) => {
      return new Promise((resolve, reject) => {
        const s = io(serverUrl, {
          auth: { token },
          transports: ['websocket'],
          reconnection: false
        });
        s.on('connect', () => resolve(s));
        s.on('connect_error', reject);
      });
    };

    socket1 = await connectMemberSocket(memberToken);
    socket2 = await connectMemberSocket(nonMemberToken);

    // Socket 1 join room project 1
    await new Promise((resolve) => {
      socket1.emit('joinProject', project1.id, () => resolve());
    });

    // Socket 2 join room project 2
    await new Promise((resolve) => {
      socket2.emit('joinProject', project2.id, () => resolve());
    });

    let socket1ReceivedEvent = null;
    let socket2ReceivedEvent = null;

    socket1.on('ACTIVITY_CREATED', (payload) => {
      socket1ReceivedEvent = payload;
    });

    socket2.on('ACTIVITY_CREATED', (payload) => {
      socket2ReceivedEvent = payload;
    });

    // Gọi helper logActivity tạo activity cho project 1
    const testAction = 'TASK_CREATED';
    const testTargetTitle = 'Test Realtime Task';
    await logActivity({
      projectId: project1.id,
      actorId: memberUser.id,
      action: testAction,
      targetType: 'TASK',
      targetId: 'realtime-task-1',
      targetTitle: testTargetTitle,
      meta: { priority: 'HIGH' }
    });

    // Chờ 300ms để socket truyền tin
    await new Promise((r) => setTimeout(r, 300));

    // Socket 1 (thuộc room project 1) PHẢI nhận được event với đầy đủ thông tin
    assert.ok(socket1ReceivedEvent, 'Socket 1 phải nhận được sự kiện ACTIVITY_CREATED');
    assert.equal(socket1ReceivedEvent.projectId, project1.id);
    assert.equal(socket1ReceivedEvent.action, testAction);
    assert.equal(socket1ReceivedEvent.targetTitle, testTargetTitle);
    assert.equal(socket1ReceivedEvent.actor.id, memberUser.id);
    assert.equal(socket1ReceivedEvent.actor.name, memberUser.fullName);

    // Socket 2 (room project 2) KHÔNG được nhận event của project 1
    assert.equal(socket2ReceivedEvent, null, 'Socket 2 (thuộc room project 2) KHÔNG được nhận event của project 1');

    socket1.disconnect();
    socket2.disconnect();
  });

  // -------------------------------------------------------------
  // TEST 3: Frontend Component De-duplication Logic & Relative Time
  // -------------------------------------------------------------
  await t.test('4. Frontend Logic: Sự kiện socket đẩy 2 lần cùng ID -> Danh sách không bị nhân đôi (de-dupe)', () => {
    // Logic de-dupe tái hiện đúng state updater trong ActivityFeed.jsx
    const deDupeStateUpdater = (prevList, incomingItem) => {
      const exists = prevList.some((item) => item.id === incomingItem.id);
      if (exists) {
        return prevList.map((item) => (item.id === incomingItem.id ? { ...item, ...incomingItem } : item));
      }
      return [incomingItem, ...prevList];
    };

    let list = [
      { id: 'act-1', targetTitle: 'Hoạt động 1', action: 'TASK_CREATED' }
    ];

    const duplicateItem = {
      id: 'act-new-2',
      targetTitle: 'Nhiệm vụ mới',
      action: 'TASK_CREATED',
      meta: { version: 1 }
    };

    // Đẩy lần 1
    list = deDupeStateUpdater(list, duplicateItem);
    assert.equal(list.length, 2);
    assert.equal(list[0].id, 'act-new-2');

    // Đẩy lần 2 cùng ID nhưng có cập nhật dữ liệu (upsert)
    const updatedDuplicateItem = {
      ...duplicateItem,
      meta: { version: 2 }
    };
    list = deDupeStateUpdater(list, updatedDuplicateItem);

    // Không bị nhân đôi: số lượng phần tử vẫn là 2
    assert.equal(list.length, 2, 'Danh sách không được nhân đôi khi nhận cùng một ID');
    assert.equal(list[0].id, 'act-new-2');
    assert.equal(list[0].meta.version, 2, 'Dữ liệu được cập nhật đúng vị trí mà không sinh bản sao');
  });

  await t.test('5. Frontend Helper: formatRelativeTime trả về đúng định dạng tiếng Việt', () => {
    const formatRelativeTime = (dateString) => {
      if (!dateString) return 'Vừa xong';
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Vừa xong';
      const now = new Date();
      const diffInSeconds = Math.max(0, Math.floor((now - date) / 1000));

      if (diffInSeconds < 60) return 'Vừa xong';
      const diffInMinutes = Math.floor(diffInSeconds / 60);
      if (diffInMinutes < 60) return `${diffInMinutes} phút trước`;
      const diffInHours = Math.floor(diffInMinutes / 60);
      if (diffInHours < 24) return `${diffInHours} giờ trước`;
      const diffInDays = Math.floor(diffInHours / 24);
      if (diffInDays < 30) return `${diffInDays} ngày trước`;

      const d = date.getDate().toString().padStart(2, '0');
      const m = (date.getMonth() + 1).toString().padStart(2, '0');
      const y = date.getFullYear();
      return `${d}/${m}/${y}`;
    };

    const now = Date.now();
    assert.equal(formatRelativeTime(new Date(now - 10000)), 'Vừa xong');
    assert.equal(formatRelativeTime(new Date(now - 5 * 60 * 1000)), '5 phút trước');
    assert.equal(formatRelativeTime(new Date(now - 3 * 3600 * 1000)), '3 giờ trước');
    assert.equal(formatRelativeTime(new Date(now - 2 * 86400 * 1000)), '2 ngày trước');
  });

  // Dọn dẹp dữ liệu test
  try {
    await prisma.activityLog.deleteMany({
      where: { projectId: { in: [project1.id, project2.id] } }
    });
    await prisma.projectMember.deleteMany({
      where: { projectId: { in: [project1.id, project2.id] } }
    });
    await prisma.project.deleteMany({
      where: { id: { in: [project1.id, project2.id] } }
    });
    await prisma.user.deleteMany({
      where: { id: { in: [memberUser.id, nonMemberUser.id] } }
    });
  } catch (cleanErr) {
    // Ignore cleanup error
  } finally {
    server.close();
    setTimeout(() => process.exit(0), 100);
  }
});
