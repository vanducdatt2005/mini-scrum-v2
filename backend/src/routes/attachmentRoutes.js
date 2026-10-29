const express = require('express');
const router = express.Router();
const multer = require('multer');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const path = require('path');
const jwt = require('jsonwebtoken');

// Auth middleware cục bộ cho attachment routes
const authMiddleware = (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
        return res.status(401).json({ error: "Không có token" });
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "mini_scrum_secret");
        req.user = decoded;
        next();
    } catch (err) {
        res.status(401).json({ error: "Token không hợp lệ" });
    }
};

// Cấu hình lưu file vào thư mục /uploads
const storage = multer.diskStorage({
    destination: 'uploads/',
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage });

// API lấy danh sách file (hỗ trợ cả userStoryId và taskId)
router.get('/', async (req, res) => {
    const { userStoryId, taskId } = req.query;
    try {
        const where = {};
        if (userStoryId) where.userStoryId = userStoryId;
        if (taskId) where.taskId = taskId;

        const attachments = await prisma.attachment.findMany({
            where,
            orderBy: { createdAt: 'desc' }
        });
        res.json(attachments);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API upload file (cần auth để lấy userId)
router.post('/upload', authMiddleware, upload.single('file'), async (req, res) => {
    const { userStoryId, taskId } = req.body;
    try {
        if (!req.file) {
            return res.status(400).json({ error: "Không có file được gửi lên" });
        }

        const attachment = await prisma.attachment.create({
            data: {
                fileName: req.file.originalname,
                fileUrl: `/uploads/${req.file.filename}`,
                fileType: req.file.mimetype,
                fileSize: req.file.size,
                userId: req.user.userId,
                userStoryId: userStoryId || null,
                taskId: taskId || null
            }
        });
        res.status(201).json(attachment);
    } catch (error) {
        console.error("Lỗi upload attachment:", error);
        res.status(500).json({ error: error.message });
    }
});

// API xóa file
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        await prisma.attachment.delete({ where: { id: req.params.id } });
        res.json({ message: "Xóa file thành công" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
