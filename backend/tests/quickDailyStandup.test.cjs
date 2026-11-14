const { PrismaClient } = require('../node_modules/@prisma/client');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:5000/api';
const JWT_SECRET = process.env.JWT_SECRET || 'mini_scrum_secret';

function createToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role || 'MEMBER' },
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
  console.log('🧪 Bắt đầu Integration Test cho tính năng Quick Daily Standup (3 Fields)...\n');

  try {
    // 1. Chuẩn bị User và Sprint đang ACTIVE
    const user = await prisma.user.findFirst();
    if (!user) throw new Error("Không có user trong database");

    console.log(`👤 Sử dụng User: ${user.fullName || user.email} (${user.id})`);
    const token = createToken(user);

    // Tìm hoặc kích hoạt 1 sprint ACTIVE của project mà user tham gia
    let project = await prisma.project.findFirst({
      where: {
        members: { some: { userId: user.id, status: 'ACCEPTED' } }
      },
      include: {
        sprints: true
      }
    });

    if (!project) {
      project = await prisma.project.findFirst({ include: { sprints: true } });
      await prisma.projectMember.upsert({
        where: { userId_projectId: { userId: user.id, projectId: project.id } },
        update: { status: 'ACCEPTED' },
        create: { userId: user.id, projectId: project.id, status: 'ACCEPTED', role: 'MEMBER' }
      });
    }

    let activeSprint = project.sprints.find(s => s.status === 'ACTIVE');
    if (!activeSprint) {
      if (project.sprints.length > 0) {
        activeSprint = await prisma.sprint.update({
          where: { id: project.sprints[0].id },
          data: { status: 'ACTIVE' }
        });
      } else {
        activeSprint = await prisma.sprint.create({
          data: {
            name: "Sprint Test Daily",
            status: "ACTIVE",
            projectId: project.id
          }
        });
      }
    }

    console.log(`🏃 Active Sprint ID: ${activeSprint.id} ("${activeSprint.name}")`);

    // Dọn dẹp bản ghi standup test của hôm nay cho user này (nếu có từ trước) để test có kết quả thuần túy
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    const todayDate = new Date(`${todayStr}T00:00:00.000Z`);

    await prisma.dailyStandup.deleteMany({
      where: {
        userId: user.id,
        sprintId: activeSprint.id,
        reportDate: todayDate
      }
    });

    // ------------------------------------------------------------
    // TEST 1: Thiếu 1 trong 3 ô -> Báo lỗi 400 Bad Request, DB không có bản ghi mới
    // ------------------------------------------------------------
    console.log('\n--- TEST 1: Validation 400 Bad Request khi thiếu trường ---');

    // Case 1a: Thiếu yesterday_work
    const resMissingYesterday = await apiRequest(
      'POST',
      `${BASE_URL}/sprints/${activeSprint.id}/daily-standups`,
      { yesterday_work: '   ', today_plan: 'Làm task B', blockers: 'Không có' },
      token
    );
    console.log(`Kiểm tra thiếu yesterday_work: Status = ${resMissingYesterday.status}`);
    if (resMissingYesterday.status !== 400) {
      throw new Error(`Kỳ vọng 400 nhưng nhận ${resMissingYesterday.status}`);
    }
    if (!resMissingYesterday.data.missingFields.includes('yesterday_work')) {
      throw new Error(`Kỳ vọng missingFields chứa yesterday_work: ${JSON.stringify(resMissingYesterday.data)}`);
    }

    // Case 1b: Thiếu today_plan
    const resMissingToday = await apiRequest(
      'POST',
      `${BASE_URL}/sprints/${activeSprint.id}/daily-standups`,
      { yesterday_work: 'Xong task A', today_plan: '', blockers: 'Không có' },
      token
    );
    console.log(`Kiểm tra thiếu today_plan: Status = ${resMissingToday.status}`);
    if (resMissingToday.status !== 400) {
      throw new Error(`Kỳ vọng 400 nhưng nhận ${resMissingToday.status}`);
    }

    // Case 1c: Thiếu blockers
    const resMissingBlockers = await apiRequest(
      'POST',
      `${BASE_URL}/sprints/${activeSprint.id}/daily-standups`,
      { yesterday_work: 'Xong task A', today_plan: 'Làm task B', blockers: '   ' },
      token
    );
    console.log(`Kiểm tra thiếu blockers: Status = ${resMissingBlockers.status}`);
    if (resMissingBlockers.status !== 400) {
      throw new Error(`Kỳ vọng 400 nhưng nhận ${resMissingBlockers.status}`);
    }

    // Đảm bảo không có bản ghi rác nào được lưu vào DB
    const countAfterInvalid = await prisma.dailyStandup.count({
      where: { userId: user.id, sprintId: activeSprint.id, reportDate: todayDate }
    });
    if (countAfterInvalid !== 0) {
      throw new Error(`DB bị ghi bản ghi rác: count = ${countAfterInvalid}`);
    }
    console.log('✅ TEST 1 PASSED: Validation chặn chặt chẽ cả 3 trường và không lưu bản ghi rác vào DB.');

    // ------------------------------------------------------------
    // TEST 2: Gửi đủ 3 ô hợp lệ -> Lưu thành công (201 Created)
    // ------------------------------------------------------------
    console.log('\n--- TEST 2: Gửi đủ 3 ô hợp lệ -> 201 Created ---');
    const validData = {
      yesterday_work: "Hoàn thành thiết kế REST API và kiểm thử WebSocket",
      today_plan: "Xây dựng Quick Daily Standup Form trên Frontend",
      blockers: "Không có"
    };

    const resValid = await apiRequest(
      'POST',
      `${BASE_URL}/sprints/${activeSprint.id}/daily-standups`,
      validData,
      token
    );

    console.log(`Status tạo Daily Standup: ${resValid.status}`);
    if (resValid.status !== 201) {
      throw new Error(`Tạo Daily Standup thất bại: ${JSON.stringify(resValid.data)}`);
    }

    const createdStandup = resValid.data;
    console.log(`✅ Bản ghi tạo thành công (ID: ${createdStandup.id}):`);
    console.log(`   - Yesterday: ${createdStandup.yesterdayWork}`);
    console.log(`   - Today:     ${createdStandup.todayPlan}`);
    console.log(`   - Blockers:  ${createdStandup.blockers}`);
    console.log(`   - Date:      ${createdStandup.reportDate}`);

    if (createdStandup.yesterdayWork !== validData.yesterday_work || createdStandup.todayPlan !== validData.today_plan) {
      throw new Error("Dữ liệu lưu không khớp với dữ liệu gửi lên!");
    }
    console.log('✅ TEST 2 PASSED: Gửi 3 trường thành công và lưu chính xác vào Database.');

    // ------------------------------------------------------------
    // TEST 3: Cùng userId gửi lần thứ 2 trong cùng ngày -> Chặn bởi Unique Constraint (409 Conflict)
    // ------------------------------------------------------------
    console.log('\n--- TEST 3: Cùng user gửi lần 2 trong cùng ngày -> 409 Conflict ---');
    const duplicateData = {
      yesterday_work: "Nội dung gửi lần 2 cố tình",
      today_plan: "Kế hoạch gửi lần 2",
      blockers: "Không có"
    };

    const resDuplicate = await apiRequest(
      'POST',
      `${BASE_URL}/sprints/${activeSprint.id}/daily-standups`,
      duplicateData,
      token
    );

    console.log(`Status gửi lần 2: ${resDuplicate.status}`);
    if (resDuplicate.status !== 409) {
      throw new Error(`Kỳ vọng 409 Conflict nhưng nhận ${resDuplicate.status}: ${JSON.stringify(resDuplicate.data)}`);
    }

    console.log(`Thông báo lỗi nhận được: "${resDuplicate.data.error}" (code: ${resDuplicate.data.code})`);
    if (resDuplicate.data.code !== 'DAILY_STANDUP_EXISTS') {
      throw new Error(`Code phản hồi không khớp: ${resDuplicate.data.code}`);
    }

    // Đảm bảo trong DB vẫn chỉ có đúng 1 bản ghi
    const countAfterDuplicate = await prisma.dailyStandup.count({
      where: { userId: user.id, sprintId: activeSprint.id, reportDate: todayDate }
    });
    if (countAfterDuplicate !== 1) {
      throw new Error(`Kỳ vọng đúng 1 bản ghi trong DB nhưng có ${countAfterDuplicate}`);
    }
    console.log('✅ TEST 3 PASSED: Unique Constraint chặn gửi trùng trong ngày, trả về 409 Conflict chuẩn xác.');

    // ------------------------------------------------------------
    // TEST 4: GET /api/sprints/:sprintId/daily-standups?date=YYYY-MM-DD
    // ------------------------------------------------------------
    console.log('\n--- TEST 4: GET danh sách Daily Standup theo ngày ---');
    const resGet = await apiRequest(
      'GET',
      `${BASE_URL}/sprints/${activeSprint.id}/daily-standups?date=${todayStr}`,
      null,
      token
    );

    console.log(`Status GET: ${resGet.status}`);
    if (resGet.status !== 200) {
      throw new Error(`GET danh sách thất bại: ${JSON.stringify(resGet.data)}`);
    }

    console.log(`Kết quả: submitted = ${resGet.data.submitted}, total = ${resGet.data.total}`);
    if (!resGet.data.submitted) {
      throw new Error("Kỳ vọng submitted = true vì user đã gửi daily hôm nay!");
    }
    if (!resGet.data.myStandup || resGet.data.myStandup.id !== createdStandup.id) {
      throw new Error("myStandup không khớp với bản ghi vừa tạo!");
    }
    console.log('✅ TEST 4 PASSED: API lấy danh sách và kiểm tra trạng thái hoạt động chính xác.');

    console.log('\n🎉 TẤT CẢ CÁC BÀI TEST QUICK DAILY STANDUP ĐÃ PASS 100% (201, 400, 409, GET)!');
  } catch (err) {
    console.error('\n❌ TEST THẤT BẠI:', err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();

