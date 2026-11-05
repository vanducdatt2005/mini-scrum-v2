const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { getIO } = require('../socket');

/**
 * Gửi thông báo thời gian thực khi giao Task (Real-time Task Assignment Notification)
 * AC4: Chỉ gửi event NOTIFICATION_ASSIGNED tới đúng private room `user_${recipientId}` của người được gán.
 */
async function sendTaskAssignmentNotification({ taskId, recipientId, senderId, io: injectedIO }) {
  if (!taskId || !recipientId) {
    console.warn('[Notification] Thiếu taskId hoặc recipientId để gửi thông báo.');
    return null;
  }

  // Không gửi thông báo nếu người dùng tự giao task cho chính mình
  if (senderId && String(senderId) === String(recipientId)) {
    console.log('[Notification] Tự giao task cho chính mình, bỏ qua gửi thông báo.');
    return null;
  }

  try {
    // 1. Lấy thông tin Task và Project
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        userStory: {
          include: {
            project: { select: { id: true, name: true } }
          }
        }
      }
    });

    if (!task) {
      console.warn(`[Notification] Không tìm thấy Task với ID: ${taskId}`);
      return null;
    }

    const projectId = task.userStory?.projectId || null;
    const projectName = task.userStory?.project?.name || 'Dự án';
    const taskTitle = task.title || 'Task không tên';

    // 2. Lấy thông tin Người giao (Sender)
    let sender = null;
    if (senderId) {
      sender = await prisma.user.findUnique({
        where: { id: senderId },
        select: { id: true, fullName: true, email: true, avatar: true }
      });
    }

    const senderName = sender?.fullName || sender?.email || 'Người quản trị';
    const senderAvatar = sender?.avatar || null;
    const content = `${senderName} đã giao task "${taskTitle}" cho bạn trong dự án "${projectName}".`;
    const link = `/projects/${projectId}/tasks/${task.id}`;

    // 3. Lưu bản ghi thông báo vào Database (Phần 1: Database Schema)
    const notification = await prisma.notification.create({
      data: {
        userId: recipientId,      // recipient_id
        senderId: senderId || null, // sender_id
        taskId: task.id,          // task_id
        projectId: projectId,     // project_id
        type: 'TASK_ASSIGNED',
        taskTitle: taskTitle,
        content: content,
        link: link,
        isRead: false
      },
      include: {
        sender: { select: { id: true, fullName: true, email: true, avatar: true } },
        task: { select: { id: true, title: true } },
        project: { select: { id: true, name: true } }
      }
    });

    // 4. Chuẩn bị payload chuẩn theo yêu cầu nghiệp vụ
    const payload = {
      id: notification.id,
      recipient_id: recipientId,
      sender_id: senderId || null,
      sender_name: senderName,
      sender_avatar: senderAvatar,
      task_id: task.id,
      task_title: taskTitle,
      project_id: projectId,
      project_name: projectName,
      type: 'TASK_ASSIGNED',
      content: content,
      message: content,
      link: link,
      is_read: false,
      isRead: false,
      created_at: notification.createdAt,
      createdAt: notification.createdAt,
      sender: sender ? {
        id: sender.id,
        fullName: senderName,
        email: sender.email,
        avatar: senderAvatar
      } : null,
      task: { id: task.id, title: taskTitle },
      project: projectId ? { id: projectId, name: projectName } : null
    };

    // 5. Bắn WebSocket event tới Private Room của người nhận (AC4)
    const io = injectedIO || getIO();
    if (io) {
      const recipientRoom = `user_${recipientId}`;
      io.to(recipientRoom).emit('NOTIFICATION_ASSIGNED', payload);
      console.log(`🔔 [Socket] Emitted NOTIFICATION_ASSIGNED to private room: ${recipientRoom} for task "${taskTitle}"`);
    } else {
      console.warn('[Notification] Socket IO instance chưa sẵn sàng.');
    }

    return notification;
  } catch (error) {
    console.error('[Notification] Lỗi khi tạo và gửi thông báo gán task:', error);
    return null;
  }
}

/**
 * Lấy danh sách thông báo của user hiện tại, sắp xếp mới nhất lên đầu kèm unread_count
 */
async function getUserNotifications(userId) {
  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        sender: { select: { id: true, fullName: true, email: true, avatar: true } },
        task: { select: { id: true, title: true } },
        project: { select: { id: true, name: true } }
      }
    }),
    prisma.notification.count({
      where: { userId, isRead: false }
    })
  ]);

  // Format trả về hỗ trợ cả camelCase và snake_case
  const formatted = notifications.map(n => ({
    id: n.id,
    recipient_id: n.userId,
    userId: n.userId,
    sender_id: n.senderId,
    senderId: n.senderId,
    sender_name: n.sender?.fullName || n.sender?.email || 'Hệ thống',
    sender_avatar: n.sender?.avatar || null,
    task_id: n.taskId,
    taskId: n.taskId,
    task_title: n.taskTitle || n.task?.title || '',
    taskTitle: n.taskTitle || n.task?.title || '',
    project_id: n.projectId,
    projectId: n.projectId,
    project_name: n.project?.name || '',
    type: n.type,
    content: n.content,
    link: n.link,
    is_read: n.isRead,
    isRead: n.isRead,
    created_at: n.createdAt,
    createdAt: n.createdAt,
    sender: n.sender,
    task: n.task,
    project: n.project
  }));

  return {
    notifications: formatted,
    unread_count: unreadCount,
    unreadCount: unreadCount
  };
}

/**
 * Đánh dấu 1 thông báo là đã đọc
 */
async function markNotificationAsRead(id, userId) {
  const updated = await prisma.notification.updateMany({
    where: { id, userId },
    data: { isRead: true }
  });
  return updated;
}

/**
 * Đánh dấu tất cả thông báo chưa đọc của user thành đã đọc
 */
async function markAllNotificationsAsRead(userId) {
  const result = await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true }
  });
  return result;
}

module.exports = {
  prisma,
  sendTaskAssignmentNotification,
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead
};
