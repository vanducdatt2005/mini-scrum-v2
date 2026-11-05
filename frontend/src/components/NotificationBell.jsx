import React, { useState, useEffect } from 'react';
import useNotifications from '../hooks/useNotifications';
import { useNavigate } from 'react-router-dom';
import { getAvatarUrl } from '../services/api';

/**
 * Hàm tính thời gian tương đối ("Vừa xong", "2 phút trước", "1 giờ trước", v.v..)
 */
const formatRelativeTime = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  const now = new Date();
  const diffInSeconds = Math.max(0, Math.floor((now - date) / 1000));

  if (diffInSeconds < 60) return 'Vừa xong';
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes} phút trước`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours} giờ trước`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) return `${diffInDays} ngày trước`;

  const d = date.getDate().toString().padStart(2, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
};

export default function NotificationBell({ invitations = [], onRespondInvite }) {
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  const totalUnread = invitations.length + unreadCount;

  // Tự động mở thông báo nếu URL có ?showNotifications=true
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("showNotifications") === "true") {
      setShowNotifications(true);
    }
  }, [window.location.search]);

  // AC2, AC3: Click vào 1 thông báo -> Gọi API mark as read, giảm badge, redirect sang trang chi tiết Task
  const handleNotificationClick = async (notif) => {
    const isUnread = !notif.isRead && !notif.is_read;
    if (isUnread) {
      await markAsRead(notif.id);
    }
    setShowNotifications(false);

    // Xác định route chuyển hướng
    const projectId = notif.project_id || notif.projectId || notif.project?.id;
    const taskId = notif.task_id || notif.taskId || notif.task?.id;
    let targetLink = notif.link;

    if (projectId && taskId) {
      targetLink = `/projects/${projectId}/tasks/${taskId}`;
    } else if (projectId) {
      targetLink = `/projects/${projectId}/board`;
    }

    if (targetLink) {
      navigate(targetLink);
    }
  };

  return (
    <div className="relative">
      {/* Icon Chuông kèm Badge số đếm (AC1) */}
      <button 
        id="notification-bell-btn"
        onClick={() => setShowNotifications(!showNotifications)}
        className="p-2 text-[#44474e] dark:text-slate-300 hover:bg-[#f1f3f8] dark:hover:bg-slate-800 rounded-full transition-colors relative"
        title="Thông báo"
      >
        <span className="material-symbols-outlined text-2xl">notifications</span>
        {totalUnread > 0 && (
          <span 
            id="notification-badge"
            className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-md animate-bounce"
          >
            {totalUnread > 99 ? '99+' : totalUnread}
          </span>
        )}
      </button>

      {/* Notification Dropdown Component */}
      {showNotifications && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)}></div>
          <div 
            id="notification-dropdown"
            className="absolute right-0 mt-3 w-88 sm:w-96 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden z-50 animate-in fade-in slide-in-from-top-3 duration-200"
          >
            {/* Dropdown Header */}
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">
                  Thông báo
                </h4>
                {totalUnread > 0 && (
                  <span className="text-[11px] font-bold px-2 py-0.5 bg-primary/10 text-primary dark:bg-primary/20 rounded-full">
                    {totalUnread} mới
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button 
                  onClick={markAllAsRead}
                  className="text-xs font-bold text-primary hover:text-primary-dark hover:underline transition-all"
                >
                  Đánh dấu tất cả là đã đọc
                </button>
              )}
            </div>

            {/* Notification List Container */}
            <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {/* Lời mời tham gia dự án */}
              {invitations.length > 0 && (
                <div className="bg-slate-50 dark:bg-slate-800/50 px-4 py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Lời mời tham gia dự án
                </div>
              )}
              {invitations.map(inv => (
                <div key={inv.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-xl">group_add</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-snug">
                        Bạn được mời vào dự án <strong className="text-slate-900 dark:text-white">{inv.project.name}</strong> với vai trò <span className="font-semibold text-primary">{inv.role}</span>.
                      </p>
                      <div className="flex gap-2 mt-2.5">
                        <button 
                          onClick={() => onRespondInvite(inv.id, "ACCEPT")}
                          className="flex-1 py-1.5 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary-dark transition shadow-sm"
                        >
                          Chấp nhận
                        </button>
                        <button 
                          onClick={() => onRespondInvite(inv.id, "DECLINE")}
                          className="flex-1 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold hover:bg-red-50 hover:text-red-600 transition"
                        >
                          Từ chối
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Danh sách thông báo */}
              {notifications.map(notif => {
                const isUnread = !notif.isRead && !notif.is_read;
                const senderName = notif.sender_name || notif.senderName || notif.sender?.fullName || notif.sender?.email || 'Người quản trị';
                const senderAvatar = notif.sender_avatar || notif.senderAvatar || notif.sender?.avatar;
                const avatarUrl = getAvatarUrl(senderAvatar);
                const taskTitle = notif.task_title || notif.taskTitle || notif.task?.title;
                const projectName = notif.project_name || notif.projectName || notif.project?.name;
                const createdAt = notif.created_at || notif.createdAt;

                return (
                  <div 
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`p-4 transition-all cursor-pointer group flex items-start gap-3.5 relative ${
                      isUnread 
                        ? 'bg-primary/[0.04] dark:bg-primary/[0.08] hover:bg-primary/[0.08] dark:hover:bg-primary/[0.12]' 
                        : 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50 opacity-80 hover:opacity-100'
                    }`}
                  >
                    {/* Chấm xanh hiển thị thông báo Chưa đọc (AC2) */}
                    {isUnread && (
                      <span 
                        className="w-2.5 h-2.5 rounded-full bg-primary shrink-0 ring-2 ring-primary/20 absolute top-4 left-2.5" 
                        title="Chưa đọc"
                      />
                    )}

                    {/* Avatar người giao hoặc Icon tương ứng */}
                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 overflow-hidden ring-1 ring-slate-200 dark:ring-slate-700 ml-1">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt={senderName} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-primary/10 text-primary font-bold flex items-center justify-center text-sm">
                          {senderName.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>

                    {/* Nội dung thông báo */}
                    <div className="flex-1 min-w-0 pr-1">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className={`text-[11px] font-bold uppercase tracking-wider truncate ${
                          notif.type === 'TASK_ASSIGNED' 
                            ? 'text-primary' 
                            : notif.type === 'COMMENT_MENTIONED'
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-slate-600 dark:text-slate-400'
                        }`}>
                          {notif.type === 'TASK_ASSIGNED' 
                            ? 'Giao việc mới' 
                            : notif.type === 'COMMENT_MENTIONED'
                              ? 'Nhắc tên trong bình luận'
                              : 'Thông báo'}
                        </span>
                        {/* Thời gian tương đối (ví dụ: "2 phút trước") */}
                        <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                          {formatRelativeTime(createdAt)}
                        </span>
                      </div>

                      {/* Chi tiết người giao, tên Task và tên Project */}
                      {notif.type === 'COMMENT_MENTIONED' ? (
                        <p className={`text-xs leading-relaxed ${isUnread ? 'font-bold text-slate-900 dark:text-white' : 'font-medium text-slate-600 dark:text-slate-400'}`}>
                          {notif.content || `${senderName} đã nhắc đến bạn trong một bình luận`}
                        </p>
                      ) : notif.type === 'TASK_ASSIGNED' ? (
                        <p className={`text-xs leading-relaxed ${isUnread ? 'font-bold text-slate-900 dark:text-white' : 'font-medium text-slate-600 dark:text-slate-400'}`}>
                          <span className="text-primary font-semibold">{senderName}</span>
                          {' '}đã giao task{' '}
                          <span className="underline decoration-primary/40 font-bold text-slate-900 dark:text-white">
                            "{taskTitle || notif.taskTitle || 'Task'}"
                          </span>
                          {projectName && (
                            <span className="text-slate-500 font-normal"> trong dự án <strong>{projectName}</strong></span>
                          )}
                        </p>
                      ) : (
                        <p className={`text-xs leading-relaxed ${isUnread ? 'font-bold text-slate-900 dark:text-white' : 'font-medium text-slate-600 dark:text-slate-400'}`}>
                          {notif.content || notif.message || 'Bạn có thông báo mới'}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Trạng thái rỗng */}
              {notifications.length === 0 && invitations.length === 0 && (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 italic">
                  <span className="material-symbols-outlined text-4xl mb-2 opacity-30">notifications_off</span>
                  <p className="text-xs">Không có thông báo nào</p>
                </div>
              )}
            </div>

            {/* Dropdown Footer: Nút Đánh dấu tất cả là đã đọc (AC3) */}
            {notifications.length > 0 && (
              <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 text-center">
                <button 
                  onClick={markAllAsRead}
                  className="text-xs font-bold text-primary hover:text-primary-dark transition-all flex items-center justify-center gap-1 mx-auto"
                >
                  <span className="material-symbols-outlined text-sm">done_all</span>
                  Đánh dấu tất cả là đã đọc
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
