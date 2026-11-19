const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { getIO } = require('../socket');

// Auth middleware
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Không có token xác thực' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'mini_scrum_secret');
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token không hợp lệ hoặc đã hết hạn' });
  }
};

const getUserId = (req) => req.user?.userId || req.user?.id;

/**
 * Hàm serialize note dùng chung cho API và socket (SCRUM-74)
 * Trả {id, sessionId, column, content, createdAt, isAnonymous, isMine?, author?}
 * - isAnonymous = true: KHÔNG có author/authorId/tên/email trong payload với BẤT KỲ ai, kể cả Scrum Master/Admin.
 * - isAnonymous = false: trả author {id, name}.
 * - isMine tính theo người gọi API (khi có currentUserId). Socket broadcast không chứa isMine/authorId.
 */
function serializeRetroNote(note, currentUserId = null) {
  const isAnonymous = Boolean(note.isAnonymous);
  const result = {
    id: note.id,
    sessionId: note.sessionId,
    column: note.column,
    content: note.content,
    createdAt: note.createdAt,
    isAnonymous,
  };

  if (currentUserId !== null && currentUserId !== undefined) {
    result.isMine = Boolean(note.authorId && note.authorId === currentUserId);
  }

  if (!isAnonymous) {
    result.author = {
      id: note.author?.id || note.authorId,
      name: note.author?.fullName || note.author?.name || 'Thành viên',
    };
  }

  return result;
}

// Check if user is a member of the project
async function isProjectMember(userId, projectId) {
  if (!userId || !projectId) return false;
  const member = await prisma.projectMember.findFirst({
    where: {
      projectId,
      userId,
    },
  });
  if (member && (!member.status || member.status === 'ACCEPTED')) {
    return true;
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  return user?.role === 'ADMIN';
}

/**
 * POST /projects/:id/retros
 * Tạo buổi Retrospective mới
 */
router.post(['/projects/:id/retros', '/project/:id/retros'], authMiddleware, async (req, res) => {
  try {
    const projectId = req.params.id;
    const userId = getUserId(req);

    const isMember = await isProjectMember(userId, projectId);
    if (!isMember) {
      return res.status(403).json({ error: 'Bạn không có quyền truy cập dự án này' });
    }

    const { title, sprintId } = req.body;
    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'Tiêu đề buổi Retrospective không được để trống' });
    }

    let validSprintId = null;
    if (sprintId) {
      const sprint = await prisma.sprint.findFirst({
        where: { id: sprintId, projectId },
      });
      if (sprint) {
        validSprintId = sprint.id;
      }
    }

    const session = await prisma.retroSession.create({
      data: {
        projectId,
        sprintId: validSprintId,
        title: title.trim(),
        status: 'OPEN',
        createdById: userId,
      },
      include: {
        createdBy: {
          select: { id: true, fullName: true, email: true, avatar: true },
        },
        sprint: {
          select: { id: true, name: true },
        },
      },
    });

    return res.status(201).json(session);
  } catch (err) {
    console.error('Lỗi tạo buổi Retrospective:', err);
    return res.status(500).json({ error: 'Lỗi server khi tạo buổi Retrospective: ' + err.message });
  }
});

/**
 * GET /projects/:id/retros
 * Lấy danh sách buổi Retrospective trong project (mới nhất trước)
 */
router.get(['/projects/:id/retros', '/project/:id/retros'], authMiddleware, async (req, res) => {
  try {
    const projectId = req.params.id;
    const userId = getUserId(req);

    const isMember = await isProjectMember(userId, projectId);
    if (!isMember) {
      return res.status(403).json({ error: 'Bạn không có quyền truy cập dự án này' });
    }

    const sessions = await prisma.retroSession.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: {
          select: { id: true, fullName: true, email: true, avatar: true },
        },
        sprint: {
          select: { id: true, name: true },
        },
        _count: {
          select: { notes: true },
        },
      },
    });

    return res.json(sessions);
  } catch (err) {
    console.error('Lỗi lấy danh sách buổi Retrospective:', err);
    return res.status(500).json({ error: 'Lỗi server khi lấy danh sách buổi Retrospective' });
  }
});

/**
 * GET /retros/:id
 * Lấy chi tiết buổi Retrospective + notes, nhóm theo 3 cột
 */
router.get('/retros/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = getUserId(req);

    const session = await prisma.retroSession.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { id: true, fullName: true, email: true, avatar: true },
        },
        sprint: {
          select: { id: true, name: true },
        },
        notes: {
          orderBy: { createdAt: 'asc' },
          include: {
            author: {
              select: { id: true, fullName: true, email: true, avatar: true },
            },
          },
        },
      },
    });

    if (!session) {
      return res.status(404).json({ error: 'Không tìm thấy buổi Retrospective' });
    }

    const isMember = await isProjectMember(userId, session.projectId);
    if (!isMember) {
      return res.status(403).json({ error: 'Bạn không có quyền truy cập buổi Retrospective này' });
    }

    const columns = {
      WENT_WELL: [],
      TO_IMPROVE: [],
      ACTION_ITEM: [],
    };

    const serializedNotes = (session.notes || []).map((note) => serializeRetroNote(note, userId));

    serializedNotes.forEach((note) => {
      if (columns[note.column]) {
        columns[note.column].push(note);
      }
    });

    return res.json({
      ...session,
      notes: serializedNotes,
      columns,
    });
  } catch (err) {
    console.error('Lỗi lấy chi tiết buổi Retrospective:', err);
    return res.status(500).json({ error: 'Lỗi server khi lấy chi tiết buổi Retrospective' });
  }
});

/**
 * POST /retros/:id/notes
 * Thêm sticky note vào buổi Retrospective
 * content: 1-500 ký tự; isAnonymous: boolean; buổi CLOSED -> 400
 */
router.post('/retros/:id/notes', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = getUserId(req);

    const session = await prisma.retroSession.findUnique({
      where: { id },
    });

    if (!session) {
      return res.status(404).json({ error: 'Không tìm thấy buổi Retrospective' });
    }

    const isMember = await isProjectMember(userId, session.projectId);
    if (!isMember) {
      return res.status(403).json({ error: 'Bạn không có quyền truy cập buổi Retrospective này' });
    }

    if (session.status === 'CLOSED') {
      return res.status(400).json({ error: 'Buổi Retrospective đã kết thúc, không thể thêm ghi chú' });
    }

    const { column, content, isAnonymous } = req.body;
    const validColumns = ['WENT_WELL', 'TO_IMPROVE', 'ACTION_ITEM'];

    if (!column || !validColumns.includes(column)) {
      return res.status(400).json({ error: 'Cột không hợp lệ (WENT_WELL, TO_IMPROVE, ACTION_ITEM)' });
    }

    if (!content || typeof content !== 'string' || content.trim().length === 0 || content.trim().length > 500) {
      return res.status(400).json({ error: 'Nội dung ghi chú phải từ 1 đến 500 ký tự' });
    }

    const note = await prisma.retroNote.create({
      data: {
        sessionId: session.id,
        column,
        content: content.trim(),
        authorId: userId,
        isAnonymous: Boolean(isAnonymous),
      },
      include: {
        author: {
          select: { id: true, fullName: true, email: true, avatar: true },
        },
      },
    });

    // Realtime emit vào room project_{projectId}
    const io = getIO();
    if (io) {
      const socketPayload = serializeRetroNote(note); // không chứa isMine hay authorId nếu anonymous
      io.to(`project_${session.projectId}`).to(session.projectId).emit('RETRO_NOTE_CREATED', socketPayload);
    }

    return res.status(201).json(serializeRetroNote(note, userId));
  } catch (err) {
    console.error('Lỗi thêm sticky note Retrospective:', err);
    return res.status(500).json({ error: 'Lỗi server khi thêm sticky note: ' + err.message });
  }
});

/**
 * PATCH /retros/:id/notes/:noteId
 * Chỉnh sửa sticky note (chỉ tác giả, không đổi isAnonymous)
 */
router.patch('/retros/:id/notes/:noteId', authMiddleware, async (req, res) => {
  try {
    const { id, noteId } = req.params;
    const userId = getUserId(req);

    const note = await prisma.retroNote.findUnique({
      where: { id: noteId },
      include: {
        session: true,
        author: {
          select: { id: true, fullName: true, email: true, avatar: true },
        },
      },
    });

    if (!note || note.sessionId !== id) {
      return res.status(404).json({ error: 'Không tìm thấy ghi chú' });
    }

    const isMember = await isProjectMember(userId, note.session.projectId);
    if (!isMember) {
      return res.status(403).json({ error: 'Bạn không có quyền truy cập dự án này' });
    }

    if (note.authorId !== userId) {
      return res.status(403).json({ error: 'Chỉ tác giả mới có quyền chỉnh sửa ghi chú này' });
    }

    if (note.session.status === 'CLOSED') {
      return res.status(400).json({ error: 'Buổi Retrospective đã kết thúc, không thể chỉnh sửa ghi chú' });
    }

    const { content } = req.body;
    if (!content || typeof content !== 'string' || content.trim().length === 0 || content.trim().length > 500) {
      return res.status(400).json({ error: 'Nội dung ghi chú phải từ 1 đến 500 ký tự' });
    }

    const updatedNote = await prisma.retroNote.update({
      where: { id: noteId },
      data: {
        content: content.trim(),
        // Sửa không đổi isAnonymous
      },
      include: {
        author: {
          select: { id: true, fullName: true, email: true, avatar: true },
        },
      },
    });

    const io = getIO();
    if (io) {
      const socketPayload = serializeRetroNote(updatedNote);
      io.to(`project_${note.session.projectId}`).to(note.session.projectId).emit('RETRO_NOTE_UPDATED', socketPayload);
    }

    return res.json(serializeRetroNote(updatedNote, userId));
  } catch (err) {
    console.error('Lỗi cập nhật sticky note Retrospective:', err);
    return res.status(500).json({ error: 'Lỗi server khi cập nhật sticky note: ' + err.message });
  }
});

/**
 * DELETE /retros/:id/notes/:noteId
 * Xóa sticky note (chỉ tác giả)
 */
router.delete('/retros/:id/notes/:noteId', authMiddleware, async (req, res) => {
  try {
    const { id, noteId } = req.params;
    const userId = getUserId(req);

    const note = await prisma.retroNote.findUnique({
      where: { id: noteId },
      include: {
        session: true,
      },
    });

    if (!note || note.sessionId !== id) {
      return res.status(404).json({ error: 'Không tìm thấy ghi chú' });
    }

    const isMember = await isProjectMember(userId, note.session.projectId);
    if (!isMember) {
      return res.status(403).json({ error: 'Bạn không có quyền truy cập dự án này' });
    }

    if (note.authorId !== userId) {
      return res.status(403).json({ error: 'Chỉ tác giả mới có quyền xóa ghi chú này' });
    }

    if (note.session.status === 'CLOSED') {
      return res.status(400).json({ error: 'Buổi Retrospective đã kết thúc, không thể xóa ghi chú' });
    }

    await prisma.retroNote.delete({
      where: { id: noteId },
    });

    const io = getIO();
    if (io) {
      // DELETED chỉ cần { id }
      io.to(`project_${note.session.projectId}`).to(note.session.projectId).emit('RETRO_NOTE_DELETED', { id: noteId, sessionId: id });
    }

    return res.json({ message: 'Đã xóa ghi chú thành công', id: noteId });
  } catch (err) {
    console.error('Lỗi xóa sticky note Retrospective:', err);
    return res.status(500).json({ error: 'Lỗi server khi xóa sticky note: ' + err.message });
  }
});

/**
 * PATCH /retros/:id
 * Cập nhật trạng thái buổi (OPEN | CLOSED) hoặc tiêu đề
 */
router.patch('/retros/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = getUserId(req);

    const session = await prisma.retroSession.findUnique({
      where: { id },
    });

    if (!session) {
      return res.status(404).json({ error: 'Không tìm thấy buổi Retrospective' });
    }

    const isMember = await isProjectMember(userId, session.projectId);
    if (!isMember) {
      return res.status(403).json({ error: 'Bạn không có quyền truy cập buổi Retrospective này' });
    }

    const { status, title } = req.body;
    const updateData = {};

    if (status !== undefined) {
      if (!['OPEN', 'CLOSED'].includes(status)) {
        return res.status(400).json({ error: 'Trạng thái không hợp lệ (OPEN hoặc CLOSED)' });
      }
      updateData.status = status;
    }

    if (title !== undefined) {
      if (typeof title !== 'string' || !title.trim()) {
        return res.status(400).json({ error: 'Tiêu đề không được để trống' });
      }
      updateData.title = title.trim();
    }

    const updated = await prisma.retroSession.update({
      where: { id },
      data: updateData,
    });

    return res.json(updated);
  } catch (err) {
    console.error('Lỗi cập nhật buổi Retrospective:', err);
    return res.status(500).json({ error: 'Lỗi server khi cập nhật buổi Retrospective' });
  }
});

module.exports = router;
module.exports.serializeRetroNote = serializeRetroNote;

