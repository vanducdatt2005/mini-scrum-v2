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
  console.log('🧪 Bắt đầu Integration Test cho tính năng Bật cờ "Đang kẹt" (Blocked) và lý do ngắn...');

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

  // Dọn dẹp bản ghi hôm nay của testUser nếu có
  await prisma.dailyStandup.deleteMany({
    where: {
      userId: testUser.id,
      sprintId: sprint.id,
      reportDate: todayDateObj
    }
  });

  // ========================================================
  // TEST CASE 2: AC2 PASS (TẠO MỚI) - BLOCKED=TRUE NHƯNG BLOCKER_NOTE RỖNG
  // ========================================================
  console.log('\n--- TEST CASE 2: AC2 Pass (Tạo mới) - blocked: true nhưng thiếu blockerNote -> 400 Bad Request ---');

  const emptyNoteRes = await fetch(`${BASE_URL}/sprints/${sprint.id}/daily-standups`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      yesterday_work: 'Đã hoàn thành thiết kế DB',
      today_plan: 'Tiếp tục làm backend',
      blockers: 'Gặp lỗi',
      blocked: true,
      blocker_note: '   ' // Khoảng trắng
    })
  });

  console.log(`Status gọi POST khi thiếu blockerNote: ${emptyNoteRes.status}`);
  const emptyNoteData = await emptyNoteRes.json();
  console.log(`Lỗi nhận được: "${emptyNoteData.error}"`);

  if (emptyNoteRes.status !== 400 || !emptyNoteData.details?.blocker_note) {
    console.error(`❌ Vi phạm: Phải trả về 400 Bad Request kèm chi tiết lỗi blocker_note, nhận được: ${emptyNoteRes.status}`);
    process.exit(1);
  }

  const countAfterFail = await prisma.dailyStandup.count({
    where: { userId: testUser.id, sprintId: sprint.id, reportDate: todayDateObj }
  });
  if (countAfterFail !== 0) {
    console.error('❌ Vi phạm: Đã lưu bản ghi rác vào DB khi validation thất bại!');
    process.exit(1);
  }
  console.log('✅ TEST CASE 2 PASSED: Validation chặn chặt chẽ khi bật blocked nhưng để trống lý do.');

  // ========================================================
  // TEST CASE 1: AC1 PASS - GỬI VỚI BLOCKED=TRUE VÀ BLOCKER_NOTE HỢP LỆ
  // ========================================================
  console.log('\n--- TEST CASE 1: AC1 Pass - Gửi Daily với blocked: true và blockerNote hợp lệ -> 201 Created ---');

  const createRes = await fetch(`${BASE_URL}/sprints/${sprint.id}/daily-standups`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      yesterday_work: 'Hoàn thành tích hợp giao diện',
      today_plan: 'Kiểm thử e2e với team',
      blockers: 'Cần hỗ trợ gấp',
      blocked: true,
      blocker_note: 'Chờ API từ team Backend'
    })
  });

  console.log(`Status tạo Daily Standup có cờ blocked: ${createRes.status}`);
  if (createRes.status !== 201) {
    const errText = await createRes.text();
    console.error(`❌ Tạo thất bại: Status ${createRes.status} - ${errText}`);
    process.exit(1);
  }

  const createdRecord = await createRes.json();
  console.log(`Bản ghi tạo thành công (ID: ${createdRecord.id}):`);
  console.log(`   - blocked:     ${createdRecord.blocked}`);
  console.log(`   - blockerNote: "${createdRecord.blockerNote}"`);

  const dbRecord = await prisma.dailyStandup.findUnique({ where: { id: createdRecord.id } });
  if (dbRecord.blocked !== true || dbRecord.blockerNote !== 'Chờ API từ team Backend') {
    console.error('❌ Vi phạm: Dữ liệu lưu trong DB không khớp với đầu vào!');
    process.exit(1);
  }
  console.log('✅ TEST CASE 1 PASSED: Lưu thành công blocked=true và đúng lý do vào Database.');

  // ========================================================
  // TEST CASE 3: AC2 PASS (CHỈNH SỬA) - CHUYỂN BLOCKED=TRUE NHƯNG KHÔNG CÓ NOTE
  // ========================================================
  console.log('\n--- TEST CASE 3: AC2 Pass (Chỉnh sửa) - Chuyển sang blocked: true nhưng không truyền note -> 400 Bad Request ---');

  // Đổi tạm về false
  await prisma.dailyStandup.update({
    where: { id: createdRecord.id },
    data: { blocked: false, blockerNote: null }
  });

  // Giờ gọi PUT chuyển sang blocked = true nhưng blocker_note = ''
  const editFailRes = await fetch(`${BASE_URL}/sprints/${sprint.id}/daily-standups/${createdRecord.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      yesterday_work: 'Hoàn thành tích hợp giao diện',
      today_plan: 'Kiểm thử e2e với team',
      blockers: 'Cần hỗ trợ',
      blocked: true,
      blocker_note: ''
    })
  });

  console.log(`Status gọi PUT khi bật blocked mà không có note: ${editFailRes.status}`);
  const editFailData = await editFailRes.json();
  console.log(`Lỗi nhận được: "${editFailData.error}"`);

  if (editFailRes.status !== 400 || !editFailData.details?.blocker_note) {
    console.error(`❌ Vi phạm: Cập nhật phải bị từ chối 400 khi bật blocked mà không có note! Nhận được: ${editFailRes.status}`);
    process.exit(1);
  }
  console.log('✅ TEST CASE 3 PASSED: Chặn cập nhật khi chuyển sang blocked: true mà thiếu lý do.');

  // ========================================================
  // TEST CASE 4: RESET NOTE - SỬA DAILY TỪ BLOCKED=TRUE VỀ BLOCKED=FALSE -> NOTE = NULL
  // ========================================================
  console.log('\n--- TEST CASE 4: Reset Note - Sửa Daily từ blocked: true về blocked: false -> note tự động = null ---');

  // Set lại cờ true trước
  await prisma.dailyStandup.update({
    where: { id: createdRecord.id },
    data: { blocked: true, blockerNote: 'Lý do cũ còn lưu' }
  });

  // Gọi PUT với blocked: false
  const resetRes = await fetch(`${BASE_URL}/sprints/${sprint.id}/daily-standups/${createdRecord.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      yesterday_work: 'Đã giải quyết xong vướng mắc',
      today_plan: 'Tiếp tục task tiếp theo',
      blockers: 'Không có',
      blocked: false,
      blocker_note: 'Người dùng quên xóa note cũ' // Server phải tự reset về null theo Rule 3
    })
  });

  console.log(`Status gọi PUT khi tắt cờ blocked: ${resetRes.status}`);
  if (resetRes.status !== 200) {
    const errText = await resetRes.text();
    console.error(`❌ Cập nhật thất bại: Status ${resetRes.status} - ${errText}`);
    process.exit(1);
  }

  const resetRecord = await resetRes.json();
  const dbResetRecord = await prisma.dailyStandup.findUnique({ where: { id: createdRecord.id } });

  console.log(`DB sau khi tắt blocked: blocked = ${dbResetRecord.blocked}, blockerNote = ${dbResetRecord.blockerNote}`);

  if (dbResetRecord.blocked !== false || dbResetRecord.blockerNote !== null) {
    console.error('❌ Vi phạm: Khi blocked = false, blockerNote phải được reset về null!');
    process.exit(1);
  }
  console.log('✅ TEST CASE 4 PASSED: Reset dữ liệu sạch sẽ, blockerNote tự động gán null khi blocked = false.');

  // ========================================================
  // TEST CASE 5: SẮP XẾP ƯU TIÊN NGƯỜI ĐANG KẸT LÊN ĐẦU DANH SÁCH
  // ========================================================
  console.log('\n--- TEST CASE 5: Ưu tiên người có blocked: true lên đầu trong GET /daily-standups ---');

  // Đặt lại bản ghi của testUser là blocked = true
  await prisma.dailyStandup.update({
    where: { id: createdRecord.id },
    data: { blocked: true, blockerNote: 'Kẹt deploy môi trường' }
  });

  const getListRes = await fetch(`${BASE_URL}/sprints/${sprint.id}/daily-standups`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const listData = await getListRes.json();
  console.log(`Tổng số bản ghi standup lấy được: ${listData.total}`);

  if (listData.standups.length > 0) {
    const firstItem = listData.standups[0];
    console.log(`Bản ghi đầu tiên trong danh sách: user = "${firstItem.user?.fullName || firstItem.user?.email}", blocked = ${firstItem.blocked}, note = "${firstItem.blockerNote}"`);
    if (firstItem.blocked !== true) {
      console.error('❌ Vi phạm: Người có cờ blocked = true phải được ưu tiên lên đầu danh sách!');
      process.exit(1);
    }
  }
  console.log('✅ TEST CASE 5 PASSED: Sắp xếp danh sách ưu tiên người đang kẹt lên đầu thành công.');

  console.log('\n🎉 TẤT CẢ 5 BÀI TEST TÍNH NĂNG "ĐANG KẸT" (BLOCKED & BLOCKER NOTE) ĐÃ PASS 100%!');
  await prisma.$disconnect();
}

runTests().catch(err => {
  console.error('❌ Lỗi không xác định khi test:', err);
  process.exit(1);
});
