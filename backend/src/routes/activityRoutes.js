const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
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
 * 2. GET /api/projects/:id/activities (SCRUM-71)
 * Query Params:
 *  - limit: number (optional, default 20)
 *  - cursor: string (optional)
 * Phân trang theo Cursor, kiểm tra quyền thành viên (403 nếu không thuộc project)
 */
router.get('/projects/:id/activities', authMiddleware, async (req, res) => {
  try {
    const projectId = req.params.id;
    const userId = req.user.userId || req.user.id;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true }
    });

    if (!project) {
      return res.status(404).json({ error: "Không tìm thấy dự án" });
    }

    const member = await prisma.projectMember.findFirst({
      where: {
        projectId,
        userId
      }
    });

    let isMember = Boolean(member);
    if (!isMember) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true }
      });
      if (user && user.role === 'ADMIN') {
        isMember = true;
      }
    }

    if (!isMember) {
      return res.status(403).json({ error: "Bạn không có quyền truy cập hoạt động của dự án này" });
    }

    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const cursor = req.query.cursor;

    const queryArgs = {
      where: { projectId },
      orderBy: [
        { createdAt: 'desc' },
        { id: 'desc' }
      ],
      take: limit + 1,
      include: {
        actor: {
          select: { id: true, fullName: true, email: true, avatar: true }
        }
      }
    };

    if (cursor) {
      queryArgs.cursor = { id: cursor };
      queryArgs.skip = 1;
    }

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    const activities = await prisma.activityLog.findMany(queryArgs);

    let nextCursor = null;
    if (activities.length > limit) {
      activities.pop();
      nextCursor = activities[activities.length - 1]?.id || null;
    }

    const items = activities.map((act) => ({
      id: act.id,
      projectId: act.projectId,
      actor: act.actor
        ? {
            id: act.actor.id,
            name: act.actor.fullName || act.actor.email || 'Người dùng',
            avatarUrl: act.actor.avatar || null,
            avatar: act.actor.avatar || null
          }
        : {
            id: null,
            name: 'Hệ thống',
            avatarUrl: null,
            avatar: null
          },
      action: act.action,
      targetType: act.targetType,
      targetId: act.targetId,
      targetTitle: act.targetTitle,
      meta: act.meta,
      createdAt: act.createdAt
    }));

    return res.json({ items, nextCursor });
  } catch (err) {
    console.error('Lỗi khi lấy Activity Feed của Project:', err);
    return res.status(500).json({ error: 'Lỗi máy chủ khi lấy danh sách hoạt động' });
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

