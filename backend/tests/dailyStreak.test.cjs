/**
 * Unit & Integration Test: Sprint Daily Streak
 * Kiểm chứng:
 * 1. Helper getPreviousWorkingDay (đếm ngày liên tiếp vs tùy chọn bỏ qua cuối tuần)
 * 2. Thuật toán calculateDailyStreak:
 *    - Trường hợp 1: Hôm nay đã gửi -> cộng dồn về quá khứ, dừng khi gặp ngày trống
 *    - Trường hợp 2: Hôm nay chưa gửi, hôm qua có gửi -> vẫn giữ chuỗi
 *    - Trường hợp 3: Bỏ lỡ cả hôm nay và hôm qua -> reset về 0
 *    - Phạm vi lọc theo [sprint.start_date, sprint.end_date] & tính longestStreakInSprint
 * 3. Backend APIs:
 *    - GET /api/users/me/daily-streak (có truyền sprintId & tự lấy Active Sprint)
 *    - GET /api/user/profile (trả kèm dailyStreak)
 */

const assert = require('assert');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const {
  STREAK_DISCLAIMER,
  getLocalDateString,
  getPreviousWorkingDay,
  calculateDailyStreak
} = require('../src/services/streakService');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const BASE_URL = 'http://localhost:5000/api';

async function runDailyStreakTests() {
  console.log('🧪 Bắt đầu Unit & Integration Test cho tính năng Sprint Daily Streak...');

  // ========================================================
  // TEST 1: HELPER getPreviousWorkingDay (Default vs Skip Weekends)
  // ========================================================
  console.log('\n--- TEST 1: Helper getPreviousWorkingDay ---');
  assert.strictEqual(getPreviousWorkingDay('2026-11-23', false), '2026-11-22', 'Mặc định lùi đúng 1 ngày dương lịch');
  assert.strictEqual(getPreviousWorkingDay('2026-11-23', true), '2026-11-20', 'Khi bật skipWeekends, Thứ 2 lùi về Thứ 6');
  console.log('✅ TEST 1 PASSED: getPreviousWorkingDay hoạt động chính xác cho cả 2 chế độ.');

  // ========================================================
  // TEST 2: THUẬT TOÁN STREAK - TRƯỜNG HỢP 1, 2, 3 & PHẠM VI SPRINT
  // ========================================================
  console.log('\n--- TEST 2: Thuật toán calculateDailyStreak (AC1) ---');

  // Case 1: Hôm nay (2026-11-27) đã gửi, liên tiếp 3 ngày (25, 26, 27), trước đó có chuỗi 4 ngày (18, 19, 20, 21)
  const case1 = calculateDailyStreak({
    reportDates: [
      '2026-11-27', '2026-11-26', '2026-11-25',
      '2026-11-21', '2026-11-20', '2026-11-19', '2026-11-18',
      '2026-11-01' // Ngoài phạm vi sprint -> phải bị loại
    ],
    sprintStartDate: '2026-11-15',
    sprintEndDate: '2026-11-30',
    todayStr: '2026-11-27'
  });
  assert.strictEqual(case1.currentStreak, 3, `Case 1 currentStreak mong đợi 3, nhận ${case1.currentStreak}`);
  assert.strictEqual(case1.longestStreakInSprint, 4, `Case 1 longestStreak mong đợi 4, nhận ${case1.longestStreakInSprint}`);
  assert.strictEqual(case1.hasSubmittedToday, true);
  console.log('   -> Case 1 (Đã gửi hôm nay + chuỗi cũ dài hơn):', case1);

  // Case 2: Hôm nay (2026-11-27) CHƯA gửi, nhưng hôm qua (2026-11-26) và 2026-11-25 có gửi -> giữ chuỗi 2
  const case2 = calculateDailyStreak({
    reportDates: ['2026-11-26', '2026-11-25'],
    sprintStartDate: '2026-11-15',
    sprintEndDate: '2026-11-30',
    todayStr: '2026-11-27'
  });
  assert.strictEqual(case2.currentStreak, 2, `Case 2 currentStreak mong đợi 2, nhận ${case2.currentStreak}`);
  assert.strictEqual(case2.longestStreakInSprint, 2);
  assert.strictEqual(case2.hasSubmittedToday, false);
  console.log('   -> Case 2 (Hôm nay chưa gửi, hôm qua có gửi):', case2);

  // Case 3: Bỏ lỡ cả hôm nay (27) và hôm qua (26) -> Reset về 0
  const case3 = calculateDailyStreak({
    reportDates: ['2026-11-25', '2026-11-24', '2026-11-23'],
    sprintStartDate: '2026-11-15',
    sprintEndDate: '2026-11-30',
    todayStr: '2026-11-27'
  });
  assert.strictEqual(case3.currentStreak, 0, `Case 3 currentStreak mong đợi 0, nhận ${case3.currentStreak}`);
  assert.strictEqual(case3.longestStreakInSprint, 3);
  assert.strictEqual(case3.hasSubmittedToday, false);
  console.log('   -> Case 3 (Bỏ lỡ >= 1 ngày -> reset 0):', case3);

  // Case 4: Kiểm tra chế độ skipWeekends = true (Thứ 2 + Thứ 6 trước đó = chuỗi 2)
  const caseWeekend = calculateDailyStreak({
    reportDates: ['2026-11-23', '2026-11-20'],
    sprintStartDate: '2026-11-15',
    sprintEndDate: '2026-11-30',
    todayStr: '2026-11-23',
    skipWeekends: true
  });
  assert.strictEqual(caseWeekend.currentStreak, 2, 'Khi skipWeekends=true, T6 + T2 tạo thành chuỗi 2');
  console.log('   -> Case 4 (skipWeekends = true):', caseWeekend);

  console.log('✅ TEST 2 PASSED: Thuật toán tính Streak chuẩn xác cho mọi trường hợp.');

  // ========================================================
  // TEST 3: INTEGRATION TEST API /api/users/me/daily-streak & /api/user/profile
  // ========================================================
  console.log('\n--- TEST 3: Integration Test API GET /api/users/me/daily-streak & Profile ---');

  const sprint = await prisma.sprint.findFirst({
    where: { status: 'ACTIVE' },
    include: { project: true }
  });
  if (!sprint) {
    console.error('❌ Không tìm thấy Active Sprint để test.');
    process.exit(1);
  }

  let testUser = await prisma.user.findFirst({ where: { email: 'streak_tester@miniscrum.local' } });
  if (!testUser) {
    testUser = await prisma.user.create({
      data: {
        email: 'streak_tester@miniscrum.local',
        password: 'hashed_password_streak',
        fullName: 'Streak Tester',
        role: 'USER'
      }
    });
  }

  await prisma.projectMember.upsert({
    where: { userId_projectId: { userId: testUser.id, projectId: sprint.projectId } },
    update: { role: 'MEMBER', status: 'ACCEPTED' },
    create: { userId: testUser.id, projectId: sprint.projectId, role: 'MEMBER', status: 'ACCEPTED' }
  });

  // Đảm bảo sprint có startDate <= 4 ngày trước và endDate >= hôm nay để test range
  const todayStr = getLocalDateString();
  const d1 = getPreviousWorkingDay(todayStr, false);
  const d2 = getPreviousWorkingDay(d1, false);
  const old1 = getPreviousWorkingDay(getPreviousWorkingDay(d2, false), false); // cách 1 ngày trống

  const origStart = sprint.startDate;
  const origEnd = sprint.endDate;
  await prisma.sprint.update({
    where: { id: sprint.id },
    data: {
      startDate: new Date(`${getPreviousWorkingDay(old1, false)}T00:00:00.000Z`),
      endDate: new Date(`${todayStr}T23:59:59.000Z`)
    }
  });

  // Dọn standup test cũ của user này
  await prisma.dailyStandup.deleteMany({
    where: { userId: testUser.id, sprintId: sprint.id }
  });

  // Tạo 3 ngày liên tiếp (today, d1, d2) -> currentStreak = 3, longest = 3
  for (const dateStr of [todayStr, d1, d2]) {
    await prisma.dailyStandup.create({
      data: {
        userId: testUser.id,
        sprintId: sprint.id,
        projectId: sprint.projectId,
        reportDate: new Date(`${dateStr}T00:00:00.000Z`),
        yesterdayWork: `Work on ${dateStr}`,
        todayPlan: `Plan on ${dateStr}`,
        blockers: 'Không có'
      }
    });
  }

  const token = jwt.sign({ userId: testUser.id, email: testUser.email, role: 'MEMBER' }, JWT_SECRET, { expiresIn: '1h' });

  // 3a. Gọi GET /api/users/me/daily-streak?sprintId=...
  const resWithSprint = await fetch(`${BASE_URL}/users/me/daily-streak?sprintId=${sprint.id}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  assert.strictEqual(resWithSprint.status, 200, `Mong đợi 200 OK, nhận ${resWithSprint.status}`);
  const dataWithSprint = await resWithSprint.json();
  console.log('Response GET /api/users/me/daily-streak:', dataWithSprint);

  assert.strictEqual(dataWithSprint.sprintId, sprint.id);
  assert.strictEqual(dataWithSprint.currentStreak, 3);
  assert.strictEqual(dataWithSprint.longestStreakInSprint, 3);
  assert.strictEqual(dataWithSprint.hasSubmittedToday, true);
  assert.strictEqual(dataWithSprint.disclaimer, STREAK_DISCLAIMER);

  // 3b. Gọi GET /api/users/me/daily-streak KHÔNG truyền sprintId (tự tìm Active Sprint)
  const resAuto = await fetch(`${BASE_URL}/users/me/daily-streak`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  assert.strictEqual(resAuto.status, 200);
  const dataAuto = await resAuto.json();
  assert.ok(dataAuto.sprintId, 'Phải tự resolve được Active Sprint');
  assert.strictEqual(dataAuto.disclaimer, STREAK_DISCLAIMER);

  // 3c. Gọi GET /api/user/profile kiểm tra có đính kèm dailyStreak
  const resProfile = await fetch(`${BASE_URL}/user/profile`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  assert.strictEqual(resProfile.status, 200);
  const dataProfile = await resProfile.json();
  assert.ok(dataProfile.dailyStreak, 'Profile API phải trả kèm dailyStreak');
  assert.strictEqual(dataProfile.dailyStreak.disclaimer, STREAK_DISCLAIMER);

  // Khôi phục dữ liệu sprint & dọn bản ghi test
  await prisma.dailyStandup.deleteMany({
    where: { userId: testUser.id, sprintId: sprint.id }
  });
  await prisma.sprint.update({
    where: { id: sprint.id },
    data: { startDate: origStart, endDate: origEnd }
  });

  console.log('✅ TEST 3 PASSED: API /api/users/me/daily-streak và /api/user/profile hoạt động chuẩn xác.');
  console.log('\n🎉 TẤT CẢ BÀI TEST SPRINT DAILY STREAK ĐÃ PASS 100%!\n');
}

runDailyStreakTests()
  .catch(err => {
    console.error('❌ Test thất bại:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
