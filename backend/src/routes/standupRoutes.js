const express = require('express');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const router = express.Router({ mergeParams: true });

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Lấy chuỗi ngày YYYY-MM-DD theo múi giờ chuẩn (mặc định Asia/Ho_Chi_Minh)
 */
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

/**
 * Định dạng Date object thành chuỗi YYYY-MM-DD
 */
function formatReportDate(dateObj) {
  if (!dateObj) return '';
  if (typeof dateObj === 'string') return dateObj.slice(0, 10);
  return dateObj.toISOString().slice(0, 10);
}

/**
 * Chuyển đổi YYYY-MM-DD thành Date object dạng UTC midnight cho @db.Date
 */
function parseDateParam(dateParam) {
  let dateStr = dateParam;
  if (!dateStr || typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) {
    dateStr = getLocalDateString();
  } else {
    dateStr = dateStr.trim();
  }
  const dateObj = new Date(`${dateStr}T00:00:00.000Z`);
  return { dateStr, dateObj };
}

/**
 * Kiểm tra quyền thành viên trong project chứa sprint
 */
async function checkSprintMembership(userId, sprintId) {
  const sprint = await prisma.sprint.findUnique({
    where: { id: sprintId },
    include: { project: { select: { id: true, name: true } } }
  });

  if (!sprint) {
    return { error: "Không tìm thấy Sprint", status: 404 };
  }

  // Kiểm tra thành viên project
  const member = await prisma.projectMember.findFirst({
    where: {
      userId,
      projectId: sprint.projectId,
      status: 'ACCEPTED'
    }
  });

  let isMember = Boolean(member);
  if (!isMember) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (user && user.role === 'ADMIN') {
      isMember = true;
    }
  }

  if (!isMember) {
    return { error: "Bạn không phải thành viên của dự án chứa Sprint này", status: 403 };
  }

  return { sprint, isMember, memberRole: member?.role || 'MEMBER' };
}

// ============================================================
// PHẦN 2: APIS CHO QUICK DAILY STANDUP (US - SPRINT DAILY)
// ============================================================

/**
 * 1. POST /api/sprints/:sprintId/daily-standups
 * Gửi báo cáo Daily Standup nhanh (3 fields)
 */
async function postDailyStandupHandler(req, res) {
  const { sprintId } = req.params;
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ error: "Chưa xác thực người dùng" });
  }

  // 1. Kiểm tra Sprint và quyền thành viên
  const check = await checkSprintMembership(userId, sprintId);
  if (check.error) {
    return res.status(check.status).json({ error: check.error });
  }

  const sprint = check.sprint;

  // AC1: Kiểm tra Sprint có đang ở trạng thái ACTIVE hay không
  if (sprint.status !== 'ACTIVE') {
    return res.status(400).json({ 
      error: "Chỉ có thể gửi báo cáo Daily cho Sprint đang hoạt động (ACTIVE)!",
      sprintStatus: sprint.status 
    });
  }

  // 2. DTO / Schema Validation chặt chẽ cả 3 trường (AC2)
  const yesterdayWork = (req.body.yesterday_work ?? req.body.yesterdayWork ?? req.body.yesterday ?? '').toString().trim();
  const todayPlan = (req.body.today_plan ?? req.body.todayPlan ?? req.body.today ?? '').toString().trim();
  const blockers = (req.body.blockers ?? '').toString().trim();

  const missingFields = [];
  const fieldErrors = {};

  if (!yesterdayWork) {
    missingFields.push('yesterday_work');
    fieldErrors.yesterday_work = "Vui lòng nhập công việc đã hoàn thành hôm qua";
  }
  if (!todayPlan) {
    missingFields.push('today_plan');
    fieldErrors.today_plan = "Vui lòng nhập kế hoạch công việc hôm nay";
  }
  if (!blockers) {
    missingFields.push('blockers');
    fieldErrors.blockers = "Vui lòng nhập khó khăn/vướng mắc (hoặc chọn 'Không có')";
  }

  if (missingFields.length > 0) {
    return res.status(400).json({
      error: "Dữ liệu báo cáo Daily không được để trống",
      missingFields,
      details: fieldErrors
    });
  }

  // 3. Lấy ngày báo cáo chuẩn YYYY-MM-DD
  const { dateStr, dateObj } = parseDateParam(req.body.report_date || req.body.date);

  // 4. Kiểm tra xem đã gửi Daily trong ngày hôm nay chưa (DoD Unique Check)
  const existing = await prisma.dailyStandup.findFirst({
    where: {
      userId,
      sprintId,
      reportDate: dateObj
    }
  });

  if (existing) {
    return res.status(409).json({
      error: "Bạn đã gửi báo cáo Daily cho ngày hôm nay rồi",
      code: "DAILY_STANDUP_EXISTS",
      reportDate: dateStr,
      standup: existing
    });
  }

  // 5. Lưu vào Database
  try {
    const standup = await prisma.dailyStandup.create({
      data: {
        userId,
        sprintId,
        reportDate: dateObj,
        yesterdayWork,
        todayPlan,
        blockers,
        // Dữ liệu tương thích ngược
        yesterday: yesterdayWork,
        today: todayPlan,
        date: new Date(),
        projectId: sprint.projectId
      },
      include: {
        user: {
          select: { id: true, fullName: true, email: true, avatar: true }
        }
      }
    });

    res.status(201).json(standup);
  } catch (err) {
    // Bắt lỗi Unique Constraint P2002 từ Database
    if (err.code === 'P2002') {
      return res.status(409).json({
        error: "Bạn đã gửi báo cáo Daily cho ngày hôm nay rồi",
        code: "DAILY_STANDUP_EXISTS",
        reportDate: dateStr
      });
    }
    console.error("Lỗi khi lưu Daily Standup:", err);
    res.status(500).json({ error: "Lỗi máy chủ khi lưu Daily Standup: " + err.message });
  }
}

/**
 * 2. GET /api/sprints/:sprintId/daily-standups?date=YYYY-MM-DD
 * Lấy danh sách Daily Standup của các thành viên trong Sprint theo ngày
 */
async function getDailyStandupsHandler(req, res) {
  const { sprintId } = req.params;
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ error: "Chưa xác thực người dùng" });
  }

  const check = await checkSprintMembership(userId, sprintId);
  if (check.error) {
    return res.status(check.status).json({ error: check.error });
  }

  const { dateStr, dateObj } = parseDateParam(req.query.date);

  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');

    const standups = await prisma.dailyStandup.findMany({
      where: {
        sprintId,
        reportDate: dateObj
      },
      include: {
        user: {
          select: { id: true, fullName: true, email: true, avatar: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Kiểm tra trạng thái đã gửi hay chưa của user hiện tại
    const myStandup = standups.find(s => s.userId === userId) || null;

    res.json({
      sprintId,
      date: dateStr,
      submitted: Boolean(myStandup),
      hasSubmittedToday: Boolean(myStandup),
      myStandup,
      total: standups.length,
      standups
    });
  } catch (err) {
    console.error("Lỗi lấy danh sách Daily Standup:", err);
    res.status(500).json({ error: "Lỗi máy chủ khi lấy danh sách Daily Standup" });
  }
}

/**
 * 3. GET /api/sprints/:sprintId/daily-standups/me/today (hoặc /today)
 * Kiểm tra nhanh trạng thái hôm nay của user hiện tại
 */
async function getMyTodayStandupHandler(req, res) {
  const { sprintId } = req.params;
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ error: "Chưa xác thực người dùng" });
  }

  // Hỗ trợ client truyền query param date nếu cần test
  const { dateStr, dateObj } = parseDateParam(req.query.date);

  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');

    const standup = await prisma.dailyStandup.findFirst({
      where: {
        userId,
        sprintId,
        reportDate: dateObj
      },
      include: {
        user: {
          select: { id: true, fullName: true, email: true, avatar: true }
        }
      }
    });

    res.json({
      sprintId,
      date: dateStr,
      submitted: Boolean(standup),
      hasSubmittedToday: Boolean(standup),
      standup: standup || null,
      data: standup || null
    });
  } catch (err) {
    console.error("Lỗi kiểm tra Standup hôm nay:", err);
    res.status(500).json({ error: "Lỗi máy chủ" });
  }
}

/**
 * 4. PUT /api/sprints/:sprintId/daily-standups/:id (hoặc PATCH, hoặc /today)
 * Cập nhật Daily trong cùng ngày (Edit Same-Day Daily Standup)
 * - Kiểm tra bản ghi phải thuộc về currentUser.id
 * - Kiểm tra Same-day Rule: report_date === today. Nếu sửa ngày cũ -> 403 Forbidden
 * - Validate cả 3 ô (yesterday_work, today_plan, blockers)
 * - Ghi đè nội dung 3 ô, giữ nguyên created_at, cập nhật updated_at
 */
async function updateDailyStandupHandler(req, res) {
  const { sprintId, id } = req.params;
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ error: "Chưa xác thực người dùng" });
  }

  // 1. Kiểm tra Sprint và quyền thành viên
  const check = await checkSprintMembership(userId, sprintId);
  if (check.error) {
    return res.status(check.status).json({ error: check.error });
  }

  // 2. Xác định ngày hôm nay theo múi giờ chuẩn (hỗ trợ header/query override trong testing nếu có)
  const clientDate = req.headers['x-mock-date'] || req.query.date;
  const todayStr = clientDate ? clientDate : getLocalDateString(new Date(), 'Asia/Ho_Chi_Minh');

  // 3. Tìm bản ghi cần cập nhật
  let standup = null;
  if (id && id !== 'today') {
    standup = await prisma.dailyStandup.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, fullName: true, email: true, avatar: true } }
      }
    });
  } else {
    // Nếu gọi route /today hoặc id === 'today'
    const { dateObj } = parseDateParam(todayStr);
    standup = await prisma.dailyStandup.findFirst({
      where: {
        userId,
        sprintId,
        reportDate: dateObj
      },
      include: {
        user: { select: { id: true, fullName: true, email: true, avatar: true } }
      }
    });
  }

  if (!standup) {
    return res.status(404).json({
      error: "Không tìm thấy bản ghi báo cáo Daily",
      code: "DAILY_STANDUP_NOT_FOUND"
    });
  }

  // 4. Kiểm tra quyền sở hữu: Phải là chính tác giả (currentUser.id)
  if (standup.userId !== userId) {
    return res.status(403).json({
      error: "Bạn không có quyền chỉnh sửa báo cáo Daily này",
      code: "FORBIDDEN"
    });
  }

  // 5. Kiểm tra ràng buộc Same-Day: report_date phải bằng ngày hiện tại (today)
  const recordDateStr = formatReportDate(standup.reportDate);
  if (recordDateStr !== todayStr) {
    return res.status(403).json({
      error: "Chỉ được phép chỉnh sửa báo cáo Daily trong cùng ngày",
      code: "FORBIDDEN_NOT_SAME_DAY",
      reportDate: recordDateStr,
      today: todayStr
    });
  }

  // 6. Validate chặt chẽ cả 3 trường (như khi tạo mới)
  const yesterdayWork = (req.body.yesterday_work ?? req.body.yesterdayWork ?? req.body.yesterday ?? '').toString().trim();
  const todayPlan = (req.body.today_plan ?? req.body.todayPlan ?? req.body.today ?? '').toString().trim();
  const blockers = (req.body.blockers ?? '').toString().trim();

  const missingFields = [];
  const fieldErrors = {};

  if (!yesterdayWork) {
    missingFields.push('yesterday_work');
    fieldErrors.yesterday_work = "Vui lòng nhập công việc đã hoàn thành hôm qua";
  }
  if (!todayPlan) {
    missingFields.push('today_plan');
    fieldErrors.today_plan = "Vui lòng nhập kế hoạch công việc hôm nay";
  }
  if (!blockers) {
    missingFields.push('blockers');
    fieldErrors.blockers = "Vui lòng nhập khó khăn/vướng mắc (hoặc chọn 'Không có')";
  }

  if (missingFields.length > 0) {
    return res.status(400).json({
      error: "Dữ liệu báo cáo Daily không được để trống",
      missingFields,
      details: fieldErrors
    });
  }

  // 7. Cập nhật dữ liệu vào DB (AC1):
  // Ghi đè 3 ô, giữ nguyên createdAt, cập nhật updatedAt = new Date()
  try {
    const updatedStandup = await prisma.dailyStandup.update({
      where: { id: standup.id },
      data: {
        yesterdayWork,
        todayPlan,
        blockers,
        yesterday: yesterdayWork,
        today: todayPlan,
        updatedAt: new Date()
      },
      include: {
        user: { select: { id: true, fullName: true, email: true, avatar: true } }
      }
    });

    return res.status(200).json(updatedStandup);
  } catch (err) {
    console.error("Lỗi khi cập nhật Daily Standup:", err);
    return res.status(500).json({ error: "Lỗi máy chủ khi cập nhật Daily Standup: " + err.message });
  }
}

// Đăng ký các endpoints cho Sprint Daily Standup
router.post('/:sprintId/daily-standups', postDailyStandupHandler);
router.get('/:sprintId/daily-standups', getDailyStandupsHandler);
router.get('/:sprintId/daily-standups/me/today', getMyTodayStandupHandler);
router.get('/:sprintId/daily-standups/today', getMyTodayStandupHandler);
router.put('/:sprintId/daily-standups/today', updateDailyStandupHandler);
router.patch('/:sprintId/daily-standups/today', updateDailyStandupHandler);
router.put('/:sprintId/daily-standups/:id', updateDailyStandupHandler);
router.patch('/:sprintId/daily-standups/:id', updateDailyStandupHandler);

// ============================================================
// HỖ TRỢ ROUTE TƯƠNG THÍCH NGƯỢC VỚI PROJECT STANDUP CŨ
// ============================================================

router.post('/project/:projectId', async (req, res) => {
  const { projectId } = req.params;
  const userId = req.user?.userId;

  // Tìm Sprint đang ACTIVE của project
  const activeSprint = await prisma.sprint.findFirst({
    where: { projectId, status: 'ACTIVE' }
  });

  if (!activeSprint) {
    return res.status(400).json({ error: "Dự án hiện chưa có Sprint nào đang hoạt động (ACTIVE)!" });
  }

  req.params.sprintId = activeSprint.id;
  return postDailyStandupHandler(req, res);
});

router.get('/project/:projectId', async (req, res) => {
  const { projectId } = req.params;
  try {
    const standups = await prisma.dailyStandup.findMany({
      where: {
        OR: [
          { projectId },
          { sprint: { projectId } }
        ]
      },
      include: {
        user: { select: { id: true, fullName: true, email: true, avatar: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(standups);
  } catch (err) {
    res.status(500).json({ error: "Lỗi server khi lấy danh sách Stand-up" });
  }
});

router.get('/project/:projectId/me/today', async (req, res) => {
  const { projectId } = req.params;
  const userId = req.user?.userId;
  const { dateObj } = parseDateParam();

  try {
    const standup = await prisma.dailyStandup.findFirst({
      where: {
        userId,
        OR: [
          { projectId },
          { sprint: { projectId } }
        ],
        reportDate: dateObj
      }
    });

    res.json({ submitted: !!standup, standup });
  } catch (err) {
    res.status(500).json({ error: "Lỗi server" });
  }
});

module.exports = router;
