/**
 * Integration Test: Trang "Bản tin hôm nay" (Daily Digest / Team Standup Board)
 * Kiểm chứng 3 tiêu chí:
 * 1. AC1 Pass: Lấy danh sách Daily trong ngày, đầy đủ Tên, Mood, 3 câu trả lời, sắp xếp user.fullName ASC, summary chuẩn.
 * 2. AC2 Pass: Bộ lọc onlyBlocked=true chỉ trả về các thành viên có blocked = true.
 * 3. DoD Permission Pass: User không thuộc Project gọi API -> Bị chặn 403 Forbidden ("Bạn không có quyền xem báo cáo Daily của dự án này").
 */

const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const BASE_URL = 'http://localhost:5000/api';

async function runDailyDigestTests() {
  console.log('🧪 Bắt đầu Integration Test cho trang "Bản tin hôm nay" (Daily Digest)...');

  // 1. Tìm hoặc tạo Active Sprint và Project 1
  let sprint = await prisma.sprint.findFirst({
    where: { status: 'ACTIVE' },
    include: { project: true }
  });

  if (!sprint) {
    console.error('❌ Không tìm thấy Active Sprint để test.');
    process.exit(1);
  }

  const project1 = sprint.project;
  console.log(`🏃 Project 1: "${project1.name}" (ID: ${project1.id}) - Sprint: "${sprint.name}" (ID: ${sprint.id})`);

  // 2. Chuẩn bị 2 thành viên thuộc Project 1
  let userA = await prisma.user.findFirst({ where: { email: 'digest_user_a@miniscrum.local' } });
  if (!userA) {
    userA = await prisma.user.create({
      data: {
        email: 'digest_user_a@miniscrum.local',
        password: 'hashed_password_a',
        fullName: 'An Nguyễn (Member A)',
        role: 'USER'
      }
    });
  }

  let userB = await prisma.user.findFirst({ where: { email: 'digest_user_b@miniscrum.local' } });
  if (!userB) {
    userB = await prisma.user.create({
      data: {
        email: 'digest_user_b@miniscrum.local',
        password: 'hashed_password_b',
        fullName: 'Bình Trần (Member B)',
        role: 'USER'
      }
    });
  }

  // Gán userA và userB vào Project 1
  await prisma.projectMember.upsert({
    where: { userId_projectId: { userId: userA.id, projectId: project1.id } },
    update: { role: 'MEMBER', status: 'ACCEPTED' },
    create: { userId: userA.id, projectId: project1.id, role: 'MEMBER', status: 'ACCEPTED' }
  });

  await prisma.projectMember.upsert({
    where: { userId_projectId: { userId: userB.id, projectId: project1.id } },
    update: { role: 'MEMBER', status: 'ACCEPTED' },
    create: { userId: userB.id, projectId: project1.id, role: 'MEMBER', status: 'ACCEPTED' }
  });

  const tokenA = jwt.sign({ userId: userA.id, email: userA.email }, JWT_SECRET, { expiresIn: '1h' });

  // 3. Chuẩn bị User C và Project 2 riêng biệt (để test DoD Security)
  let project2 = await prisma.project.findFirst({
    where: { id: { not: project1.id } }
  });

  if (!project2) {
    project2 = await prisma.project.create({
      data: {
        name: 'Project Cô Lập (Test DoD)',
        description: 'Dự án để test phân quyền'
      }
    });
  }

  let userC = await prisma.user.findFirst({ where: { email: 'digest_user_c_outsider@miniscrum.local' } });
  if (!userC) {
    userC = await prisma.user.create({
      data: {
        email: 'digest_user_c_outsider@miniscrum.local',
        password: 'hashed_password_c',
        fullName: 'Cường Độc Lập (Outsider)',
        role: 'USER'
      }
    });
  }

  // Đảm bảo userC chỉ ở Project 2, KHÔNG ở Project 1
  await prisma.projectMember.deleteMany({
    where: { userId: userC.id, projectId: project1.id }
  });

  await prisma.projectMember.upsert({
    where: { userId_projectId: { userId: userC.id, projectId: project2.id } },
    update: { role: 'MEMBER', status: 'ACCEPTED' },
    create: { userId: userC.id, projectId: project2.id, role: 'MEMBER', status: 'ACCEPTED' }
  });

  const tokenC_Outsider = jwt.sign({ userId: userC.id, email: userC.email }, JWT_SECRET, { expiresIn: '1h' });

  // 4. Chuẩn bị ngày test (2026-11-20)
  const testDateStr = '2026-11-20';
  const testDateObj = new Date(`${testDateStr}T00:00:00.000Z`);

  // Xóa standups cũ ngày test của sprint này
  await prisma.dailyStandup.deleteMany({
    where: { sprintId: sprint.id, reportDate: testDateObj }
  });

  // Tạo 2 Daily cho userA và userB:
  // userA: blocked = false, mood = 'HAPPY'
  const dailyA = await prisma.dailyStandup.create({
    data: {
      userId: userA.id,
      sprintId: sprint.id,
      projectId: project1.id,
      reportDate: testDateObj,
      mood: 'HAPPY',
      yesterdayWork: 'Hoàn thành module authentication JWT',
      todayPlan: 'Viết unit test cho auth controller',
      blockers: 'Không có vướng mắc nào',
      blocked: false,
      blockerNote: null,
      blockerStatus: null
    }
  });

  // userB: blocked = true, mood = 'TIRED', lý do = 'Kẹt cấu hình CORS trên server dev'
  const dailyB = await prisma.dailyStandup.create({
    data: {
      userId: userB.id,
      sprintId: sprint.id,
      projectId: project1.id,
      reportDate: testDateObj,
      mood: 'TIRED',
      yesterdayWork: 'Tích hợp socket real-time',
      todayPlan: 'Fix bug kết nối WebSocket',
      blockers: 'Bị lỗi CORS 403',
      blocked: true,
      blockerNote: 'Kẹt cấu hình CORS trên server dev',
      blockerStatus: 'OPEN'
    }
  });

  console.log(`✅ Đã tạo 2 Daily records test ngày ${testDateStr}:`);
  console.log(`   - Member A: ${userA.fullName} (Mood: HAPPY, Blocked: false)`);
  console.log(`   - Member B: ${userB.fullName} (Mood: TIRED, Blocked: true)`);

  // ========================================================
  // TEST CASE 1: AC1 PASS - LẤY DAILY DIGEST ĐẦY ĐỦ 1 TRANG & SẮP XẾP TÊN
  // ========================================================
  console.log('\n--- TEST CASE 1: AC1 Pass - Lấy danh sách Daily Digest đầy đủ thông tin ---');
  const digestRes = await fetch(`${BASE_URL}/projects/${project1.id}/sprints/${sprint.id}/daily-digest?date=${testDateStr}`, {
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });

  console.log(`Status gọi GET /daily-digest: ${digestRes.status}`);
  const digestData = await digestRes.json();

  if (digestRes.status !== 200) {
    console.error('❌ Lỗi lấy Daily Digest:', digestData);
    process.exit(1);
  }

  console.log('Summary nhận được:', digestData.summary);
  console.log(`Số lượng items: ${digestData.items.length}`);

  if (digestData.summary.submittedCount !== 2 || digestData.summary.blockedCount !== 1) {
    console.error(`❌ Vi phạm AC1 Summary: submittedCount=${digestData.summary.submittedCount}, blockedCount=${digestData.summary.blockedCount}`);
    process.exit(1);
  }

  // Kiểm tra sắp xếp theo tên ASC (An Nguyễn đứng trước Bình Trần)
  const names = digestData.items.map(i => i.user.fullName);
  console.log('Thứ tự tên thành viên:', names);

  if (names[0] !== userA.fullName || names[1] !== userB.fullName) {
    console.error('❌ Vi phạm AC1: Thứ tự tên thành viên chưa sắp xếp đúng user.fullName ASC');
    process.exit(1);
  }

  // Kiểm tra các trường dữ liệu bắt buộc của AC1
  const firstItem = digestData.items[0];
  if (!firstItem.mood || !firstItem.yesterdayWork || !firstItem.todayPlan || !firstItem.blockers) {
    console.error('❌ Vi phạm AC1: Thiếu các trường bắt buộc trong item Daily Digest');
    process.exit(1);
  }

  console.log(`✅ TEST CASE 1 PASSED: Daily Digest trả về đầy đủ Tên, Mood, 3 câu trả lời, đúng Summary và sắp xếp tên ASC.`);

  // ========================================================
  // TEST CASE 2: AC2 PASS - BỘ LỌC CHỈ XEM NGƯỜI ĐANG KẸT (onlyBlocked=true)
  // ========================================================
  console.log('\n--- TEST CASE 2: AC2 Pass - Bộ lọc onlyBlocked=true ---');
  const blockedOnlyRes = await fetch(`${BASE_URL}/projects/${project1.id}/sprints/${sprint.id}/daily-digest?date=${testDateStr}&onlyBlocked=true`, {
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });

  console.log(`Status gọi GET /daily-digest?onlyBlocked=true: ${blockedOnlyRes.status}`);
  const blockedOnlyData = await blockedOnlyRes.json();

  console.log(`Số lượng items khi lọc onlyBlocked=true: ${blockedOnlyData.items.length}`);

  if (blockedOnlyData.items.length !== 1) {
    console.error(`❌ Vi phạm AC2: Mong đợi 1 item kẹt, nhưng nhận được ${blockedOnlyData.items.length}`);
    process.exit(1);
  }

  const blockedItem = blockedOnlyData.items[0];
  if (!blockedItem.blocked || blockedItem.userId !== userB.id) {
    console.error('❌ Vi phạm AC2: Item trả về không phải là người đang kẹt');
    process.exit(1);
  }

  console.log(`Item đang kẹt nhận được: ${blockedItem.user.fullName} - Lý do: "${blockedItem.blockerNote}"`);
  console.log('✅ TEST CASE 2 PASSED: Bộ lọc onlyBlocked=true chỉ hiển thị đúng thành viên đang kẹt.');

  // ========================================================
  // TEST CASE 3: DOD PERMISSION PASS - CHẶN NGƯỜI NGOÀI DỰ ÁN (403 FORBIDDEN)
  // ========================================================
  console.log('\n--- TEST CASE 3: DoD Permission Pass - Chặn người không thuộc dự án (403 Forbidden) ---');
  const outsiderRes = await fetch(`${BASE_URL}/projects/${project1.id}/sprints/${sprint.id}/daily-digest?date=${testDateStr}`, {
    headers: { 'Authorization': `Bearer ${tokenC_Outsider}` }
  });

  console.log(`Status gọi bởi User ngoài dự án: ${outsiderRes.status}`);
  const outsiderData = await outsiderRes.json();
  console.log('Thông báo lỗi nhận được:', outsiderData.error);

  if (outsiderRes.status !== 403) {
    console.error(`❌ Vi phạm DoD Security: User ngoài dự án không bị chặn 403! Status: ${outsiderRes.status}`);
    process.exit(1);
  }

  if (outsiderData.error !== "Bạn không có quyền xem báo cáo Daily của dự án này") {
    console.error(`❌ Vi phạm DoD Security: Thông báo lỗi không khớp yêu cầu: "${outsiderData.error}"`);
    process.exit(1);
  }

  console.log('✅ TEST CASE 3 PASSED: Chặn truy cập trái phép thành công với mã 403 Forbidden chuẩn xác.');

  console.log('\n🎉 TẤT CẢ 3 BÀI TEST TÍNH NĂNG "BẢN TIN HÔM NAY" (DAILY DIGEST) ĐÃ PASS 100%!\n');
}

runDailyDigestTests()
  .catch(err => {
    console.error('Lỗi khi chạy test:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
