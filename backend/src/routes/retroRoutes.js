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

// Hằng số cấu hình giới hạn số phiếu bầu / người / buổi (SCRUM-75)
const MAX_VOTES = 3;

/**
 * Hàm serialize note dùng chung cho API và socket (SCRUM-74 & SCRUM-75)
 * Trả {id, sessionId, column, content, createdAt, isAnonymous, voteCount, myVoted, isMine?, author?}
 * - isAnonymous = true: KHÔNG có author/authorId/tên/email trong payload với BẤT KỲ ai, kể cả Scrum Master/Admin.
 * - isAnonymous = false: trả author {id, name}.
 * - isMine tính theo người gọi API (khi có currentUserId). Socket broadcast không chứa isMine/authorId.
 * - voteCount: tổng số lượt vote của note.
 * - myVoted: boolean (người gọi đã vote note này chưa).
 * - Tuyệt đối không trả danh sách người vote để bảo mật tính ẩn danh.
 */
function serializeRetroNote(note, currentUserId = null) {
  const isAnonymous = Boolean(note.isAnonymous);

  let voteCount = 0;
  if (typeof note.voteCount === 'number') {
    voteCount = note.voteCount;
  } else if (note._count && typeof note._count.votes === 'number') {
    voteCount = note._count.votes;
  } else if (Array.isArray(note.votes)) {
    voteCount = note.votes.length;
  }

  let myVoted = false;
  if (currentUserId && Array.isArray(note.votes)) {
    myVoted = note.votes.some((v) => v.userId === currentUserId);
  } else if (currentUserId && typeof note.myVoted === 'boolean') {
    myVoted = note.myVoted;
  }

  const result = {
    id: note.id,
    sessionId: note.sessionId,
    column: note.column,
    content: note.content,
    createdAt: note.createdAt,
    isAnonymous,
    voteCount,
    myVoted,
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
            votes: {
              select: { userId: true },
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

    // Tính số phiếu đã dùng của người gọi trong buổi này (SCRUM-75)
    const usedVotes = (session.notes || []).reduce((acc, note) => {
      return acc + ((note.votes || []).some((v) => v.userId === userId) ? 1 : 0);
    }, 0);
    const myVotesLeft = Math.max(0, MAX_VOTES - usedVotes);

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
      myVotesLeft,
      maxVotes: MAX_VOTES,
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
        votes: {
          select: { userId: true },
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
        votes: {
          select: { userId: true },
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

/**
 * POST /retros/:retroId/notes/:noteId/vote
 * Bình chọn cho sticky note trong buổi Retro (SCRUM-75)
 * Giới hạn MAX_VOTES = 3 phiếu / người / buổi. Buổi phải OPEN.
 */
router.post(
  ['/retros/:retroId/notes/:noteId/vote', '/retros/:id/notes/:noteId/vote'],
  authMiddleware,
  async (req, res) => {
    try {
      const retroId = req.params.retroId || req.params.id;
      const { noteId } = req.params;
      const userId = getUserId(req);

      const session = await prisma.retroSession.findUnique({
        where: { id: retroId },
      });

      if (!session) {
        return res.status(404).json({ error: 'Không tìm thấy buổi Retrospective' });
      }

      const isMember = await isProjectMember(userId, session.projectId);
      if (!isMember) {
        return res.status(403).json({ error: 'Bạn không có quyền truy cập buổi Retrospective này' });
      }

      if (session.status === 'CLOSED') {
        return res.status(400).json({ error: 'Buổi Retrospective đã kết thúc, không thể vote' });
      }

      const note = await prisma.retroNote.findUnique({
        where: { id: noteId },
      });

      if (!note || note.sessionId !== retroId) {
        return res.status(404).json({ error: 'Không tìm thấy ghi chú' });
      }

      // Kiểm tra và tạo vote trong transaction để không vượt giới hạn khi bấm nhanh
      const result = await prisma.$transaction(async (tx) => {
        // 1. Kiểm tra đã vote note này chưa -> 409
        const existingVote = await tx.retroVote.findUnique({
          where: {
            noteId_userId: {
              noteId,
              userId,
            },
          },
        });

        if (existingVote) {
          const err = new Error('Bạn đã vote note này rồi');
          err.statusCode = 409;
          throw err;
        }

        // 2. Kiểm tra tổng số phiếu đã dùng trong buổi này -> 400
        const usedVotes = await tx.retroVote.count({
          where: {
            userId,
            note: {
              sessionId: retroId,
            },
          },
        });

        if (usedVotes >= MAX_VOTES) {
          const err = new Error(`Bạn đã dùng hết ${MAX_VOTES} phiếu`);
          err.statusCode = 400;
          throw err;
        }

        // 3. Tạo vote
        await tx.retroVote.create({
          data: {
            noteId,
            userId,
          },
        });

        // 4. Lấy tổng số voteCount mới của note
        const voteCount = await tx.retroVote.count({
          where: { noteId },
        });

        // 5. Lấy note cập nhật để serialize
        const updatedNote = await tx.retroNote.findUnique({
          where: { id: noteId },
          include: {
            author: { select: { id: true, fullName: true, email: true, avatar: true } },
            votes: { select: { userId: true } },
          },
        });

        return {
          updatedNote,
          voteCount,
          myVotesLeft: Math.max(0, MAX_VOTES - (usedVotes + 1)),
        };
      });

      // Emit RETRO_NOTE_VOTED tới room project_{projectId} với payload {noteId, voteCount}, không chứa userId, myVoted
      const io = getIO();
      if (io) {
        io.to(`project_${session.projectId}`).to(session.projectId).emit('RETRO_NOTE_VOTED', {
          noteId,
          voteCount: result.voteCount,
        });
      }

      const serialized = serializeRetroNote(result.updatedNote, userId);
      return res.json({
        ...serialized,
        voteCount: result.voteCount,
        myVotesLeft: result.myVotesLeft,
      });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ error: err.message });
      }
      if (err.code === 'P2002') {
        return res.status(409).json({ error: 'Bạn đã vote note này rồi' });
      }
      console.error('Lỗi vote note Retrospective:', err);
      return res.status(500).json({ error: 'Lỗi server khi vote ghi chú: ' + err.message });
    }
  }
);

module.exports = router;
module.exports.serializeRetroNote = serializeRetroNote;
module.exports.MAX_VOTES = MAX_VOTES;

