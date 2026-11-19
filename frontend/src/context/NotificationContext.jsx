import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getSocket, setSocketUser } from '../hooks/useSocket';
import { getNotifications, markNotificationAsRead, markAllNotificationsAsRead, getAvatarUrl } from '../services/api';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  // Load initial notifications từ REST API (GET /api/notifications)
  useEffect(() => {
    let isMounted = true;
    const fetchNotifs = async () => {
      if (!currentUser?.id) return;
      try {
        const res = await getNotifications();
        const data = res.data;
        if (isMounted) {
          const list = Array.isArray(data) ? data : (data?.notifications || []);
          const count = typeof data?.unread_count === 'number'
            ? data.unread_count
            : (typeof data?.unreadCount === 'number'
              ? data.unreadCount
              : list.filter(n => !n.isRead && !n.is_read).length);
          
          setNotifications(list);
          setUnreadCount(count);
        }
      } catch (err) {
        console.error("Lỗi lấy notifications:", err);
      }
    };

    fetchNotifs();
    return () => { isMounted = false; };
  }, [currentUser?.id]);

  // Đánh dấu 1 thông báo là đã đọc (PATCH /api/notifications/:id/read)
  const markAsRead = useCallback(async (id) => {
    const notif = notifications.find(n => n.id === id);
    if (!notif || notif.isRead || notif.is_read) return;

    // Cập nhật optimistic UI: giảm badge & đánh dấu đã đọc
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, isRead: true, is_read: true } : n)));
    setUnreadCount(prev => Math.max(0, prev - 1));

    try {
      await markNotificationAsRead(id);
    } catch (err) {
      console.error("Lỗi đánh dấu đã đọc:", err);
      // Rollback nếu API lỗi
      setNotifications(prev => prev.map(n => (n.id === id ? { ...n, isRead: false, is_read: false } : n)));
      setUnreadCount(prev => prev + 1);
    }
  }, [notifications]);

  // Đánh dấu tất cả thông báo là đã đọc (PATCH /api/notifications/read-all)
  const markAllAsRead = useCallback(async () => {
    const hasUnread = notifications.some(n => !n.isRead && !n.is_read);
    if (!hasUnread && unreadCount === 0) return;

    const prevNotifs = [...notifications];
    const prevCount = unreadCount;

    // Optimistic UI update
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true, is_read: true })));
    setUnreadCount(0);

    try {
      await markAllNotificationsAsRead();
    } catch (err) {
      console.error("Lỗi đánh dấu tất cả đã đọc:", err);
      setNotifications(prevNotifs);
      setUnreadCount(prevCount);
    }
  }, [notifications, unreadCount]);

  // Real-time WebSocket Gateway listener (AC1, AC4)
  useEffect(() => {
    if (!currentUser?.id) return;

    const s = getSocket();
    setSocketUser(currentUser.id);

    const joinUserRoom = () => {
      s.emit('joinUser', currentUser.id);
    };

    if (s.connected) {
      joinUserRoom();
    } else {
      s.on('connect', joinUserRoom);
    }

    // Xử lý sự kiện NOTIFICATION_ASSIGNED: CHỈ kích hoạt cho người được giao Task
    const handleAssignedNotification = (data) => {
      if (!data) return;

      const currentUserId = currentUser?.id;
      const recipientId = data.recipient_id || data.userId || data.recipientId;

      // KIỂM SOÁT BẢO MẬT: Bỏ qua tuyệt đối nếu thông báo không phải gửi cho chính user đang đăng nhập
      if (!currentUserId || !recipientId || String(recipientId) !== String(currentUserId)) {
        console.log(`[Notification] Đã chặn thông báo gán task của user khác (Người nhận: ${recipientId}, Người xem: ${currentUserId})`);
        return;
      }

      // Đảm bảo chỉ hiển thị popup gán task khi type đúng là TASK_ASSIGNED
      if (data.type && data.type !== 'TASK_ASSIGNED') {
        return;
      }

      // Chuẩn hóa dữ liệu tương thích cả 2 chuẩn camelCase và snake_case
      const normalizedNotif = {
        ...data,
        id: data.id,
        isRead: false,
        is_read: false,
        recipientId: recipientId,
        senderId: data.sender_id || data.senderId,
        senderName: data.sender_name || data.senderName || data.sender?.fullName || data.sender?.email || 'Người quản trị',
        senderAvatar: data.sender_avatar || data.senderAvatar || data.sender?.avatar || null,
        taskId: data.task_id || data.taskId || data.task?.id,
        taskTitle: data.task_title || data.taskTitle || data.task?.title || 'Task mới',
        projectId: data.project_id || data.projectId || data.project?.id,
        projectName: data.project_name || data.projectName || data.project?.name || 'Dự án',
        type: 'TASK_ASSIGNED',
        createdAt: data.created_at || data.createdAt || new Date().toISOString(),
        link: data.link || (data.project_id && data.task_id ? `/projects/${data.project_id}/tasks/${data.task_id}` : `/projects/${data.projectId}/tasks/${data.taskId}`)
      };

      // Tự động thêm thông báo mới lên đầu danh sách mà không cần F5
      setNotifications(prev => {
        if (prev.some(n => n.id === normalizedNotif.id)) return prev;
        return [normalizedNotif, ...prev];
      });

      // Tự động cộng thêm +1 vào Badge số đếm trên icon Chuông (AC1)
      setUnreadCount(prev => prev + 1);

      // Hiển thị Pop-up Toast ở góc màn hình (AC1)
      const avatarUrl = getAvatarUrl(normalizedNotif.senderAvatar);
      toast.custom(
        (t) => (
          <div
            onClick={() => {
              toast.dismiss(t.id);
              if (normalizedNotif.id) markAsRead(normalizedNotif.id);
              if (normalizedNotif.link) navigate(normalizedNotif.link);
            }}
            className={`${
              t.visible ? 'animate-enter' : 'animate-leave'
            } max-w-md w-full bg-white dark:bg-slate-900 shadow-2xl rounded-2xl pointer-events-auto flex ring-1 ring-black/5 dark:ring-white/10 p-4 cursor-pointer hover:scale-[1.02] transition-all border border-primary/30`}
          >
            <div className="flex items-start gap-3 w-full">
              <div className="w-10 h-10 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center overflow-hidden shrink-0 ring-2 ring-primary/30">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={normalizedNotif.senderName} className="w-full h-full object-cover" />
                ) : (
                  <span className="material-symbols-outlined text-primary text-xl">assignment_ind</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-primary flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs">notifications_active</span>
                    Task được giao mới
                  </span>
                  <span className="text-[10px] text-slate-400">Vừa xong</span>
                </div>
                <p className="text-sm font-bold text-slate-900 dark:text-white truncate mt-0.5">
                  {normalizedNotif.taskTitle}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  Giao bởi <span className="font-semibold text-slate-700 dark:text-slate-300">{normalizedNotif.senderName}</span> • {normalizedNotif.projectName}
                </p>
              </div>
            </div>
          </div>
        ),
        {
          duration: 5000,
          position: 'top-right'
        }
      );
    };

    // Xử lý sự kiện COMMENT_MENTIONED: Khi được tag tên trong bình luận Task / User Story (AC2)
    const handleCommentMentionedNotification = (data) => {
      if (!data) return;

      const currentUserId = currentUser?.id;
      const recipientId = data.recipient_id || data.recipientId || data.userId;

      if (!currentUserId || !recipientId || String(recipientId) !== String(currentUserId)) {
        return;
      }

      const normalizedNotif = {
        ...data,
        id: data.id,
        isRead: false,
        is_read: false,
        recipientId: recipientId,
        senderId: data.sender_id || data.senderId,
        senderName: data.sender_name || data.senderName || 'Đồng đội',
        senderAvatar: data.sender_avatar || data.senderAvatar || null,
        taskId: data.task_id || data.taskId,
        taskTitle: data.task_title || data.taskTitle || 'Bình luận mới',
        projectId: data.project_id || data.projectId,
        projectName: data.project_name || data.projectName || 'Dự án',
        type: 'COMMENT_MENTIONED',
        content: data.content || data.message || `${data.sender_name || 'Ai đó'} đã nhắc đến bạn trong một bình luận`,
        createdAt: data.created_at || data.createdAt || new Date().toISOString(),
        link: data.link
      };

      setNotifications((prev) => {
        if (prev.some((n) => n.id === normalizedNotif.id)) return prev;
        return [normalizedNotif, ...prev];
      });

      setUnreadCount((prev) => prev + 1);

      const avatarUrl = getAvatarUrl(normalizedNotif.senderAvatar);
      toast.custom(
        (t) => (
          <div
            onClick={() => {
              toast.dismiss(t.id);
              if (normalizedNotif.id) markAsRead(normalizedNotif.id);
              if (normalizedNotif.link) navigate(normalizedNotif.link);
            }}
            className={`${
              t.visible ? 'animate-enter' : 'animate-leave'
            } max-w-md w-full bg-white dark:bg-slate-900 shadow-2xl rounded-2xl pointer-events-auto flex ring-1 ring-black/5 dark:ring-white/10 p-4 cursor-pointer hover:scale-[1.02] transition-all border border-amber-400/40`}
          >
            <div className="flex items-start gap-3 w-full">
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-950/60 flex items-center justify-center overflow-hidden shrink-0 ring-2 ring-amber-400/40">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={normalizedNotif.senderName} className="w-full h-full object-cover" />
                ) : (
                  <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 text-xl">alternate_email</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs">alternate_email</span>
                    Nhắc đến bạn trong thảo luận
                  </span>
                  <span className="text-[10px] text-slate-400">Vừa xong</span>
                </div>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1 line-clamp-2 leading-relaxed">
                  {normalizedNotif.content}
                </p>
              </div>
            </div>
          </div>
        ),
        {
          duration: 6000,
          position: 'top-right'
        }
      );
    };

    // Xử lý thông báo hệ thống thông thường (KICKED, Lời mời...)
    const handleGeneralNotification = (data) => {
      if (!data) return;
      const currentUserId = currentUser?.id;
      const recipientId = data.recipient_id || data.userId || data.recipientId;

      if (!currentUserId || !recipientId || String(recipientId) !== String(currentUserId)) {
        return;
      }
      // Không xử lý TASK_ASSIGNED hoặc COMMENT_MENTIONED tại đây vì đã có listener riêng
      if (data.type === 'TASK_ASSIGNED' || data.type === 'COMMENT_MENTIONED') return;

      setNotifications(prev => {
        if (prev.some(n => n.id === data.id)) return prev;
        return [data, ...prev];
      });
      if (!data.isRead && !data.is_read) {
        setUnreadCount(prev => prev + 1);
      }
    };

    // ĐĂNG KÝ SỰ KIỆN: Chỉ NOTIFICATION_ASSIGNED mới kích hoạt popup Giao Task
    s.on('NOTIFICATION_ASSIGNED', handleAssignedNotification);
    s.on('COMMENT_MENTIONED', handleCommentMentionedNotification);
    s.on('notification:new', handleGeneralNotification);

    return () => {
      s.off('connect', joinUserRoom);
      s.emit('leaveUser', currentUser.id);
      s.off('NOTIFICATION_ASSIGNED', handleAssignedNotification);
      s.off('COMMENT_MENTIONED', handleCommentMentionedNotification);
      s.off('notification:new', handleGeneralNotification);
    };
  }, [currentUser?.id, markAsRead, navigate]);

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead, markAllAsRead }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotificationContext = () => useContext(NotificationContext);
