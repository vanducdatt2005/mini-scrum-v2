const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { getIO } = require('../socket');

/**
 * Trích xuất danh sách User ID được @mention trong nội dung bình luận
 * Định dạng hỗ trợ:
 * - @[Họ và tên](userId)
 * - @{userId}
 * - @userId (nếu khớp định dạng ID cuid)
 * Loại bỏ trùng lặp và loại trừ chính authorId (AC2 & DoD)
 */
function extractMentionedUserIds(content = '', authorId = null) {
  if (!content || typeof content !== 'string') return [];

  const mentioned = new Set();

  // Pattern 1: @[FullName](userId)
  const regex1 = /@\[([^\]]+)\]\(([a-zA-Z0-9_\-]+)\)/g;
  let match;
  while ((match = regex1.exec(content)) !== null) {
    const uId = match[2].trim();
    if (uId && (!authorId || String(uId) !== String(authorId))) {
      mentioned.add(uId);
    }
  }

  // Pattern 2: @{userId}
  const regex2 = /@\{([a-zA-Z0-9_\-]+)\}/g;
  while ((match = regex2.exec(content)) !== null) {
    const uId = match[1].trim();
    if (uId && (!authorId || String(uId) !== String(authorId))) {
      mentioned.add(uId);
    }
  }

  return Array.from(mentioned);
}

/**
 * Gửi thông báo COMMENT_MENTIONED tới những người được nhắc tên
 */
async function sendMentionNotifications({
  comment,
  mentionedUserIds,
  author,
  entityType,
  entityId,
  taskTitle,
  projectName,
  projectId,
  injectedIO
}) {
  if (!Array.isArray(mentionedUserIds) || mentionedUserIds.length === 0) return;

  const authorName = author?.fullName || author?.email || 'Một thành viên';
  const authorAvatar = author?.avatar || null;
  const isTask = entityType === 'TASK';
  const entityLabel = isTask ? 'task' : 'user story';
  const link = isTask && projectId ? `/projects/${projectId}/tasks/${entityId}` : (projectId ? `/projects/${projectId}/backlog` : `/userstory/${entityId}`);

  // Cắt ngắn nội dung trích dẫn
  const previewText = comment.content.length > 80 ? comment.content.slice(0, 80) + '...' : comment.content;
  const content = `${authorName} đã nhắc đến bạn trong một bình luận trên ${entityLabel} "${taskTitle || 'Tác vụ'}": "${previewText}"`;

  const io = injectedIO || getIO();

  for (const recipientId of mentionedUserIds) {
    try {
      // 1. Lưu bản ghi thông báo vào database
      const notif = await prisma.notification.create({
        data: {
          userId: recipientId,
          senderId: author?.id || null,
          taskId: isTask ? entityId : null,
          projectId: projectId || null,
          type: 'COMMENT_MENTIONED',
          taskTitle: taskTitle || 'Bình luận mới',
          content: content,
          link: link,
          isRead: false
        },
        include: {
          sender: { select: { id: true, fullName: true, email: true, avatar: true } }
        }
      });

      // 2. Bắn sự kiện realtime tới private room của người được tag
      if (io) {
        const payload = {
          id: notif.id,
          recipient_id: recipientId,
          recipientId: recipientId,
          sender_id: author?.id,
          senderId: author?.id,
          sender_name: authorName,
          senderName: authorName,
          sender_avatar: authorAvatar,
          senderAvatar: authorAvatar,
          task_id: isTask ? entityId : null,
          taskId: isTask ? entityId : null,
          task_title: taskTitle || '',
          taskTitle: taskTitle || '',
          project_id: projectId || null,
          projectId: projectId || null,
          project_name: projectName || '',
          projectName: projectName || '',
          type: 'COMMENT_MENTIONED',
          content: content,
          message: content,
          link: link,
          is_read: false,
          isRead: false,
          created_at: notif.createdAt,
          createdAt: notif.createdAt
        };

        const recipientRoom = `user_${recipientId}`;
        io.to(recipientRoom).emit('COMMENT_MENTIONED', payload);
        io.to(recipientRoom).emit('notification:new', payload);
        console.log(`🔔 [Mention] Sent COMMENT_MENTIONED to room: ${recipientRoom}`);
      }
    } catch (err) {
      console.error(`[Mention] Lỗi gửi thông báo cho user ${recipientId}:`, err);
    }
  }
}

/**
 * Xử lý @mention khi SỬA bình luận (Edit comment):
 * CHỈ gửi thông báo cho những người MỚI ĐƯỢC TAG THÊM (AC2 & DoD)
 */
async function handleCommentEditMentions({
  comment,
  oldMentionedUserIds = [],
  newContent,
  author,
  entityType,
  entityId,
  taskTitle,
  projectName,
  projectId,
  injectedIO
}) {
  const newMentionedUserIds = extractMentionedUserIds(newContent, author?.id);
  const oldSet = new Set(oldMentionedUserIds);

  // Chỉ lấy những user chưa từng được tag trước đó
  const newlyTagged = newMentionedUserIds.filter(id => !oldSet.has(id));

  if (newlyTagged.length > 0) {
    console.log(`🔔 [Mention Edit] Phát hiện ${newlyTagged.length} người mới được tag:`, newlyTagged);
    await sendMentionNotifications({
      comment: { ...comment, content: newContent },
      mentionedUserIds: newlyTagged,
      author,
      entityType,
      entityId,
      taskTitle,
      projectName,
      projectId,
      injectedIO
    });
  }

  return newMentionedUserIds;
}

module.exports = {
  extractMentionedUserIds,
  sendMentionNotifications,
  handleCommentEditMentions
};

