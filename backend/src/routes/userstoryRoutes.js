// backend/src/routes/userstoryRoutes.js
const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// === HÀM HỖ TRỢ ===
// 3. Xử lý tags: parse từ chuỗi JSON ("[\"tag\"]") sang Array thật
const formatUserStory = (story) => {
  if (!story) return story;
  let parsedTags = [];
  if (story.tags) {
    try {
      parsedTags = Array.isArray(story.tags) ? story.tags : JSON.parse(story.tags);
    } catch (e) {
      parsedTags = [];
    }
  }
  return { ...story, tags: parsedTags };
};

// Tạo mới User Story
router.post('/', async (req, res) => {
  try {
    const { title, description, storyPoints, priority, status = "BACKLOG", projectId, tags } = req.body;

    if (!title || !projectId) {
      return res.status(400).json({ error: "Thiếu title hoặc projectId" });
    }

    const userStory = await prisma.userStory.create({
      data: {
        title,
        description: description || null,
        storyPoints: storyPoints ? parseInt(storyPoints) : 0,
        priority: priority || "MEDIUM",
        status: status,
        projectId,
        tags: tags ? JSON.stringify(tags) : "[]", // Lưu dạng string
      },
      // 2. Lấy đầy đủ thông tin assignee (Dùng 'true' để không bị lỗi nếu thiếu cột avatar)
      include: {
        assignee: true 
      }
    });

    res.status(201).json(formatUserStory(userStory));
  } catch (err) {
    console.error("Lỗi tạo UserStory:", err);
    res.status(500).json({ 
      error: "Không thể tạo User Story", 
      message: err.message 
    });
  }
});

// Lấy tất cả User Story theo Project (dùng cho Backlog page) - US-051
router.get('/project/:projectId/userstories', async (req, res) => {
  try {
    const { projectId } = req.params;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const size = Math.min(50, Math.max(5, parseInt(req.query.size) || 12));
    const search = req.query.search?.trim() || '';
    const priority = req.query.priority || 'ALL';
    const status = req.query.status || 'ALL';
    const tag = req.query.tag || 'ALL';

    const skip = (page - 1) * size;

    // 1. Logic Where được bọc cẩn thận bằng AND
    const andConditions = [{ projectId: projectId }];

    if (search) {
      andConditions.push({
        OR: [
          { title: { contains: search } }, // Bỏ mode: insensitive để không lỗi SQLite
          { description: { contains: search } },
        ]
      });
    }

    if (priority !== 'ALL') andConditions.push({ priority });
    if (status !== 'ALL') andConditions.push({ status });
    if (tag !== 'ALL') andConditions.push({ tags: { contains: `"${tag}"` } });

    const where = { AND: andConditions };

    const totalElements = await prisma.userStory.count({ where });

    const stories = await prisma.userStory.findMany({
      where,
      // 2. Trả về toàn bộ data của assignee
      include: {
        assignee: true 
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: size,
    });

    const totalPages = Math.ceil(totalElements / size);

    res.json({
      content: stories.map(formatUserStory), // 3. Parse tags sang Array
      pagination: {
        page,
        size,
        totalElements,
        totalPages,
        first: page === 1,
        last: page === totalPages || totalPages === 0,
      }
    });

  } catch (err) {
    console.error("Lỗi load UserStories với phân trang:", err);
    res.status(500).json({ 
      error: "Không thể tải danh sách User Story", 
      message: err.message 
    });
  }
});

// Cập nhật User Story
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, storyPoints, priority, status, assigneeId, tags } = req.body;

    const dataToUpdate = {
      title: title !== undefined ? title : undefined,
      description: description !== undefined ? description : undefined,
      storyPoints: storyPoints !== undefined ? parseInt(storyPoints) : undefined,
      priority: priority !== undefined ? priority : undefined,
      status: status !== undefined ? status : undefined,
      assigneeId: assigneeId !== undefined ? assigneeId : undefined,
    };

    if (tags !== undefined) dataToUpdate.tags = JSON.stringify(tags);

    const updated = await prisma.userStory.update({
      where: { id },
      data: dataToUpdate,
      include: {
        assignee: true
      }
    });

    res.json(formatUserStory(updated));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Xóa User Story
router.delete('/:id', async (req, res) => {
  try {
    await prisma.userStory.delete({ where: { id: req.params.id } });
    res.json({ message: "User Story đã được xóa" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/user-stories/backlog - US-051 Server-side Pagination cho Product Backlog
router.get('/backlog', async (req, res) => {
  try {
    const { 
      projectId, 
      page = 1, 
      size = 12, 
      search = '', 
      priority, 
      status, 
      tag 
    } = req.query;

    if (!projectId) {
      return res.status(400).json({ message: 'Thiếu projectId' });
    }

    const pageNum = parseInt(page);
    const pageSize = Math.min(parseInt(size) || 12, 50);
    const skip = (pageNum - 1) * pageSize;

    // 1. ==================== XÂY DỰNG WHERE CHẶT CHẼ BẰNG AND ====================
    const andConditions = [
      { projectId },
      { OR: [{ sprintId: null }, { status: "BACKLOG" }] }
    ];

    if (search.trim()) {
      andConditions.push({
        OR: [
          { title: { contains: search.trim() } }, // Bỏ mode: insensitive
          { description: { contains: search.trim() } }
        ]
      });
    }

    if (priority && priority !== 'ALL') andConditions.push({ priority });
    if (status && status !== 'ALL') andConditions.push({ status });
    if (tag && tag !== 'ALL') andConditions.push({ tags: { contains: `"${tag}"` } });

    const where = { AND: andConditions };

    // ==================== QUERY ====================
    const [content, totalElements] = await Promise.all([
      prisma.userStory.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [
          { backlogOrder: 'asc' },
          { id: 'asc' }
        ],
        // 2. Đầy đủ assignee
        include: {
          assignee: true
        }
      }),
      prisma.userStory.count({ where })
    ]);

    const totalPages = Math.ceil(totalElements / pageSize);

    // Lấy tất cả tags cho filter
    const allTagsResult = await prisma.userStory.findMany({
      where: { projectId },
      select: { tags: true }
    });

    const allTags = [...new Set(
      allTagsResult.flatMap(s => {
        if (!s.tags) return [];
        try {
          return Array.isArray(s.tags) ? s.tags : JSON.parse(s.tags || '[]');
        } catch {
          return [];
        }
      })
    )].sort();

    res.json({
      content: content.map(formatUserStory), // 3. Trả về tags dạng Array thật
      pagination: {
        page: pageNum,
        size: pageSize,
        totalElements,
        totalPages,
        // 4. Định danh rõ ràng là dữ liệu Product Backlog
        isProductBacklog: true,
        context: "BACKLOG_VIEW"
      },
      allTags
    });

  } catch (error) {
    console.error("Lỗi khi tải Product Backlog:", error);
    res.status(500).json({ 
      message: 'Lỗi khi tải Product Backlog',
      error: error.message 
    });
  }
});
// ==================== TASK COMMENTS - US-046 ====================

// Lấy tất cả comment của Task
router.get('/tasks/:taskId/comments', async (req, res) => {
  try {
    const { taskId } = req.params;

    const comments = await prisma.comment.findMany({
      where: { taskId },
      include: {
        user: {
          select: { id: true, fullName: true, email: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    res.json(comments);
  } catch (error) {
    console.error("Lỗi lấy comment Task:", error);
    res.status(500).json({ error: error.message });
  }
});

// Tạo comment mới cho Task
router.post('/tasks/:taskId/comments', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { content, authorId } = req.body;

    if (!content?.trim() || !authorId) {
      return res.status(400).json({ error: "Thiếu nội dung hoặc authorId" });
    }

    const comment = await prisma.comment.create({
      data: {
        content: content.trim(),
        userId: authorId,
        taskId: taskId,
      },
      include: {
        user: {
          select: { id: true, fullName: true, email: true }
        }
      }
    });

    res.status(201).json(comment);
  } catch (error) {
    console.error("Lỗi tạo comment Task:", error);
    res.status(500).json({ error: error.message });
  }
});
module.exports = router;