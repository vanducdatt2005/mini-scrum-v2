const express = require('express');
const router = express.Router({ mergeParams: true });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const jwt = require('jsonwebtoken');
const { getIO } = require('../socket');

// Auth middleware cục bộ cho comment routes
const authMiddleware = (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
        // Cho phép fallback nếu có userId trong body để tương thích
        if (req.body?.userId || req.body?.authorId) {
            req.user = { userId: req.body.userId || req.body.authorId };
            return next();
        }
        return res.status(401).json({ error: "Không có token xác thực" });
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "mini_scrum_secret");
        req.user = decoded; // { userId, email, role }
        next();
    } catch (err) {
        if (req.body?.userId || req.body?.authorId) {
            req.user = { userId: req.body.userId || req.body.authorId };
            return next();
        }
        res.status(401).json({ error: "Token không hợp lệ hoặc đã hết hạn" });
    }
};

const userSelectFields = {
    id: true,
    fullName: true,
    email: true,
    avatar: true
};

// ============================================================
// 1. USER STORY COMMENTS
// ============================================================

// Lấy bình luận của User Story
router.get('/userstory/:storyId/comments', async (req, res) => {
    const { storyId } = req.params;
    try {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        const comments = await prisma.comment.findMany({
            where: { userStoryId: storyId },
            include: { user: { select: userSelectFields } },
            orderBy: { createdAt: 'asc' }
        });
        res.json(comments);
    } catch (error) {
        console.error("Lỗi lấy comment UserStory:", error);
        res.status(500).json({ error: error.message });
    }
});

// Tạo bình luận mới cho User Story
router.post('/userstory/:storyId/comments', authMiddleware, async (req, res) => {
    const { content } = req.body;
    const { storyId } = req.params;

    if (!content || !content.trim()) {
        return res.status(400).json({ error: "Nội dung bình luận không được để trống" });
    }

    try {
        const story = await prisma.userStory.findUnique({
            where: { id: storyId },
            select: { id: true, projectId: true, title: true }
        });

        if (!story) {
            return res.status(404).json({ error: "Không tìm thấy User Story" });
        }

        const comment = await prisma.comment.create({
            data: {
                content: content.trim(),
                userStoryId: storyId,
                userId: req.user.userId
            },
            include: { user: { select: userSelectFields } }
        });

        // Phát realtime qua Socket.io
        const io = getIO();
        if (io) {
            const payload = {
                action: "create",
                entityType: "story",
                entityId: storyId,
                projectId: story.projectId,
                comment
            };

            // Gửi vào phòng của story và phòng của dự án
            io.to(`story_${storyId}`).emit("comment:new", payload);
            io.to(`story_${storyId}`).emit("comment:changed", payload);
            if (story.projectId) {
                io.to(story.projectId).to(`project_${story.projectId}`).emit("comment:new", payload);
                io.to(story.projectId).to(`project_${story.projectId}`).emit("comment:changed", payload);
            }
            console.log(`📡 [Socket] Emitted comment:new for Story ${storyId}`);
        }

        res.status(201).json(comment);
    } catch (error) {
        console.error("Lỗi tạo comment UserStory:", error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// 2. TASK COMMENTS
// ============================================================

// Handler lấy bình luận Task
const getTaskCommentsHandler = async (req, res) => {
    const { taskId } = req.params;
    try {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        const comments = await prisma.comment.findMany({
            where: { taskId },
            include: { user: { select: userSelectFields } },
            orderBy: { createdAt: 'asc' }
        });
        res.json(comments);
    } catch (error) {
        console.error("Lỗi lấy comment Task:", error);
        res.status(500).json({ error: error.message });
    }
};

// Handler tạo bình luận Task
const createTaskCommentHandler = async (req, res) => {
    const { content } = req.body;
    const { taskId } = req.params;

    if (!content || !content.trim()) {
        return res.status(400).json({ error: "Nội dung bình luận không được để trống" });
    }

    try {
        const task = await prisma.task.findUnique({
            where: { id: taskId },
            include: { userStory: { select: { id: true, projectId: true } } }
        });

        if (!task) {
            return res.status(404).json({ error: "Không tìm thấy Task" });
        }

        const comment = await prisma.comment.create({
            data: {
                content: content.trim(),
                taskId: taskId,
                userId: req.user.userId
            },
            include: { user: { select: userSelectFields } }
        });

        const projectId = task.userStory?.projectId;

        // Phát realtime qua Socket.io
        const io = getIO();
        if (io) {
            const payload = {
                action: "create",
                entityType: "task",
                entityId: taskId,
                projectId,
                comment
            };

            // Gửi vào phòng của task và phòng của dự án
            io.to(`task_${taskId}`).emit("comment:new", payload);
            io.to(`task_${taskId}`).emit("comment:changed", payload);
            if (projectId) {
                io.to(projectId).to(`project_${projectId}`).emit("comment:new", payload);
                io.to(projectId).to(`project_${projectId}`).emit("comment:changed", payload);
            }
            console.log(`📡 [Socket] Emitted comment:new for Task ${taskId}`);
        }

        res.status(201).json(comment);
    } catch (error) {
        console.error("Lỗi tạo comment Task:", error);
        res.status(500).json({ error: error.message });
    }
};

// Hỗ trợ cả 2 dạng endpoint phổ biến: /tasks/:taskId/comments và /task/:taskId/comments
router.get('/tasks/:taskId/comments', getTaskCommentsHandler);
router.get('/task/:taskId/comments', getTaskCommentsHandler);
router.post('/tasks/:taskId/comments', authMiddleware, createTaskCommentHandler);
router.post('/task/:taskId/comments', authMiddleware, createTaskCommentHandler);

// ============================================================
// 3. XÓA BÌNH LUẬN (DELETE COMMENT)
// ============================================================
router.delete('/comments/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const currentUserId = req.user.userId;

    try {
        const comment = await prisma.comment.findUnique({
            where: { id },
            include: {
                userStory: { select: { projectId: true } },
                task: { include: { userStory: { select: { projectId: true } } } }
            }
        });

        if (!comment) {
            return res.status(404).json({ error: "Không tìm thấy bình luận" });
        }

        const projectId = comment.userStory?.projectId || comment.task?.userStory?.projectId;

        // Cho phép xóa nếu là người viết bình luận hoặc là PO/SM của dự án
        let canDelete = comment.userId === currentUserId;
        if (!canDelete && projectId) {
            const member = await prisma.projectMember.findUnique({
                where: { userId_projectId: { userId: currentUserId, projectId } }
            });
            if (member && (member.role === 'PO' || member.role === 'SM')) {
                canDelete = true;
            }
        }

        if (!canDelete) {
            return res.status(403).json({ error: "Bạn không có quyền xóa bình luận này" });
        }

        await prisma.comment.delete({ where: { id } });

        // Phát realtime xóa bình luận qua Socket.io
        const io = getIO();
        if (io) {
            const payload = {
                action: "delete",
                commentId: id,
                entityType: comment.userStoryId ? "story" : "task",
                entityId: comment.userStoryId || comment.taskId,
                projectId
            };

            if (comment.userStoryId) {
                io.to(`story_${comment.userStoryId}`).emit("comment:deleted", payload);
                io.to(`story_${comment.userStoryId}`).emit("comment:changed", payload);
            }
            if (comment.taskId) {
                io.to(`task_${comment.taskId}`).emit("comment:deleted", payload);
                io.to(`task_${comment.taskId}`).emit("comment:changed", payload);
            }
            if (projectId) {
                io.to(projectId).to(`project_${projectId}`).emit("comment:deleted", payload);
                io.to(projectId).to(`project_${projectId}`).emit("comment:changed", payload);
            }
        }

        res.json({ message: "Đã xóa bình luận thành công", commentId: id });
    } catch (error) {
        console.error("Lỗi xóa comment:", error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
