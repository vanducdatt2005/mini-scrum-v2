const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { getActivities } = require('../services/activityService');

// Middleware xác thực token
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Không có token xác thực" });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "mini_scrum_secret");
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: "Token không hợp lệ hoặc đã hết hạn" });
  }
};

/**
 * 1. GET /api/activities
 * Query Params:
 *  - entityType: 'TASK' | 'USER_STORY'
 *  - entityId: string
 *  - cursor: string (optional)
 *  - limit: number (optional, default 20)
 * Cursor-based pagination phục vụ Infinite Scroll (DoD)
 */
router.get('/activities', authMiddleware, async (req, res) => {
  try {
    let { entityType, entityId, cursor, limit } = req.query;

    if (!entityType || !entityId) {
      return res.status(400).json({ error: "Thiếu tham số entityType hoặc entityId" });
    }

    // Chuẩn hóa entityType ('task' / 'story' / 'TASK' / 'USER_STORY')
    entityType = entityType.toUpperCase();
    if (entityType === 'STORY') entityType = 'USER_STORY';

    if (!['TASK', 'USER_STORY'].includes(entityType)) {
      return res.status(400).json({ error: "entityType chỉ chấp nhận giá trị 'TASK' hoặc 'USER_STORY'" });
    }

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    const result = await getActivities({
      entityType,
      entityId,
      cursor: cursor || null,
      limit: limit ? parseInt(limit) : 20
    });

    res.json(result);
  } catch (err) {
    console.error('Lỗi lấy danh sách Activity Logs:', err);
    res.status(500).json({ error: 'Lỗi máy chủ khi lấy lịch sử thay đổi' });
  }
});

/**
 * 2. BẢO VỆ TÍNH TOÀN VẸN (IMMUTABLE LOGS - AC4):
 * Tuyệt đối không cho phép bất kỳ hành vi sửa/xóa Activity Log nào (chặn PUT, PATCH, DELETE, POST)
 */
const immutableReject = (req, res) => {
  res.status(405).json({
    error: "Lịch sử thay đổi (Activity Logs / Audit Trail) là bất biến (Immutable). Tuyệt đối không cho phép tạo thủ công, sửa đổi hoặc xóa."
  });
};

router.post('/activities', authMiddleware, immutableReject);
router.put('/activities/:id', authMiddleware, immutableReject);
router.patch('/activities/:id', authMiddleware, immutableReject);
router.delete('/activities/:id', authMiddleware, immutableReject);
router.delete('/activities', authMiddleware, immutableReject);

module.exports = router;

