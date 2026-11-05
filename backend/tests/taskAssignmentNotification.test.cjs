/**
 * Integration Test: Real-time Task Assignment Notification (NOTIFICATION_ASSIGNED) & RBAC Permissions
 * 
 * Kịch bản kiểm thử:
 * 1. Phân quyền (RBAC):
 *    - User C (vai trò MEMBER, không phải PO/SM) cố tình gán task -> Bị Backend từ chối với HTTP 403.
 * 2. Giao task bởi PO/SM:
 *    - User A (PO/SM) gán Task cho User B (Member) -> Thành công với HTTP 200.
 * 3. Kiểm chứng Socket Private Room (AC4):
 *    - User B nhận được sự kiện NOTIFICATION_ASSIGNED với payload đầy đủ thông tin.
 *    - User C (MEMBER khác đang online) KHÔNG nhận được bất kỳ sự kiện nào.
 *    - User A (người giao) KHÔNG nhận lại thông báo của chính mình.
 */

const path = require('path');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { io } = require(path.resolve(__dirname, '../../frontend/node_modules/socket.io-client'));

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:5000';
const JWT_SECRET = process.env.JWT_SECRET || 'mini_scrum_secret';

function createToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role || 'MEMBER' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

function connectSocket(token, label) {
  return new Promise((resolve, reject) => {
    const socket = io(SERVER_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: false,
      timeout: 5000,
    });

    socket.on('connect', () => {
      console.log(`  [+] ${label} kết nối thành công (Socket ID: ${socket.id})`);
      resolve(socket);
    });

    socket.on('connect_error', (err) => {
      console.error(`  [-] ${label} lỗi kết nối:`, err.message);
      reject(err);
    });
  });
}

async function runTest() {
  console.log('================================================================');
  console.log('🚀 BẮT ĐẦU INTEGRATION TEST: NOTIFICATION & PERMISSION VERIFICATION');
  console.log('================================================================');

  try {
    // 1. Lấy Project có 1 PO và ít nhất 2 Member
    const projects = await prisma.project.findMany({
      where: {
        members: { some: { role: 'PO' } }
      },
      include: {
        members: {
          include: { user: true }
        },
        userStories: {
          include: { tasks: true }
        }
      }
    });

    const project = projects.find(p => {
      const hasPO = p.members.some(m => m.role === 'PO' || m.role === 'SM');
      const memberCount = p.members.filter(m => m.role === 'MEMBER').length;
      return hasPO && memberCount >= 2;
    });

    if (!project) {
      throw new Error('Không tìm thấy project có PO và ít nhất 2 member để kiểm thử.');
    }

    const poMember = project.members.find(m => m.role === 'PO' || m.role === 'SM');
    const normalMembers = project.members.filter(m => m.role === 'MEMBER');

    if (!poMember || normalMembers.length < 2) {
      throw new Error(`Cần ít nhất 1 PO và 2 Member trong project "${project.name}" để kiểm thử.`);
    }

    const userA = poMember.user;      // PO
    const userB = normalMembers[0].user; // Member được giao
    const userC = normalMembers[1].user; // Member thứ 3 (không liên quan)

    console.log(`- Project: [${project.id}] "${project.name}"`);
    console.log(`- User A (PO - Người giao task): [${userA.id}] ${userA.fullName} (${userA.email})`);
    console.log(`- User B (Member - Người được nhận task): [${userB.id}] ${userB.fullName} (${userB.email})`);
    console.log(`- User C (Member - Người thứ 3 không được giao): [${userC.id}] ${userC.fullName} (${userC.email})`);

    // 2. Tìm hoặc tạo 1 task thuộc project
    let task = null;
    for (const story of project.userStories) {
      if (story.tasks && story.tasks.length > 0) {
        task = story.tasks[0];
        break;
      }
    }

    if (!task) {
      throw new Error('Project không có task nào để kiểm thử.');
    }

    console.log(`- Task kiểm thử: [${task.id}] "${task.title}"`);

    // 3. TEST PHẦN QUYỀN: User C (MEMBER) thử gán task -> Phải bị chặn với 403 Forbidden
    console.log('\n🔒 KIỂM TRA PHÂN QUYỀN (RBAC):');
    const tokenC = createToken(userC);
    const unauthorizedRes = await fetch(`${SERVER_URL}/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenC}`
      },
      body: JSON.stringify({
        assigneeId: task.assigneeId === userB.id ? userC.id : userB.id
      })
    });

    if (unauthorizedRes.status === 403) {
      const errJson = await unauthorizedRes.json();
      console.log(`  ✅ [PASS] User C (MEMBER) bị chặn không có quyền gán Task: HTTP 403 - "${errJson.error}"`);
    } else {
      console.error(`  ❌ [FAIL] User C (MEMBER) không bị chặn! Status: ${unauthorizedRes.status}`);
      process.exit(1);
    }

    // 4. TEST WEBSOCKET REALTIME & NOTIFICATION ISOLATION
    console.log('\n📡 KẾT NỐI 3 SOCKET CLIENT (A, B, C)...');
    const tokenA = createToken(userA);
    const tokenB = createToken(userB);

    const socketA = await connectSocket(tokenA, 'Socket User A (PO)');
    const socketB = await connectSocket(tokenB, 'Socket User B (Assignee)');
    const socketC = await connectSocket(tokenC, 'Socket User C (Bystander)');

    await new Promise(r => setTimeout(r, 500));

    const eventsB = [];
    const eventsC = [];
    const eventsA = [];

    socketB.on('NOTIFICATION_ASSIGNED', data => {
      console.log('  🔔 User B nhận sự kiện NOTIFICATION_ASSIGNED!');
      eventsB.push(data);
    });

    socketC.on('NOTIFICATION_ASSIGNED', data => {
      console.error('  ⚠️ CẢNH BÁO: User C nhận được sự kiện NOTIFICATION_ASSIGNED không mong muốn!');
      eventsC.push(data);
    });

    socketA.on('NOTIFICATION_ASSIGNED', data => {
      console.error('  ⚠️ CẢNH BÁO: User A nhận lại sự kiện của chính mình!');
      eventsA.push(data);
    });

    // 5. User A (PO) thực hiện gán task cho User B thông qua REST API
    console.log(`\n👉 User A (PO) gán Task "${task.title}" cho User B (Member)...`);
    const assignRes = await fetch(`${SERVER_URL}/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenA}`
      },
      body: JSON.stringify({
        assigneeId: userB.id
      })
    });

    if (!assignRes.ok) {
      const errText = await assignRes.text();
      throw new Error(`PO gán task thất bại (status ${assignRes.status}): ${errText}`);
    }
    console.log('  ✓ PO gán Task thành công (HTTP 200)');

    // 6. Chờ nhận WebSocket event
    console.log('\n⏳ Đang chờ WebSocket truyền tải sự kiện...');
    await new Promise(r => setTimeout(r, 1500));

    // 7. ASSERTIONS
    console.log('\n📋 KẾT QUẢ KIỂM CHỨNG:');
    let allPassed = true;

    // Kiểm tra User B
    if (eventsB.length === 1) {
      const p = eventsB[0];
      const correctRecipient = String(p.recipient_id || p.userId) === String(userB.id);
      const correctSender = String(p.sender_id || p.senderId) === String(userA.id);
      const correctTask = String(p.task_id || p.taskId) === String(task.id);
      const correctType = p.type === 'TASK_ASSIGNED';

      if (correctRecipient && correctSender && correctTask && correctType) {
        console.log('  ✅ [PASS] User B nhận đúng 1 thông báo NOTIFICATION_ASSIGNED:');
        console.log(`     - Người nhận (recipient_id): ${p.recipient_id}`);
        console.log(`     - Người giao (sender_name): ${p.sender_name}`);
        console.log(`     - Tên Task: "${p.task_title}"`);
        console.log(`     - Tên Dự án: "${p.project_name}"`);
      } else {
        console.error('  ❌ [FAIL] Payload User B nhận không hợp lệ:', p);
        allPassed = false;
      }
    } else {
      console.error(`  ❌ [FAIL] User B kỳ vọng nhận 1 sự kiện nhưng nhận được ${eventsB.length}`);
      allPassed = false;
    }

    // Kiểm tra User C
    if (eventsC.length === 0) {
      console.log('  ✅ [PASS] User C (Member khác online) hoàn toàn KHÔNG nhận được thông báo NOTIFICATION_ASSIGNED.');
    } else {
      console.error(`  ❌ [FAIL] User C nhận được ${eventsC.length} thông báo trái phép!`);
      allPassed = false;
    }

    // Kiểm tra User A
    if (eventsA.length === 0) {
      console.log('  ✅ [PASS] User A (PO - Người giao) không bị nhận thông báo thừa.');
    } else {
      console.error('  ❌ [FAIL] User A nhận lại thông báo do mình giao.');
      allPassed = false;
    }

    // Đóng kết nối
    socketA.disconnect();
    socketB.disconnect();
    socketC.disconnect();

    console.log('\n================================================================');
    if (allPassed) {
      console.log('🎉 TẤT CẢ KỊCH BẢN KIỂM THỬ ĐỀU ĐẠT CHUẨN 100% (PASS)!');
    } else {
      console.log('💥 KIỂM THỬ THẤT BẠI.');
      process.exit(1);
    }
    console.log('================================================================\n');

  } catch (err) {
    console.error('❌ Lỗi ngoại lệ:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTest();
