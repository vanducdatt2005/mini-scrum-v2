const express = require('express');
const router = express.Router({ mergeParams: true });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const jwt = require('jsonwebtoken');

// Auth middleware cục bộ cho comment routes
const authMiddleware = (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
        return res.status(401).json({ error: "Không có token" });
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "mini_scrum_secret");
        req.user = decoded; // { userId, email, role }
        next();
    } catch (err) {
        res.status(401).json({ error: "Token không hợp lệ" });
    }
};

// Lấy bình luận của User Story
router.get('/userstory/:storyId/comments', async (req, res) => {
    try {
        const comments = await prisma.comment.findMany({
            where: { userStoryId: req.params.storyId },
            include: { user: { select: { fullName: true, email: true } } },
            orderBy: { createdAt: 'asc' }
        });
        res.json(comments);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Tạo bình luận mới (cần auth để lấy userId từ JWT)
router.post('/userstory/:storyId/comments', authMiddleware, async (req, res) => {
    const { content } = req.body;
    const { storyId } = req.params;

    if (!content || !content.trim()) {
        return res.status(400).json({ error: "Nội dung bình luận không được để trống" });
    }

    try {
        const comment = await prisma.comment.create({
            data: {
                content,
                userStoryId: storyId,
                userId: req.user.userId // Lấy từ JWT token (không phải req.user.id)
            },
            include: { user: { select: { fullName: true, email: true } } }
        });
        res.status(201).json(comment);
    } catch (error) {
        console.error("Lỗi tạo comment:", error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;