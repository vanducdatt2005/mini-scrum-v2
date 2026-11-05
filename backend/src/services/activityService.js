const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const EventEmitter = require('events');
const { getIO } = require('../socket');

// Event Emitter để xử lý Audit Trail bất đồng bộ hoàn toàn (Async Background Job - AC1, DoD)
const auditEmitter = new EventEmitter();

// Lắng nghe sự kiện ghi log và lưu trữ vào PostgreSQL mà không chặn request chính
auditEmitter.on('record_log', async (payload) => {
  try {
    const { entityType, entityId, actorId, actionType, changesPayload } = payload;

    if (!entityType || !entityId || !actionType) {
      console.warn('[AuditService] Bỏ qua log do thiếu thông tin bắt buộc:', payload);
      return;
    }

    const log = await prisma.activityLog.create({
      data: {
        entityType,
        entityId,
        actorId: actorId || null,
        actionType,
        changesPayload: changesPayload || null,
      },
      include: {
        actor: {
          select: { id: true, fullName: true, email: true, avatar: true }
        }
      }
    });

    // Real-time notification qua Socket.io tới room tương ứng (entity room hoặc project room)
    const io = getIO();
    if (io) {
      const room = entityType === 'TASK' ? `task_${entityId}` : `story_${entityId}`;
      io.to(room).emit('activity:new', log);
      io.emit('activity:global_new', log);
    }
  } catch (err) {
    console.error('[AuditService] Lỗi khi lưu activity log ngầm:', err);
  }
});

/**
 * Phát sự kiện ghi log chạy ngầm (Non-blocking / Background Event - AC1, DoD)
 */
function recordActivity({ entityType, entityId, actorId, actionType, changesPayload }) {
  setImmediate(() => {
    auditEmitter.emit('record_log', {
      entityType,
      entityId,
      actorId,
      actionType,
      changesPayload
    });
  });
}

/**
 * Helper so sánh sự khác biệt (Diff) giữa đối tượng trước và sau khi lưu (AC1, AC3)
 */
async function diffAndRecord({ entityType, entityId, actorId, before, after }) {
  if (!before || !after) return;

  // 1. So sánh Status
  if (before.status !== undefined && after.status !== undefined && before.status !== after.status) {
    recordActivity({
      entityType,
      entityId,
      actorId,
      actionType: 'UPDATED_STATUS',
      changesPayload: {
        field: 'status',
        old_value: before.status,
        new_value: after.status
      }
    });
  }

  // 2. So sánh Assignee (Người phụ trách)
  if (before.assigneeId !== undefined && after.assigneeId !== undefined && before.assigneeId !== after.assigneeId) {
    let oldName = before.assignee?.fullName || before.assignee?.email || null;
    let newName = after.assignee?.fullName || after.assignee?.email || null;

    // Nếu chưa load sẵn quan hệ assignee, truy vấn tên bổ trợ
    if (!oldName && before.assigneeId) {
      const u = await prisma.user.findUnique({ where: { id: before.assigneeId }, select: { fullName: true, email: true } });
      oldName = u?.fullName || u?.email || 'Thành viên';
    }
    if (!newName && after.assigneeId) {
      const u = await prisma.user.findUnique({ where: { id: after.assigneeId }, select: { fullName: true, email: true } });
      newName = u?.fullName || u?.email || 'Thành viên';
    }

    recordActivity({
      entityType,
      entityId,
      actorId,
      actionType: 'UPDATED_ASSIGNEE',
      changesPayload: {
        field: 'assignee',
        old_value: oldName || 'Chưa gán',
        new_value: newName || 'Chưa gán',
        old_assignee_id: before.assigneeId,
        new_assignee_id: after.assigneeId
      }
    });
  }

  // 3. So sánh Title (Tiêu đề)
  if (before.title !== undefined && after.title !== undefined && before.title !== after.title) {
    recordActivity({
      entityType,
      entityId,
      actorId,
      actionType: 'UPDATED_TITLE',
      changesPayload: {
        field: 'title',
        old_value: before.title,
        new_value: after.title
      }
    });
  }

  // 4. So sánh Description (Mô tả văn bản dài)
  if (before.description !== undefined && after.description !== undefined && (before.description || '') !== (after.description || '')) {
    recordActivity({
      entityType,
      entityId,
      actorId,
      actionType: 'UPDATED_DESCRIPTION',
      changesPayload: {
        field: 'description',
        old_value: before.description || '',
        new_value: after.description || ''
      }
    });
  }

  // 5. So sánh Priority (Mức độ ưu tiên - thường có trên User Story)
  if (before.priority !== undefined && after.priority !== undefined && before.priority !== after.priority) {
    recordActivity({
      entityType,
      entityId,
      actorId,
      actionType: 'UPDATED_PRIORITY',
      changesPayload: {
        field: 'priority',
        old_value: before.priority,
        new_value: after.priority
      }
    });
  }
}

/**
 * REST API Query: Lấy danh sách lịch sử thay đổi (Read-only, Cursor-based Pagination - DoD)
 */
async function getActivities({ entityType, entityId, cursor, limit = 20 }) {
  const takeLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 100);

  const queryArgs = {
    where: {
      entityType,
      entityId
    },
    orderBy: [
      { createdAt: 'desc' },
      { id: 'desc' }
    ],
    take: takeLimit + 1, // Lấy dư 1 phần tử để xác định hasNextPage
    include: {
      actor: {
        select: { id: true, fullName: true, email: true, avatar: true }
      }
    }
  };

  // Cursor-based Pagination
  if (cursor) {
    queryArgs.cursor = { id: cursor };
    queryArgs.skip = 1;
  }

  const [activities, totalCount] = await Promise.all([
    prisma.activityLog.findMany(queryArgs),
    prisma.activityLog.count({ where: { entityType, entityId } })
  ]);

  let nextCursor = null;
  let hasMore = false;

  if (activities.length > takeLimit) {
    hasMore = true;
    const nextItem = activities.pop(); // Bỏ phần tử thứ takeLimit + 1
    nextCursor = activities[activities.length - 1]?.id || null;
  }

  return {
    activities,
    nextCursor,
    hasMore,
    totalCount,
    limit: takeLimit
  };
}

module.exports = {
  recordActivity,
  diffAndRecord,
  getActivities
};

