const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead
} = require('../services/notificationService');

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
 * 1. GET /api/notifications
 * Lấy danh sách thông báo của user hiện tại, sắp xếp mới nhất lên đầu kèm unread_count
 */
router.get('/notifications', authMiddleware, async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    const result = await getUserNotifications(req.user.userId);
    res.json(result);
  } catch (err) {
    console.error('Lỗi lấy danh sách thông báo:', err);
    res.status(500).json({ error: 'Lỗi máy chủ khi lấy danh sách thông báo' });
  }
});

/**
 * 3. PATCH /api/notifications/read-all
 * Đánh dấu tất cả thông báo chưa đọc của user thành đã đọc
 * (Đặt trước route :id/read để tránh xung đột params)
 */
router.patch('/notifications/read-all', authMiddleware, async (req, res) => {
  try {
    const result = await markAllNotificationsAsRead(req.user.userId);
    res.json({
      message: 'Đã đánh dấu tất cả thông báo là đã đọc',
      updated_count: result.count
    });
  } catch (err) {
    console.error('Lỗi đánh dấu tất cả thông báo đã đọc:', err);
    res.status(500).json({ error: 'Lỗi máy chủ khi cập nhật thông báo' });
  }
});

// Alias cho các biến thể đặt tên khác
router.patch('/notifications/mark-all-read', authMiddleware, async (req, res) => {
  try {
    const result = await markAllNotificationsAsRead(req.user.userId);
    res.json({
      message: 'Đã đánh dấu tất cả thông báo là đã đọc',
      updated_count: result.count
    });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

/**
 * 2. PATCH /api/notifications/:id/read
 * Đánh dấu 1 thông báo là đã đọc
 */
router.patch('/notifications/:id/read', authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    await markNotificationAsRead(id, req.user.userId);
    res.json({ message: 'Đã đánh dấu thông báo là đã đọc', id });
  } catch (err) {
    console.error('Lỗi cập nhật thông báo:', err);
    res.status(500).json({ error: 'Lỗi máy chủ khi cập nhật thông báo' });
  }
});

module.exports = router;

