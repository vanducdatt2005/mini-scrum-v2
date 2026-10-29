import React, { useState, useEffect } from 'react';
import useNotifications from '../hooks/useNotifications';
import { useNavigate } from 'react-router-dom';

const formatDateTime = (dateString) => {
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return '';
  const HH = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  const ss = d.getSeconds().toString().padStart(2, '0');
  const DD = d.getDate().toString().padStart(2, '0');
  const MM = (d.getMonth() + 1).toString().padStart(2, '0');
  const YYYY = d.getFullYear();
  return `${HH}:${mm}:${ss} - ${DD}/${MM}/${YYYY}`;
};

export default function NotificationBell({ invitations = [], onRespondInvite }) {
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  const totalUnread = invitations.length + unreadCount;

  // Tự động mở thông báo nếu có query param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("showNotifications") === "true") {
      setShowNotifications(true);
    }
  }, [window.location.search]);

  const handleNotificationClick = async (notif) => {
    if (!notif.isRead) {
      await markAsRead(notif.id);
    }
    setShowNotifications(false);
    if (notif.link) {
      navigate(notif.link);
    }
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setShowNotifications(!showNotifications)}
        className="p-2 text-[#44474e] hover:bg-[#f1f3f8] rounded-full transition-colors relative"
      >
        <span className="material-symbols-outlined">notifications</span>
        {totalUnread > 0 && (
          <span className="absolute top-2 right-2 min-w-[14px] h-[14px] px-1 bg-error text-white text-[8px] font-bold rounded-full flex items-center justify-center animate-bounce">
            {totalUnread}
          </span>
        )}
      </button>

      {/* Notifications Dropdown */}
      {showNotifications && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)}></div>
          <div className="absolute right-0 mt-3 w-80 bg-white rounded-3xl shadow-2xl border border-outline-variant/10 overflow-hidden z-50 animate-in fade-in slide-in-from-top-3 duration-200">
            <div className="px-6 py-4 border-b border-outline-variant/10 bg-surface-container-low flex items-center justify-between">
              <h4 className="text-sm font-black text-on-surface uppercase tracking-wider">Thông báo</h4>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button 
                    onClick={markAllAsRead}
                    className="text-[10px] font-bold text-primary hover:underline px-2"
                  >
                    Đánh dấu tất cả đã đọc
                  </button>
                )}
                <span className="text-[10px] font-bold px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                  {totalUnread} Mới
                </span>
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {/* System & In-app Notifications */}
              {notifications.filter(n => !n.isRead).length === 0 && notifications.filter(n => n.isRead).length > 0 && invitations.length === 0 && (
                <div className="px-4 py-2 text-[10px] text-on-surface-variant/50 text-center uppercase tracking-widest bg-surface-container-lowest">
                  Thông báo đã đọc
                </div>
              )}
              
              {notifications.map(notif => (
                <div 
                  key={notif.id} 
                  className={`p-4 border-b border-outline-variant/5 transition-colors group relative cursor-pointer ${!notif.isRead ? 'bg-primary/5 hover:bg-primary/10' : 'bg-surface-container-lowest hover:bg-surface-container-low opacity-70'}`}
                  onClick={() => handleNotificationClick(notif)}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${notif.type === 'KICKED' ? 'bg-error/10 text-error' : 'bg-primary/10 text-primary'}`}>
                      <span className="material-symbols-outlined">
                        {notif.type === 'KICKED' ? 'person_remove' : notif.type === 'TASK_CHANGED' ? 'task_alt' : 'notifications_active'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <span className={`text-[10px] font-black uppercase tracking-widest leading-none mb-1 ${notif.type === 'KICKED' ? 'text-error' : 'text-primary'}`}>
                          {notif.type === 'KICKED' ? 'Hệ thống' : 'Cập nhật Công việc'}
                        </span>
                        <span className="text-[9px] font-medium text-on-surface-variant opacity-50">
                          {formatDateTime(notif.createdAt)}
                        </span>
                      </div>
                      <p className={`text-xs leading-snug font-medium ${!notif.isRead ? 'text-on-surface' : 'text-on-surface-variant'}`}>
                        {notif.content}
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              {/* Invitations */}
              {invitations.length > 0 && (
                <div className="px-4 py-2 text-[10px] text-on-surface-variant/50 text-center uppercase tracking-widest bg-surface-container-lowest border-y border-outline-variant/5">
                  Lời mời
                </div>
              )}
              {invitations.map(inv => (
                <div key={inv.id} className="p-4 border-b border-outline-variant/5 hover:bg-surface-container-lowest transition-colors group">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                      <span className="material-symbols-outlined">group_add</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-on-surface leading-snug">
                        Bạn đã được mời tham gia dự án <strong>{inv.project.name}</strong> ({inv.project.key}) với vai trò <strong>{inv.role}</strong>.
                      </p>
                      <div className="flex gap-2 mt-3">
                        <button 
                          onClick={() => onRespondInvite(inv.id, "ACCEPT")}
                          className="flex-1 py-1.5 bg-primary text-on-primary rounded-lg text-[11px] font-bold hover:opacity-90 transition-all shadow-sm"
                        >
                          Chấp nhận
                        </button>
                        <button 
                          onClick={() => onRespondInvite(inv.id, "DECLINE")}
                          className="flex-1 py-1.5 bg-surface-container-high text-on-surface-variant rounded-lg text-[11px] font-bold hover:bg-error/10 hover:text-error transition-all"
                        >
                          Từ chối
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {notifications.length === 0 && invitations.length === 0 && (
                <div className="py-12 flex flex-col items-center justify-center text-on-surface-variant/30 italic">
                  <span className="material-symbols-outlined text-4xl mb-2 opacity-20">notifications_off</span>
                  <p className="text-xs">Không có thông báo nào</p>
                </div>
              )}
            </div>
            
            <div className="px-6 py-3 border-t border-outline-variant/10 bg-surface-container-lowest text-center">
              <button 
                onClick={markAllAsRead}
                className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline"
              >
                Đánh dấu tất cả đã đọc
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
