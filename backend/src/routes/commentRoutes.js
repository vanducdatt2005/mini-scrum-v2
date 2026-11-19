const { recordActivity, logActivity } = require('../services/activityService');
const express = require('express');
const router = express.Router({ mergeParams: true });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getIO } = require('../socket');
const { 
  extractMentionedUserIds, 
  sendMentionNotifications, 
  handleCommentEditMentions 
} = require('../services/commentMentionService');

// ============================================================
// CẤU HÌNH MULTER CHO ĐÍNH KÈM FILE TRONG BÌNH LUẬN
// ============================================================
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const cleanName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    cb(null, `${Date.now()}-${Math.random().toString(36).substring(2, 8)}-${cleanName}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB
});

// ============================================================
// AUTH MIDDLEWARE
// ============================================================
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
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

const optionalAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "mini_scrum_secret");
      req.user = decoded;
    } catch (e) {
      // Ignored for optional
    }
  }
  next();
};

const userSelectFields = {
  id: true,
  fullName: true,
  email: true,
  avatar: true
};

// ============================================================
// HELPER PHÂN QUYỀN VÀ KIỂM TRA THÀNH VIÊN DỰ ÁN
// ============================================================
async function checkTaskMembership(userId, taskId) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      userStory: {
        select: {
          id: true,
          title: true,
          projectId: true,
          project: { select: { id: true, name: true } }
        }
      }
    }
  });

  if (!task) return null;

  const projectId = task.userStory?.projectId;
  const projectName = task.userStory?.project?.name || 'Dự án';
  let isMember = false;
  let memberRole = null;

  if (userId && projectId) {
    const member = await prisma.projectMember.findFirst({
      where: {
        userId,
        projectId,
        status: 'ACCEPTED'
      }
    });
    if (member) {
      isMember = true;
      memberRole = member.role;
    } else {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
      if (user && user.role === 'ADMIN') {
        isMember = true;
        memberRole = 'ADMIN';
      }
    }
  }

  return {
    task,
    projectId,
    projectName,
    isMember,
    memberRole
  };
}

async function checkStoryMembership(userId, storyId) {
  const story = await prisma.userStory.findUnique({
    where: { id: storyId },
    select: {
      id: true,
      title: true,
      projectId: true,
      project: { select: { id: true, name: true } }
    }
  });

  if (!story) return null;

  const projectId = story.projectId;
  const projectName = story.project?.name || 'Dự án';
  let isMember = false;
  let memberRole = null;

  if (userId && projectId) {
    const member = await prisma.projectMember.findFirst({
      where: {
        userId,
        projectId,
        status: 'ACCEPTED'
      }
    });
    if (member) {
      isMember = true;
      memberRole = member.role;
    } else {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
      if (user && user.role === 'ADMIN') {
        isMember = true;
        memberRole = 'ADMIN';
      }
    }
  }

  return {
    story,
    projectId,
    projectName,
    isMember,
    memberRole
  };
}

// ============================================================
// 1. UPLOAD FILE ĐÍNH KÈM BÌNH LUẬN
// ============================================================
router.post('/comments/upload-attachment', authMiddleware, upload.array('files', 5), async (req, res) => {
  try {
    const files = req.files || (req.file ? [req.file] : []);
    if (!files || files.length === 0) {
      return res.status(400).json({ error: "Không có file nào được tải lên" });
    }

    const createdAttachments = [];
    for (const f of files) {
      const att = await prisma.attachment.create({
        data: {
          fileName: f.originalname,
          fileUrl: `/uploads/${f.filename}`,
          fileType: f.mimetype,
          fileSize: f.size,
          userId: req.user.userId
        }
      });
      createdAttachments.push(att);
    }

    res.status(201).json(createdAttachments.length === 1 ? createdAttachments[0] : createdAttachments);
  } catch (error) {
    console.error("Lỗi upload comment attachment:", error);
    res.status(500).json({ error: error.message || "Lỗi khi tải lên file" });
  }
});

// ============================================================
// 2. TASK COMMENTS (GET & POST)
// ============================================================

const getTaskCommentsHandler = async (req, res) => {
  const { taskId } = req.params;
  const { cursor, limit = 20 } = req.query;
  const take = Math.min(Math.max(parseInt(limit) || 20, 1), 50);

  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');

    const check = await checkTaskMembership(req.user?.userId, taskId);
    if (!check) {
      return res.status(404).json({ error: "Không tìm thấy Task" });
    }

    // Nếu có token user nhưng không phải thành viên -> 403
    if (req.user?.userId && !check.isMember) {
      return res.status(403).json({ error: "Bạn không phải thành viên của dự án chứa Task này" });
    }

    const where = { taskId };
    const queryOptions = {
      where,
      include: {
        user: { select: userSelectFields },
        attachments: {
          select: {
            id: true,
            fileName: true,
            fileUrl: true,
            fileType: true,
            fileSize: true,
            createdAt: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    };

    if (cursor) {
      queryOptions.take = take;
      queryOptions.skip = 1;
      queryOptions.cursor = { id: cursor };
    }

    const comments = await prisma.comment.findMany(queryOptions);

    let nextCursor = null;
    if (comments.length === take) {
      nextCursor = comments[comments.length - 1].id;
    }

    if (req.query.paginate === 'true' || req.query.cursor) {
      return res.json({ comments, nextCursor });
    }

    res.json(comments);
  } catch (error) {
    console.error("Lỗi lấy comment Task:", error);
    res.status(500).json({ error: error.message });
  }
};

const createTaskCommentHandler = async (req, res) => {
  const { taskId } = req.params;
  const { content, attachmentIds = [] } = req.body;
  const userId = req.user.userId;

  if (!content || !content.trim()) {
    return res.status(400).json({ error: "Nội dung bình luận không được để trống" });
  }

  try {
    const check = await checkTaskMembership(userId, taskId);
    if (!check) {
      return res.status(404).json({ error: "Không tìm thấy Task" });
    }

    // Guard: Kiểm tra người dùng phải là thành viên của dự án (DoD Security)
    if (!check.isMember) {
      return res.status(403).json({ error: "Chỉ thành viên của dự án mới có quyền bình luận!" });
    }

    // Bóc tách danh sách @mention và loại bỏ trùng lặp / sender
    const mentionedUserIds = extractMentionedUserIds(content, userId);

    const comment = await prisma.comment.create({
      data: {
        content: content.trim(),
        taskId: taskId,
        entityType: 'TASK',
        entityId: taskId,
        userId: userId,
        mentionedUserIds: mentionedUserIds,
        isEdited: false
      },
      include: {
        user: { select: userSelectFields },
        attachments: true
      }
    });

    // Nếu có file attachments gửi kèm, gán commentId
    if (Array.isArray(attachmentIds) && attachmentIds.length > 0) {
      await prisma.attachment.updateMany({
        where: { id: { in: attachmentIds } },
        data: { commentId: comment.id, taskId: taskId }
      });
      comment.attachments = await prisma.attachment.findMany({
        where: { commentId: comment.id }
      });
    }

    const projectId = check.projectId;
    const io = getIO();

    if (io) {
      const payload = {
        action: "create",
        entityType: "TASK",
        entityId: taskId,
        projectId,
        comment
      };

      // AC4: Phát sự kiện COMMENT_CREATED và comment:new vào room task và project
      io.to(`task_${taskId}`).emit("COMMENT_CREATED", payload);
      io.to(`task_${taskId}`).emit("comment:new", payload);
      io.to(`task_${taskId}`).emit("comment:changed", payload);

      if (projectId) {
        io.to(projectId).to(`project_${projectId}`).emit("COMMENT_CREATED", payload);
        io.to(projectId).to(`project_${projectId}`).emit("comment:new", payload);
        io.to(projectId).to(`project_${projectId}`).emit("comment:changed", payload);
      }
      console.log(`📡 [Socket] Emitted COMMENT_CREATED for Task ${taskId}`);
    }

    if (projectId) {
      logActivity({
        projectId,
        actorId: userId,
        action: 'COMMENT_ADDED',
        targetType: 'COMMENT',
        targetId: comment.id,
        targetTitle: check.task?.title || 'Task',
        meta: { taskId, content: comment.content?.substring(0, 50) }
      }).catch(e => console.error(e));
    }

    // Gửi thông báo @mention cho những người được tag
    const author = await prisma.user.findUnique({
      where: { id: userId },
      select: userSelectFields
    });

    sendMentionNotifications({
      comment,
      mentionedUserIds,
      author,
      entityType: 'TASK',
      entityId: taskId,
      taskTitle: check.task.title,
      projectName: check.projectName,
      projectId: check.projectId,
      injectedIO: io
    }).catch(err => console.error("Mention notify error:", err));

    // Ghi Activity Log (AC1, DoD)
    recordActivity({
      entityType: 'TASK',
      entityId: taskId,
      actorId: userId,
      actionType: 'COMMENT_ADDED',
      changesPayload: {
        commentId: comment.id,
        content: comment.content,
        mentionedUserIds
      }
    });

    res.status(201).json(comment);
  } catch (error) {
    console.error("Lỗi tạo comment Task:", error);
    res.status(500).json({ error: error.message });
  }
};

router.get('/tasks/:taskId/comments', optionalAuth, getTaskCommentsHandler);
router.get('/task/:taskId/comments', optionalAuth, getTaskCommentsHandler);
router.post('/tasks/:taskId/comments', authMiddleware, createTaskCommentHandler);
router.post('/task/:taskId/comments', authMiddleware, createTaskCommentHandler);

// ============================================================
// 3. USER STORY COMMENTS (GET & POST)
// ============================================================

router.get('/userstory/:storyId/comments', optionalAuth, async (req, res) => {
  const { storyId } = req.params;
  const { cursor, limit = 20 } = req.query;
  const take = Math.min(Math.max(parseInt(limit) || 20, 1), 50);

  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');

    const check = await checkStoryMembership(req.user?.userId, storyId);
    if (!check) {
      return res.status(404).json({ error: "Không tìm thấy User Story" });
    }

    if (req.user?.userId && !check.isMember) {
      return res.status(403).json({ error: "Bạn không phải thành viên của dự án chứa User Story này" });
    }

    const queryOptions = {
      where: { userStoryId: storyId },
      include: {
        user: { select: userSelectFields },
        attachments: {
          select: {
            id: true,
            fileName: true,
            fileUrl: true,
            fileType: true,
            fileSize: true,
            createdAt: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    };

    if (cursor) {
      queryOptions.take = take;
      queryOptions.skip = 1;
      queryOptions.cursor = { id: cursor };
    }

    const comments = await prisma.comment.findMany(queryOptions);

    let nextCursor = null;
    if (comments.length === take) {
      nextCursor = comments[comments.length - 1].id;
    }

    if (req.query.paginate === 'true' || req.query.cursor) {
      return res.json({ comments, nextCursor });
    }

    res.json(comments);
  } catch (error) {
    console.error("Lỗi lấy comment UserStory:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/userstory/:storyId/comments', authMiddleware, async (req, res) => {
  const { storyId } = req.params;
  const { content, attachmentIds = [] } = req.body;
  const userId = req.user.userId;

  if (!content || !content.trim()) {
    return res.status(400).json({ error: "Nội dung bình luận không được để trống" });
  }

  try {
    const check = await checkStoryMembership(userId, storyId);
    if (!check) {
      return res.status(404).json({ error: "Không tìm thấy User Story" });
    }

    // Guard: Kiểm tra người dùng phải là thành viên của dự án (DoD Security)
    if (!check.isMember) {
      return res.status(403).json({ error: "Chỉ thành viên của dự án mới có quyền bình luận!" });
    }

    const mentionedUserIds = extractMentionedUserIds(content, userId);

    const comment = await prisma.comment.create({
      data: {
        content: content.trim(),
        userStoryId: storyId,
        entityType: 'USER_STORY',
        entityId: storyId,
        userId: userId,
        mentionedUserIds: mentionedUserIds,
        isEdited: false
      },
      include: {
        user: { select: userSelectFields },
        attachments: true
      }
    });

    if (Array.isArray(attachmentIds) && attachmentIds.length > 0) {
      await prisma.attachment.updateMany({
        where: { id: { in: attachmentIds } },
        data: { commentId: comment.id, userStoryId: storyId }
      });
      comment.attachments = await prisma.attachment.findMany({
        where: { commentId: comment.id }
      });
    }

    const projectId = check.projectId;
    const io = getIO();

    if (io) {
      const payload = {
        action: "create",
        entityType: "USER_STORY",
        entityId: storyId,
        projectId,
        comment
      };

      io.to(`story_${storyId}`).emit("COMMENT_CREATED", payload);
      io.to(`story_${storyId}`).emit("comment:new", payload);
      io.to(`story_${storyId}`).emit("comment:changed", payload);

      if (projectId) {
        io.to(projectId).to(`project_${projectId}`).emit("COMMENT_CREATED", payload);
        io.to(projectId).to(`project_${projectId}`).emit("comment:new", payload);
        io.to(projectId).to(`project_${projectId}`).emit("comment:changed", payload);
      }
      console.log(`📡 [Socket] Emitted COMMENT_CREATED for Story ${storyId}`);
    }

    if (projectId) {
      logActivity({
        projectId,
        actorId: userId,
        action: 'COMMENT_ADDED',
        targetType: 'COMMENT',
        targetId: comment.id,
        targetTitle: check.story?.title || 'User Story',
        meta: { storyId, content: comment.content?.substring(0, 50) }
      }).catch(e => console.error(e));
    }

    const author = await prisma.user.findUnique({
      where: { id: userId },
      select: userSelectFields
    });

    sendMentionNotifications({
      comment,
      mentionedUserIds,
      author,
      entityType: 'USER_STORY',
      entityId: storyId,
      taskTitle: check.story.title,
      projectName: check.projectName,
      projectId: check.projectId,
      injectedIO: io
    }).catch(err => console.error("Mention notify error:", err));

    recordActivity({
      entityType: 'USER_STORY',
      entityId: storyId,
      actorId: userId,
      actionType: 'COMMENT_ADDED',
      changesPayload: {
        commentId: comment.id,
        content: comment.content,
        mentionedUserIds
      }
    });

    res.status(201).json(comment);
  } catch (error) {
    console.error("Lỗi tạo comment UserStory:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// 4. SỬA BÌNH LUẬN (PATCH /api/comments/:id) - AC3
// ============================================================
router.patch('/comments/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { content } = req.body;
  const currentUserId = req.user.userId;

  if (!content || !content.trim()) {
    return res.status(400).json({ error: "Nội dung bình luận không được để trống" });
  }

  try {
    const existingComment = await prisma.comment.findUnique({
      where: { id },
      include: {
        userStory: {
          select: { id: true, title: true, projectId: true, project: { select: { id: true, name: true } } }
        },
        task: {
          include: {
            userStory: {
              select: { id: true, title: true, projectId: true, project: { select: { id: true, name: true } } }
            }
          }
        },
        user: { select: userSelectFields },
        attachments: true
      }
    });

    if (!existingComment) {
      return res.status(404).json({ error: "Không tìm thấy bình luận" });
    }

    // Quyền Sửa (Edit): Chỉ DUY NHẤT tác giả mới được sửa (AC3 & DoD)
    if (existingComment.userId !== currentUserId) {
      return res.status(403).json({ error: "Chỉ người viết bình luận mới có quyền chỉnh sửa!" });
    }

    const isTask = Boolean(existingComment.taskId);
    const entityType = isTask ? 'TASK' : 'USER_STORY';
    const entityId = existingComment.taskId || existingComment.userStoryId;
    const taskTitle = isTask ? existingComment.task?.title : existingComment.userStory?.title;
    const projectId = existingComment.userStory?.projectId || existingComment.task?.userStory?.projectId;
    const projectName = existingComment.userStory?.project?.name || existingComment.task?.userStory?.project?.name;

    const io = getIO();

    // Xử lý @Mention khi sửa: Chỉ gửi thông báo cho những người MỚI ĐƯỢC TAG THÊM (AC2 & DoD)
    const updatedMentionedUserIds = await handleCommentEditMentions({
      comment: existingComment,
      oldMentionedUserIds: existingComment.mentionedUserIds || [],
      newContent: content.trim(),
      author: existingComment.user,
      entityType,
      entityId,
      taskTitle,
      projectName,
      projectId,
      injectedIO: io
    });

    // Cập nhật bình luận: bật cờ is_edited = true và cập nhật updated_at
    const updatedComment = await prisma.comment.update({
      where: { id },
      data: {
        content: content.trim(),
        mentionedUserIds: updatedMentionedUserIds,
        isEdited: true,
        updatedAt: new Date()
      },
      include: {
        user: { select: userSelectFields },
        attachments: true
      }
    });

    // Phát sự kiện realtime COMMENT_UPDATED tới Entity room và Project room
    if (io) {
      const payload = {
        action: "update",
        commentId: id,
        entityType,
        entityId,
        projectId,
        comment: updatedComment
      };

      const roomPrefix = isTask ? `task_${entityId}` : `story_${entityId}`;
      io.to(roomPrefix).emit("COMMENT_UPDATED", payload);
      io.to(roomPrefix).emit("comment:changed", payload);

      if (projectId) {
        io.to(projectId).to(`project_${projectId}`).emit("COMMENT_UPDATED", payload);
        io.to(projectId).to(`project_${projectId}`).emit("comment:changed", payload);
      }
      console.log(`📡 [Socket] Emitted COMMENT_UPDATED for ${entityType} ${entityId}`);
    }

    // Ghi Activity Log
    recordActivity({
      entityType,
      entityId,
      actorId: currentUserId,
      actionType: 'COMMENT_UPDATED',
      changesPayload: {
        commentId: id,
        old_content: existingComment.content,
        new_content: updatedComment.content
      }
    });

    res.json(updatedComment);
  } catch (error) {
    console.error("Lỗi cập nhật comment:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// 5. XÓA BÌNH LUẬN (DELETE /api/comments/:id) - AC3
// ============================================================
router.delete('/comments/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const currentUserId = req.user.userId;

  try {
    const comment = await prisma.comment.findUnique({
      where: { id },
      include: {
        userStory: { select: { id: true, projectId: true } },
        task: { include: { userStory: { select: { id: true, projectId: true } } } }
      }
    });

    if (!comment) {
      return res.status(404).json({ error: "Không tìm thấy bình luận" });
    }

    const projectId = comment.userStory?.projectId || comment.task?.userStory?.projectId;
    const isTask = Boolean(comment.taskId);
    const entityType = isTask ? 'TASK' : 'USER_STORY';
    const entityId = comment.taskId || comment.userStoryId;

    // Quyền Xóa: Tác giả HOẶC ADMIN / PROJECT_LEADER / PO / SM trong dự án (AC3)
    let canDelete = comment.userId === currentUserId;
    if (!canDelete) {
      if (req.user.role === 'ADMIN') {
        canDelete = true;
      } else if (projectId) {
        const member = await prisma.projectMember.findFirst({
          where: {
            userId: currentUserId,
            projectId,
            status: 'ACCEPTED'
          }
        });
        if (member && ['PO', 'SM', 'ADMIN', 'PROJECT_LEADER', 'LEADER'].includes(member.role)) {
          canDelete = true;
        }
      }
    }

    if (!canDelete) {
      return res.status(403).json({ error: "Bạn không có quyền xóa bình luận này! Chỉ tác giả hoặc Quản lý dự án mới có quyền." });
    }

    // Xóa comment (quan hệ Cascade trong DB sẽ xóa file attachment liên quan)
    await prisma.comment.delete({ where: { id } });

    // Ghi Activity Log
    recordActivity({
      entityType,
      entityId,
      actorId: currentUserId,
      actionType: 'COMMENT_DELETED',
      changesPayload: {
        commentId: id,
        content: comment.content
      }
    });

    // Phát sự kiện realtime COMMENT_DELETED
    const io = getIO();
    if (io) {
      const payload = {
        action: "delete",
        commentId: id,
        entityType,
        entityId,
        projectId
      };

      const roomPrefix = isTask ? `task_${entityId}` : `story_${entityId}`;
      io.to(roomPrefix).emit("COMMENT_DELETED", payload);
      io.to(roomPrefix).emit("comment:deleted", payload);
      io.to(roomPrefix).emit("comment:changed", payload);

      if (projectId) {
        io.to(projectId).to(`project_${projectId}`).emit("COMMENT_DELETED", payload);
        io.to(projectId).to(`project_${projectId}`).emit("comment:deleted", payload);
        io.to(projectId).to(`project_${projectId}`).emit("comment:changed", payload);
      }
      console.log(`🗑️ [Socket] Emitted COMMENT_DELETED for ${entityType} ${entityId}`);
    }

    res.json({ message: "Đã xóa bình luận thành công", commentId: id });
  } catch (error) {
    console.error("Lỗi xóa comment:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
