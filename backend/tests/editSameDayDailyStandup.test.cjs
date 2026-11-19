const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const prisma = new PrismaClient();

const BASE_URL = 'http://localhost:5000/api';
const JWT_SECRET = process.env.JWT_SECRET || 'mini_scrum_secret';

function getLocalDateString(d = new Date(), timeZone = 'Asia/Ho_Chi_Minh') {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone }).format(d);
  } catch (e) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

async function runTests() {
  console.log('🧪 Bắt đầu Integration Test cho tính năng Chỉnh sửa Daily đã gửi trong cùng ngày (Edit Same-Day)...');

  // 1. Lấy thông tin user và active sprint
  const sprint = await prisma.sprint.findFirst({
    where: { status: 'ACTIVE' },
    include: { project: true }
  });

  if (!sprint) {
    console.error('❌ Không tìm thấy Active Sprint để test.');
    process.exit(1);
  }

  // Tìm một project member
  const member = await prisma.projectMember.findFirst({
    where: { projectId: sprint.projectId, status: 'ACCEPTED' },
    include: { user: true }
  });

  const testUser = member?.user || await prisma.user.findFirst();
  console.log(`👤 Sử dụng User: ${testUser.fullName || testUser.email} (${testUser.id})`);
  console.log(`🏃 Active Sprint ID: ${sprint.id} ("${sprint.name}")`);

  const token = jwt.sign(
    { userId: testUser.id, email: testUser.email, role: testUser.role || 'MEMBER' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const todayStr = getLocalDateString(new Date(), 'Asia/Ho_Chi_Minh');
  const todayDateObj = new Date(`${todayStr}T00:00:00.000Z`);

  // Tính ngày hôm qua
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = getLocalDateString(yesterdayDate, 'Asia/Ho_Chi_Minh');
  const yesterdayDateObj = new Date(`${yesterdayStr}T00:00:00.000Z`);

  console.log(`📅 Ngày hôm nay: ${todayStr} | Ngày hôm qua: ${yesterdayStr}`);

  // Dọn dẹp bản ghi test hôm nay và hôm qua nếu có để đảm bảo test chạy sạch sẽ
  await prisma.dailyStandup.deleteMany({
    where: {
      userId: testUser.id,
      sprintId: sprint.id,
      reportDate: { in: [todayDateObj, yesterdayDateObj] }
    }
  });

  // ========================================================
  // TEST CASE 1: UPDATE CÙNG NGÀY THÀNH CÔNG (AC1)
  // ========================================================
  console.log('\n--- TEST CASE 1: Cập nhật Daily cùng ngày thành công (AC1) ---');
  
  // 1.1 Tạo Daily ban đầu hôm nay
  const createRes = await fetch(`${BASE_URL}/sprints/${sprint.id}/daily-standups`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      yesterday_work: 'Nội dung ban đầu: Làm tính năng A',
      today_plan: 'Nội dung ban đầu: Làm tính năng B',
      blockers: 'Không có'
    })
  });

  if (createRes.status !== 201) {
    const errText = await createRes.text();
    console.error(`❌ Tạo Daily thất bại: Status ${createRes.status} - ${errText}`);
    process.exit(1);
  }

  const initialRecord = await createRes.json();
  const initialId = initialRecord.id;
  const initialCreatedAt = new Date(initialRecord.createdAt).getTime();
  console.log(`✅ Tạo Daily ban đầu thành công (ID: ${initialId})`);

  // Đợi 1.5 giây để đảm bảo updatedAt > createdAt
  await new Promise(r => setTimeout(r, 1500));

  // 1.2 Gọi API PUT cập nhật lại nội dung cùng ngày
  const updateRes = await fetch(`${BASE_URL}/sprints/${sprint.id}/daily-standups/${initialId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      yesterday_work: 'Nội dung ĐÃ SỬA: Đã hoàn tất và kiểm thử tính năng A',
      today_plan: 'Nội dung ĐÃ SỬA: Bắt đầu triển khai tính năng C',
      blockers: 'Gặp vướng mắc nhẹ với cache'
    })
  });

  console.log(`Status gọi PUT /daily-standups/${initialId}: ${updateRes.status}`);
  if (updateRes.status !== 200) {
    const errText = await updateRes.text();
    console.error(`❌ Sửa Daily thất bại: Status ${updateRes.status} - ${errText}`);
    process.exit(1);
  }

  const updatedRecord = await updateRes.json();
  const updatedCreatedAt = new Date(updatedRecord.createdAt).getTime();
  const updatedUpdatedAt = new Date(updatedRecord.updatedAt).getTime();

  // Kiểm tra điều kiện DB
  const totalCount = await prisma.dailyStandup.count({
    where: {
      userId: testUser.id,
      sprintId: sprint.id,
      reportDate: todayDateObj
    }
  });

  if (totalCount !== 1) {
    console.error(`❌ Vi phạm: Sinh thêm bản ghi rác! Tổng số bản ghi hôm nay = ${totalCount}`);
    process.exit(1);
  }
  console.log(`✅ Kiểm tra DB: Chỉ có đúng 1 bản ghi (totalCount = ${totalCount})`);

  if (updatedCreatedAt !== initialCreatedAt) {
    console.error(`❌ Vi phạm: created_at bị thay đổi! (${initialCreatedAt} !== ${updatedCreatedAt})`);
    process.exit(1);
  }
  console.log(`✅ Kiểm tra created_at: Giữ nguyên không đổi (${new Date(updatedCreatedAt).toISOString()})`);

  if (updatedUpdatedAt <= updatedCreatedAt) {
    console.error(`❌ Vi phạm: updated_at (${updatedUpdatedAt}) không lớn hơn created_at (${updatedCreatedAt})`);
    process.exit(1);
  }
  console.log(`✅ Kiểm tra updated_at: Lớn hơn created_at (${new Date(updatedUpdatedAt).toISOString()} > ${new Date(updatedCreatedAt).toISOString()})`);

  if (updatedRecord.yesterdayWork !== 'Nội dung ĐÃ SỬA: Đã hoàn tất và kiểm thử tính năng A' ||
      updatedRecord.todayPlan !== 'Nội dung ĐÃ SỬA: Bắt đầu triển khai tính năng C' ||
      updatedRecord.blockers !== 'Gặp vướng mắc nhẹ với cache') {
    console.error('❌ Vi phạm: Nội dung 3 ô chưa được ghi đè chính xác!');
    process.exit(1);
  }
  console.log('✅ TEST CASE 1 PASSED: Cập nhật thành công, 3 ô ghi đè, createdAt giữ nguyên, updatedAt cập nhật chuẩn xác.');

  // ========================================================
  // TEST CASE 2: SANG NGÀY MỚI MỞ FORM TRẢ VỀ NULL (AC2)
  // ========================================================
  console.log('\n--- TEST CASE 2: Sang ngày mới mở form trả về null (AC2) ---');

  // Giả lập: Xóa bản ghi hôm nay, chỉ tạo bản ghi có report_date là ngày hôm qua
  await prisma.dailyStandup.deleteMany({
    where: {
      userId: testUser.id,
      sprintId: sprint.id,
      reportDate: todayDateObj
    }
  });

  const yesterdayStandup = await prisma.dailyStandup.create({
    data: {
      userId: testUser.id,
      sprintId: sprint.id,
      reportDate: yesterdayDateObj,
      yesterdayWork: 'Hôm qua làm task cũ',
      todayPlan: 'Hôm qua lên plan cũ',
      blockers: 'Không có',
      yesterday: 'Hôm qua làm task cũ',
      today: 'Hôm qua lên plan cũ',
      projectId: sprint.projectId
    }
  });
  console.log(`Đã tạo bản ghi giả lập ngày hôm qua (ID: ${yesterdayStandup.id}, report_date: ${yesterdayStr})`);

  // Gọi API GET /me/today
  const getTodayRes = await fetch(`${BASE_URL}/sprints/${sprint.id}/daily-standups/me/today`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  const getTodayData = await getTodayRes.json();
  console.log(`Kết quả GET /me/today: submitted = ${getTodayData.submitted}, standup = ${getTodayData.standup}`);

  if (getTodayData.submitted !== false || getTodayData.standup !== null) {
    console.error('❌ Lỗi: Khi sang ngày mới, GET /me/today phải trả về submitted = false và standup = null');
    process.exit(1);
  }
  console.log('✅ TEST CASE 2 PASSED: Đã sang ngày mới, GET /me/today trả về null, form sẵn sàng hiển thị ô trống.');

  // ========================================================
  // TEST CASE 3: CHẶN SỬA DAILY CỦA NGÀY CŨ (403 FORBIDDEN)
  // ========================================================
  console.log('\n--- TEST CASE 3: Chặn sửa Daily của ngày cũ (403 Forbidden) ---');

  // Cố tình gọi API PUT sửa bản ghi của ngày hôm qua
  const forbiddenRes = await fetch(`${BASE_URL}/sprints/${sprint.id}/daily-standups/${yesterdayStandup.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      yesterday_work: 'Cố tình sửa ngày hôm qua',
      today_plan: 'Cố tình sửa ngày hôm qua',
      blockers: 'Không có'
    })
  });

  console.log(`Status gọi PUT sửa ngày hôm qua: ${forbiddenRes.status}`);
  const forbiddenData = await forbiddenRes.json();
  console.log(`Thông báo lỗi từ API: "${forbiddenData.error}" (code: ${forbiddenData.code})`);

  if (forbiddenRes.status !== 403 || forbiddenData.code !== 'FORBIDDEN_NOT_SAME_DAY') {
    console.error(`❌ Lỗi: Không chặn sửa ngày cũ! Status mong đợi: 403, nhận được: ${forbiddenRes.status}`);
    process.exit(1);
  }
  console.log('✅ TEST CASE 3 PASSED: Chặn sửa Daily của ngày cũ, trả về 403 Forbidden chuẩn xác.');

  // ========================================================
  // TEST CASE 4: VALIDATION 400 KHI CẬP NHẬT THIẾU TRƯỜNG
  // ========================================================
  console.log('\n--- TEST CASE 4: Validation 400 khi cập nhật thiếu trường ---');

  // Tạo lại bản ghi hôm nay
  const freshToday = await prisma.dailyStandup.create({
    data: {
      userId: testUser.id,
      sprintId: sprint.id,
      reportDate: todayDateObj,
      yesterdayWork: 'Hôm qua làm task X',
      todayPlan: 'Hôm nay làm task Y',
      blockers: 'Không có',
      projectId: sprint.projectId
    }
  });

  const emptyUpdateRes = await fetch(`${BASE_URL}/sprints/${sprint.id}/daily-standups/${freshToday.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      yesterday_work: '   ',
      today_plan: '',
      blockers: 'Không có'
    })
  });

  console.log(`Status gọi PUT với trường rỗng: ${emptyUpdateRes.status}`);
  if (emptyUpdateRes.status !== 400) {
    console.error(`❌ Lỗi: Phải trả về 400 khi để trống trường, nhận được ${emptyUpdateRes.status}`);
    process.exit(1);
  }
  console.log('✅ TEST CASE 4 PASSED: Validation chặn chặt chẽ khi cập nhật thiếu trường.');

  console.log('\n🎉 TẤT CẢ 4 BÀI TEST CHỈNH SỬA DAILY CÙNG NGÀY ĐÃ PASS 100% (200, 403, 400, NULL CHECK)!');
  await prisma.$disconnect();
}

runTests().catch(err => {
  console.error('❌ Lỗi không xác định khi test:', err);
  process.exit(1);
});

