/**
 * sprintSummaryRoutes.js
 * ---------------------------------------------------------------------------
 * Mô-đun Tổng kết Sprint & Đánh giá Đóng Góp
 *
 * Auth được xử lý per-route qua middleware `auth` cục bộ,
 * KHÔNG dùng router.use() để tránh chặn /api/login khi mount tại /api.
 *
 * Endpoints (sau khi mount tại /api):
 *  PATCH  /api/user-stories/:id/hours                  → Ghi nhận giờ thực tế
 *  POST   /api/sprints/:sprintId/summary/generate       → Tạo / tái tạo tổng kết (PO/SM)
 *  GET    /api/sprints/:sprintId/summary                → Xem kết quả tổng kết
 *  PATCH  /api/sprints/:sprintId/summary/notes          → Cập nhật ghi chú (PO/SM)
 *  GET    /api/projects/:projectId/summaries            → Danh sách tổng kết (PO/SM)
 * ---------------------------------------------------------------------------
 */

const express = require('express');
const router  = express.Router();
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

// ============================================================
// LOCAL AUTH MIDDLEWARE — chỉ dùng làm tham số từng route,
// KHÔNG gọi router.use() để không chặn /api/login
// ============================================================
const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Không có token' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'mini_scrum_secret');
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token không hợp lệ' });
  }
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Kiểm tra user có phải PO hoặc SM trong project không.
 * @returns {Promise<boolean>}
 */
const isPOorSM = async (userId, projectId) => {
  const m = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
  });
  return m && (m.role === 'PO' || m.role === 'SM');
};

/**
 * Kiểm tra user có phải thành viên ACCEPTED của project không.
 * @returns {Promise<boolean>}
 */
const isMember = async (userId, projectId) => {
  const m = await prisma.projectMember.findFirst({
    where: { userId, projectId, status: 'ACCEPTED' },
  });
  return !!m;
};

/**
 * Tính "điểm tổng hợp" cho một thành viên trong Sprint.
 *
 * Công thức có trọng số theo vai trò:
 *  - DEV / PO / SM  : (storyPoints × 0.7) + (hoursWorked × 0.3)
 *  - TESTER         : (testCases × 0.5) + (bugsFound × 0.5)  → quy đổi sang đơn vị tương đương
 *  - DESIGNER       : (storyPoints × 0.6) + (screens × 10 × 0.4)
 *
 * Sau đó chuẩn hóa toàn nhóm về tổng 100%.
 *
 * @param {string} role        - Vai trò (PO|SM|DEV|TESTER|DESIGNER|MEMBER)
 * @param {number} storyPoints - Tổng SP của stories được assign và DONE
 * @param {number} hoursWorked - Tổng giờ làm việc
 * @param {object} special     - {testCases, bugsFound, screens, components}
 * @returns {number} raw score (chưa chuẩn hóa)
 */
const calcRawScore = (role, storyPoints, hoursWorked, special = {}) => {
  const sp  = storyPoints || 0;
  const hrs = hoursWorked || 0;

  switch (role) {
    case 'TESTER': {
      const tc   = special.testCases || 0;
      const bugs = special.bugsFound || 0;
      const equivalent = (tc * 0.5) + (bugs * 1.0);
      return equivalent > 0 ? equivalent : (sp * 0.7 + hrs * 0.3);
    }
    case 'DESIGNER': {
      const screens    = special.screens    || 0;
      const components = special.components || 0;
      const designScore = screens * 1.5 + components * 0.5;
      return (sp * 0.6) + (designScore * 0.4);
    }
    default:
      return (sp * 0.7) + (hrs * 0.3);
  }
};

// ============================================================
// HELPER: Format response — parse specialMetric JSON string → object
// ============================================================
const formatSummary = (summary) => {
  if (!summary) return summary;
  return {
    ...summary,
    contributions: (summary.contributions || []).map(c => ({
      ...c,
      specialMetric: (() => {
        try {
          return typeof c.specialMetric === 'string'
            ? JSON.parse(c.specialMetric || '{}')
            : (c.specialMetric || {});
        } catch {
          return {};
        }
      })(),
    })),
  };
};

// ============================================================
// ROUTE 1: PATCH /user-stories/:id/hours
// Thành viên được assign cập nhật số giờ thực tế cho một User Story.
// ============================================================
router.patch('/user-stories/:id/hours', auth, async (req, res) => {
  const { id }         = req.params;
  const { hoursSpent } = req.body;
  const userId         = req.user.userId;

  if (hoursSpent === undefined || hoursSpent === null || isNaN(Number(hoursSpent))) {
    return res.status(400).json({ error: 'Giá trị hoursSpent không hợp lệ' });
  }

  try {
    const story = await prisma.userStory.findUnique({ where: { id } });
    if (!story) return res.status(404).json({ error: 'Không tìm thấy User Story' });

    const canEdit = story.assigneeId === userId || await isPOorSM(userId, story.projectId);
    if (!canEdit) {
      return res.status(403).json({ error: 'Bạn không có quyền cập nhật số giờ của story này' });
    }

    const updated = await prisma.userStory.update({
      where: { id },
      data:  { hoursSpent: parseInt(hoursSpent) },
      select: { id: true, title: true, hoursSpent: true, storyPoints: true },
    });

    res.json({ message: 'Đã cập nhật số giờ thực tế', story: updated });
  } catch (err) {
    console.error('Error updating hoursSpent:', err);
    res.status(500).json({ error: 'Lỗi khi cập nhật số giờ: ' + err.message });
  }
});

// ============================================================
// ROUTE 2: POST /sprints/:sprintId/summary/generate
// PO/SM tạo hoặc tái tạo tổng kết Sprint.
// Body: { memberSpecialMetrics: { [userId]: { testCases, bugsFound, screens, components } } }
// ============================================================
router.post('/sprints/:sprintId/summary/generate', auth, async (req, res) => {
  const { sprintId } = req.params;
  const userId       = req.user.userId;
  const { memberSpecialMetrics = {} } = req.body;

  try {
    const sprint = await prisma.sprint.findUnique({
      where:   { id: sprintId },
      include: {
        stories:  {
          include: { assignee: { select: { id: true, fullName: true, email: true } } }
        },
        project:  { include: { members: { where: { status: 'ACCEPTED' } } } },
      },
    });

    if (!sprint) return res.status(404).json({ error: 'Không tìm thấy Sprint' });

    const authorized = await isPOorSM(userId, sprint.projectId);
    if (!authorized) {
      return res.status(403).json({ error: 'Chỉ PO hoặc SM mới có thể tạo tổng kết Sprint' });
    }

    const doneStories    = sprint.stories.filter(s => s.status === 'DONE');
    const totalStories   = sprint.stories.length;
    const completionRate = totalStories > 0
      ? parseFloat(((doneStories.length / totalStories) * 100).toFixed(2))
      : 0;

    const totalSP   = doneStories.reduce((sum, s) => sum + (s.storyPoints || 0), 0);
    const plannedSP = sprint.stories.reduce((sum, s) => sum + (s.storyPoints || 0), 0);

    const totalHours = doneStories.reduce((sum, s) => {
      const hrs = s.hoursSpent != null ? s.hoursSpent : (s.storyPoints || 0) * 4;
      return sum + hrs;
    }, 0);

    const memberRoleMap = {};
    sprint.project.members.forEach(m => { memberRoleMap[m.userId] = m.role; });

    const contributionMap = {};
    doneStories.forEach(story => {
      if (!story.assigneeId) return;
      if (!contributionMap[story.assigneeId]) {
        contributionMap[story.assigneeId] = { sp: 0, hours: 0, storiesCount: 0 };
      }
      const hrs = story.hoursSpent != null ? story.hoursSpent : (story.storyPoints || 0) * 4;
      contributionMap[story.assigneeId].sp           += (story.storyPoints || 0);
      contributionMap[story.assigneeId].hours        += hrs;
      contributionMap[story.assigneeId].storiesCount += 1;
    });

    sprint.project.members.forEach(m => {
      if (!contributionMap[m.userId]) {
        contributionMap[m.userId] = { sp: 0, hours: 0, storiesCount: 0 };
      }
    });

    const entries = Object.entries(contributionMap).map(([uid, data]) => {
      const role    = memberRoleMap[uid] || 'MEMBER';
      const special = memberSpecialMetrics[uid] || {};
      const raw     = calcRawScore(role, data.sp, data.hours, special);
      return { userId: uid, role, ...data, special, raw };
    });

    const totalRaw = entries.reduce((sum, e) => sum + e.raw, 0);

    const contributions = entries.map(e => ({
      userId:           e.userId,
      roleInSprint:     e.role,
      storiesCompleted: e.storiesCount,
      storyPoints:      e.sp,
      hoursWorked:      e.hours,
      specialMetric:    JSON.stringify(e.special),
      contributionPct:  totalRaw > 0
        ? parseFloat(((e.raw / totalRaw) * 100).toFixed(2))
        : parseFloat((100 / entries.length).toFixed(2)),
    }));

    const existingSummary = await prisma.sprintSummary.findUnique({ where: { sprintId } });
    if (existingSummary) {
      await prisma.sprintSummary.delete({ where: { sprintId } });
    }

    const summary = await prisma.sprintSummary.create({
      data: {
        sprintId, totalSP, totalHours, plannedSP, completionRate,
        contributions: { create: contributions },
      },
      include: {
        contributions: {
          include: { user: { select: { id: true, fullName: true, email: true, avatar: true } } },
          orderBy: { contributionPct: 'desc' },
        },
        sprint: { select: { name: true, startDate: true, endDate: true } },
      },
    });

    res.status(201).json({
      message: 'Tổng kết Sprint đã được tạo thành công!',
      summary:  formatSummary(summary),
    });
  } catch (err) {
    console.error('Error generating sprint summary:', err);
    res.status(500).json({ error: 'Lỗi khi tạo tổng kết Sprint: ' + err.message });
  }
});

// ============================================================
// ROUTE 3: GET /sprints/:sprintId/summary
// Mọi thành viên trong project đều có thể xem tổng kết.
// ============================================================
router.get('/sprints/:sprintId/summary', auth, async (req, res) => {
  const { sprintId } = req.params;
  const userId       = req.user.userId;

  try {
    const sprint = await prisma.sprint.findUnique({
      where:  { id: sprintId },
      select: { id: true, projectId: true, name: true, status: true },
    });
    if (!sprint) return res.status(404).json({ error: 'Không tìm thấy Sprint' });

    const memberCheck = await isMember(userId, sprint.projectId);
    if (!memberCheck) {
      return res.status(403).json({ error: 'Bạn không phải thành viên của dự án này' });
    }

    const summary = await prisma.sprintSummary.findUnique({
      where:   { sprintId },
      include: {
        contributions: {
          include: { user: { select: { id: true, fullName: true, email: true, avatar: true } } },
          orderBy: { contributionPct: 'desc' },
        },
        sprint: {
          select: { name: true, goal: true, startDate: true, endDate: true, status: true },
        },
      },
    });

    if (!summary) {
      return res.status(404).json({
        error:        'Chưa có tổng kết cho Sprint này',
        hint:         'PO hoặc SM cần gọi POST /generate để tạo tổng kết',
        sprintStatus: sprint.status,
      });
    }

    res.json(formatSummary(summary));
  } catch (err) {
    console.error('Error fetching sprint summary:', err);
    res.status(500).json({ error: 'Lỗi khi lấy tổng kết Sprint: ' + err.message });
  }
});

// ============================================================
// ROUTE 4: PATCH /sprints/:sprintId/summary/notes
// PO/SM cập nhật ghi chú / retrospective.
// ============================================================
router.patch('/sprints/:sprintId/summary/notes', auth, async (req, res) => {
  const { sprintId } = req.params;
  const userId       = req.user.userId;
  const { notes }    = req.body;

  try {
    const sprint = await prisma.sprint.findUnique({
      where: { id: sprintId }, select: { projectId: true },
    });
    if (!sprint) return res.status(404).json({ error: 'Không tìm thấy Sprint' });

    const authorized = await isPOorSM(userId, sprint.projectId);
    if (!authorized) {
      return res.status(403).json({ error: 'Chỉ PO hoặc SM mới có thể cập nhật ghi chú' });
    }

    const summary = await prisma.sprintSummary.findUnique({ where: { sprintId } });
    if (!summary) {
      return res.status(404).json({ error: 'Chưa có tổng kết. Hãy tạo tổng kết trước.' });
    }

    const updated = await prisma.sprintSummary.update({
      where: { sprintId },
      data:  { notes: notes ?? '' },
      select: { id: true, notes: true, updatedAt: true },
    });

    res.json({ message: 'Đã cập nhật ghi chú tổng kết', summary: updated });
  } catch (err) {
    console.error('Error updating notes:', err);
    res.status(500).json({ error: 'Lỗi khi cập nhật ghi chú: ' + err.message });
  }
});

// ============================================================
// ROUTE 5: GET /projects/:projectId/summaries
// Danh sách tổng kết tất cả Sprint trong project (PO/SM).
// ============================================================
router.get('/projects/:projectId/summaries', auth, async (req, res) => {
  const { projectId } = req.params;
  const userId        = req.user.userId;

  try {
    const authorized = await isPOorSM(userId, projectId);
    if (!authorized) {
      return res.status(403).json({ error: 'Chỉ PO hoặc SM mới có thể xem danh sách tổng kết' });
    }

    const summaries = await prisma.sprintSummary.findMany({
      where: { sprint: { projectId } },
      include: {
        sprint: {
          select: { id: true, name: true, startDate: true, endDate: true, status: true },
        },
        contributions: {
          select: { userId: true, contributionPct: true, storyPoints: true, roleInSprint: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(summaries.map(formatSummary));
  } catch (err) {
    console.error('Error fetching project summaries:', err);
    res.status(500).json({ error: 'Lỗi khi lấy danh sách tổng kết: ' + err.message });
  }
});

module.exports = router;
