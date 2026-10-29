// backend/src/routes/sprintCeremonyRoutes.js
// US-023: Sprint Review  |  US-024: Sprint Retrospective
// Lưu dữ liệu ceremony vào trường goal của Sprint dưới dạng JSON container

const express = require('express');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const router = express.Router();

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Parse trường goal từ DB thành object.
 * - null / empty  → { text: null }
 * - plain string  → { text: "..." }
 * - JSON string   → parsed object
 */
function parseGoalField(goalRaw) {
  if (!goalRaw) return { text: null };

  try {
    const parsed = JSON.parse(goalRaw);
    // Nếu parse được nhưng không phải object (ví dụ: số, boolean) → coi như text
    if (typeof parsed !== 'object' || parsed === null) {
      return { text: goalRaw };
    }
    return parsed;
  } catch {
    // Không phải JSON hợp lệ → đây là plain text goal ban đầu
    return { text: goalRaw };
  }
}

/**
 * Serialize goal object thành JSON string để lưu vào DB
 */
function serializeGoalField(goalObj) {
  return JSON.stringify(goalObj);
}

/**
 * Kiểm tra user có phải PO hoặc SM trong project không
 */
async function checkPOorSM(userId, projectId) {
  const member = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
  });
  return member && (member.role === 'PO' || member.role === 'SM');
}

/**
 * Kiểm tra user có phải thành viên (ACCEPTED) trong project không
 */
async function checkMember(userId, projectId) {
  const member = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
  });
  return member && member.status === 'ACCEPTED';
}

// ============================================================
// US-023: SPRINT REVIEW
// ============================================================

/**
 * PUT /:sprintId/review
 * Lưu hoặc cập nhật nội dung Sprint Review
 * Quyền: PO hoặc SM
 * Body: { demoContent: string, feedback: string }
 */
router.put('/:sprintId/review', async (req, res) => {
  const { sprintId } = req.params;
  const { demoContent, feedback } = req.body;
  const userId = req.user.userId;

  try {
    // 1. Tìm Sprint
    const sprint = await prisma.sprint.findUnique({ where: { id: sprintId } });
    if (!sprint) {
      return res.status(404).json({ error: 'Không tìm thấy Sprint' });
    }

    // 2. Kiểm tra quyền: Phải là thành viên dự án
    const member = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId: sprint.projectId } }
    });
    
    if (!member || member.status !== 'ACCEPTED') {
      return res.status(403).json({
        error: 'Bạn không có quyền cập nhật Sprint Review của dự án này.'
      });
    }

    const isPOorSM = member.role === 'PO' || member.role === 'SM';

    // 3. Validate input (ít nhất một trường phải có mặt nếu muốn xóa trắng thì send empty string)
    if (demoContent === undefined && feedback === undefined) {
      return res.status(400).json({
        error: 'Vui lòng cung cấp demoContent hoặc feedback để cập nhật.'
      });
    }

    // 4. Parse goal hiện tại → merge review data → ghi lại
    const goalObj = parseGoalField(sprint.goal);
    const existingReview = goalObj.review || { demoContent: '', feedback: '' };

    // Logic phân quyền theo trường:
    // - demoContent: Ai cũng sửa được (MEMBER, SM, PO)
    // - feedback: Chỉ PO/SM sửa được
    let newReview = {
      ...existingReview,
      updatedAt: new Date().toISOString(),
      updatedBy: userId
    };

    if (demoContent !== undefined) {
      newReview.demoContent = demoContent;
    }

    if (feedback !== undefined) {
      if (isPOorSM) {
        newReview.feedback = feedback;
      } else {
        // Nếu là Member gửi feedback lên, chúng ta bỏ qua/giữ nguyên feedback cũ
        // để tránh Member ghi đè feedback của PO/SM
        newReview.feedback = existingReview.feedback;
      }
    }

    goalObj.review = newReview;

    const updated = await prisma.sprint.update({
      where: { id: sprintId },
      data: { goal: serializeGoalField(goalObj) }
    });

    res.json({
      message: 'Lưu Sprint Review thành công!',
      review: goalObj.review,
      sprintId: updated.id
    });
  } catch (err) {
    console.error('Lỗi lưu Sprint Review:', err);
    res.status(500).json({ error: 'Lỗi server khi lưu Sprint Review: ' + err.message });
  }
});

/**
 * POST /:sprintId/review/items
 * Thêm một ý kiến phản hồi mới vào Sprint Review
 * Quyền: Thành viên dự án (ACCEPTED)
 * Body: { text: string }
 */
router.post('/:sprintId/review/items', async (req, res) => {
  const { sprintId } = req.params;
  const { text } = req.body;
  const userId = req.user.userId;

  try {
    const sprint = await prisma.sprint.findUnique({ where: { id: sprintId } });
    if (!sprint) {
      return res.status(404).json({ error: 'Không tìm thấy Sprint' });
    }

    const isMember = await checkMember(userId, sprint.projectId);
    if (!isMember) {
      return res.status(403).json({ error: 'Bạn không phải thành viên của dự án này.' });
    }

    if (!text) {
      return res.status(400).json({ error: 'Vui lòng cung cấp nội dung phản hồi (text).' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    const goalObj = parseGoalField(sprint.goal);
    
    if (!goalObj.review) {
      goalObj.review = { demoContent: '', feedback: '', items: [] };
    }
    if (!Array.isArray(goalObj.review.items)) {
      goalObj.review.items = [];
    }

    const newItem = {
      id: 'rev_' + Date.now().toString() + Math.random().toString(36).substring(2, 5),
      text: text.trim(),
      userId,
      userName: user?.fullName || user?.email || 'Unknown',
      createdAt: new Date().toISOString()
    };

    goalObj.review.items.unshift(newItem);
    goalObj.review.updatedAt = new Date().toISOString();

    await prisma.sprint.update({
      where: { id: sprintId },
      data: { goal: serializeGoalField(goalObj) }
    });

    res.json({
      message: 'Thêm phản hồi thành công!',
      item: newItem,
      items: goalObj.review.items
    });
  } catch (err) {
    console.error('Lỗi thêm phản hồi Review:', err);
    res.status(500).json({ error: 'Lỗi server khi thêm phản hồi: ' + err.message });
  }
});

/**
 * DELETE /:sprintId/review/items/:itemId
 * Xóa một phản hồi trong Sprint Review
 * Quyền: Người tạo phản hồi HOẶC (PO/SM của dự án)
 */
router.delete('/:sprintId/review/items/:itemId', async (req, res) => {
  const { sprintId, itemId } = req.params;
  const userId = req.user.userId;

  try {
    const sprint = await prisma.sprint.findUnique({ where: { id: sprintId } });
    if (!sprint) {
      return res.status(404).json({ error: 'Không tìm thấy Sprint' });
    }

    const member = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId: sprint.projectId } }
    });

    if (!member || member.status !== 'ACCEPTED') {
      return res.status(403).json({ error: 'Bạn không có quyền truy cập.' });
    }

    const isManagement = member.role === 'PO' || member.role === 'SM';

    const goalObj = parseGoalField(sprint.goal);
    if (!goalObj.review || !Array.isArray(goalObj.review.items)) {
      return res.status(404).json({ error: 'Review chưa được khởi tạo.' });
    }

    const itemIndex = goalObj.review.items.findIndex(i => i.id === itemId);
    if (itemIndex === -1) {
      return res.status(404).json({ error: 'Không tìm thấy phản hồi này.' });
    }

    const item = goalObj.review.items[itemIndex];

    if (item.userId !== userId && !isManagement) {
      return res.status(403).json({ error: 'Bạn không có quyền xóa phản hồi của người khác.' });
    }

    goalObj.review.items.splice(itemIndex, 1);
    goalObj.review.updatedAt = new Date().toISOString();

    await prisma.sprint.update({
      where: { id: sprintId },
      data: { goal: serializeGoalField(goalObj) }
    });

    res.json({
      message: 'Xóa phản hồi thành công!',
      items: goalObj.review.items
    });
  } catch (err) {
    console.error('Lỗi xóa phản hồi Review:', err);
    res.status(500).json({ error: 'Lỗi server khi xóa phản hồi: ' + err.message });
  }
});

/**
 * GET /:sprintId/review
 * Lấy nội dung Sprint Review
 * Quyền: Thành viên dự án (ACCEPTED)
 */
router.get('/:sprintId/review', async (req, res) => {
  const { sprintId } = req.params;
  const userId = req.user.userId;

  try {
    const sprint = await prisma.sprint.findUnique({ where: { id: sprintId } });
    if (!sprint) {
      return res.status(404).json({ error: 'Không tìm thấy Sprint' });
    }

    // Kiểm tra quyền: phải là thành viên dự án
    const isMember = await checkMember(userId, sprint.projectId);
    if (!isMember) {
      return res.status(403).json({ error: 'Bạn không phải thành viên của dự án này.' });
    }

    const goalObj = parseGoalField(sprint.goal);
    const reviewData = goalObj.review || { demoContent: '', feedback: '', items: [] };
    if (!Array.isArray(reviewData.items)) reviewData.items = [];

    res.json({
      sprintId: sprint.id,
      sprintName: sprint.name,
      review: reviewData
    });
  } catch (err) {
    console.error('Lỗi lấy Sprint Review:', err);
    res.status(500).json({ error: 'Lỗi server khi lấy Sprint Review' });
  }
});

// ============================================================
// US-024: SPRINT RETROSPECTIVE
// ============================================================

/**
 * POST /:sprintId/retrospective/items
 * Thêm một ý kiến mới vào Sprint Retrospective
 * Quyền: Thành viên dự án (ACCEPTED)
 * Body: { type: 'WENT_WELL' | 'NEEDS_IMPROVEMENT' | 'ACTION_ITEM', text: string }
 */
router.post('/:sprintId/retrospective/items', async (req, res) => {
  const { sprintId } = req.params;
  const { type, text } = req.body;
  const userId = req.user.userId;

  try {
    const sprint = await prisma.sprint.findUnique({ where: { id: sprintId } });
    if (!sprint) {
      return res.status(404).json({ error: 'Không tìm thấy Sprint' });
    }

    const isMember = await checkMember(userId, sprint.projectId);
    if (!isMember) {
      return res.status(403).json({ error: 'Bạn không phải thành viên của dự án này.' });
    }

    if (!type || !text) {
      return res.status(400).json({ error: 'Vui lòng cung cấp loại ý kiến (type) và nội dung (text).' });
    }

    // Lấy thông tin user để lưu tên người tạo
    const user = await prisma.user.findUnique({ where: { id: userId } });

    const goalObj = parseGoalField(sprint.goal);
    
    // Nếu retrospective chưa có hoặc data cũ (không phải mảng items), khởi tạo mới
    if (!goalObj.retrospective || !Array.isArray(goalObj.retrospective.items)) {
      goalObj.retrospective = {
        items: [],
        updatedAt: new Date().toISOString()
      };
    }

    const newItem = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 5), // generate short id
      type,
      text: text.trim(),
      userId,
      userName: user?.fullName || user?.email || 'Unknown',
      createdAt: new Date().toISOString()
    };

    goalObj.retrospective.items.unshift(newItem); // Thêm lên đầu danh sách
    goalObj.retrospective.updatedAt = new Date().toISOString();

    const updated = await prisma.sprint.update({
      where: { id: sprintId },
      data: { goal: serializeGoalField(goalObj) }
    });

    res.json({
      message: 'Thêm ý kiến thành công!',
      item: newItem,
      items: goalObj.retrospective.items
    });
  } catch (err) {
    console.error('Lỗi thêm ý kiến Retrospective:', err);
    res.status(500).json({ error: 'Lỗi server khi thêm ý kiến Retrospective: ' + err.message });
  }
});

/**
 * DELETE /:sprintId/retrospective/items/:itemId
 * Xóa một ý kiến trong Retrospective
 * Quyền: Người tạo ý kiến HOẶC (PO/SM của dự án)
 */
router.delete('/:sprintId/retrospective/items/:itemId', async (req, res) => {
  const { sprintId, itemId } = req.params;
  const userId = req.user.userId;

  try {
    const sprint = await prisma.sprint.findUnique({ where: { id: sprintId } });
    if (!sprint) {
      return res.status(404).json({ error: 'Không tìm thấy Sprint' });
    }

    const member = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId: sprint.projectId } }
    });

    if (!member || member.status !== 'ACCEPTED') {
      return res.status(403).json({ error: 'Bạn không có quyền truy cập.' });
    }

    const isManagement = member.role === 'PO' || member.role === 'SM';

    const goalObj = parseGoalField(sprint.goal);
    if (!goalObj.retrospective || !Array.isArray(goalObj.retrospective.items)) {
      return res.status(404).json({ error: 'Retrospective chưa được khởi tạo.' });
    }

    const itemIndex = goalObj.retrospective.items.findIndex(i => i.id === itemId);
    if (itemIndex === -1) {
      return res.status(404).json({ error: 'Không tìm thấy ý kiến này.' });
    }

    const item = goalObj.retrospective.items[itemIndex];

    // Kiểm tra quyền: Chủ nhân của item hoặc là Quản lý
    if (item.userId !== userId && !isManagement) {
      return res.status(403).json({ error: 'Bạn không có quyền xóa ý kiến của người khác.' });
    }

    goalObj.retrospective.items.splice(itemIndex, 1);
    goalObj.retrospective.updatedAt = new Date().toISOString();

    await prisma.sprint.update({
      where: { id: sprintId },
      data: { goal: serializeGoalField(goalObj) }
    });

    res.json({
      message: 'Xóa ý kiến thành công!',
      items: goalObj.retrospective.items
    });
  } catch (err) {
    console.error('Lỗi xóa ý kiến Retrospective:', err);
    res.status(500).json({ error: 'Lỗi server khi xóa ý kiến: ' + err.message });
  }
});

/**
 * GET /:sprintId/retrospective
 * Lấy nội dung Sprint Retrospective
 * Quyền: Thành viên dự án (ACCEPTED)
 */
router.get('/:sprintId/retrospective', async (req, res) => {
  const { sprintId } = req.params;
  const userId = req.user.userId;

  try {
    const sprint = await prisma.sprint.findUnique({ where: { id: sprintId } });
    if (!sprint) {
      return res.status(404).json({ error: 'Không tìm thấy Sprint' });
    }

    // Kiểm tra quyền
    const isMember = await checkMember(userId, sprint.projectId);
    if (!isMember) {
      return res.status(403).json({ error: 'Bạn không phải thành viên của dự án này.' });
    }

    const goalObj = parseGoalField(sprint.goal);
    let retroData = goalObj.retrospective;

    // Đảm bảo trả về mảng nếu là dạng cũ
    if (retroData && !Array.isArray(retroData.items)) {
        retroData.items = [];
    }

    res.json({
      sprintId: sprint.id,
      sprintName: sprint.name,
      retrospective: retroData || { items: [] }
    });
  } catch (err) {
    console.error('Lỗi lấy Sprint Retrospective:', err);
    res.status(500).json({ error: 'Lỗi server khi lấy Sprint Retrospective' });
  }
});

// ============================================================
// TIỆN ÍCH: Lấy tất cả ceremony data của Sprint (Review + Retro)
// ============================================================

/**
 * GET /:sprintId/ceremonies
 * Lấy toàn bộ dữ liệu ceremony (review + retrospective + goal gốc)
 * Quyền: Thành viên dự án (ACCEPTED)
 */
router.get('/:sprintId/ceremonies', async (req, res) => {
  const { sprintId } = req.params;
  const userId = req.user.userId;

  try {
    const sprint = await prisma.sprint.findUnique({ where: { id: sprintId } });
    if (!sprint) {
      return res.status(404).json({ error: 'Không tìm thấy Sprint' });
    }

    const isMember = await checkMember(userId, sprint.projectId);
    if (!isMember) {
      return res.status(403).json({ error: 'Bạn không phải thành viên của dự án này.' });
    }

    const goalObj = parseGoalField(sprint.goal);

    res.json({
      sprintId: sprint.id,
      sprintName: sprint.name,
      sprintStatus: sprint.status,
      goal: goalObj.text || null,
      review: goalObj.review || null,
      retrospective: goalObj.retrospective || null
    });
  } catch (err) {
    console.error('Lỗi lấy ceremonies:', err);
    res.status(500).json({ error: 'Lỗi server khi lấy dữ liệu ceremony' });
  }
});

module.exports = router;
