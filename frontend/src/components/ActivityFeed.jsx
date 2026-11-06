import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getProjectActivities, getAvatarUrl } from '../services/api';
import { getSocket } from '../hooks/useSocket';

/**
 * Hàm định dạng thời gian tương đối tự viết (không dùng date-fns/moment)
 */
export const formatRelativeTime = (dateString) => {
  if (!dateString) return 'Vừa xong';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Vừa xong';
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

/**
 * Ánh xạ hành động sang tiếng Việt thân thiện
 */
export const getActionText = (action, targetType) => {
  switch (action) {
    case 'TASK_CREATED':
      return 'đã tạo task';
    case 'TASK_STATUS_CHANGED':
      return 'đã đổi trạng thái task';
    case 'TASK_UPDATED':
      return 'đã cập nhật task';
    case 'TASK_DELETED':
      return 'đã xóa task';
    case 'STORY_CREATED':
      return 'đã tạo user story';
    case 'STORY_STATUS_CHANGED':
      return 'đã đổi trạng thái user story';
    case 'STORY_UPDATED':
      return 'đã cập nhật user story';
    case 'STORY_DELETED':
      return 'đã xóa user story';
    case 'COMMENT_ADDED':
      return 'đã bình luận về';
    case 'SPRINT_CREATED':
      return 'đã tạo sprint';
    case 'SPRINT_STARTED':
      return 'đã bắt đầu sprint';
    case 'SPRINT_COMPLETED':
      return 'đã hoàn thành sprint';
    default:
      if (targetType === 'TASK') return 'đã cập nhật task';
      if (targetType === 'STORY') return 'đã cập nhật story';
      return 'đã thao tác trên';
  }
};

const getActionIcon = (action, targetType) => {
  if (action?.includes('COMMENT')) return 'chat_bubble';
  if (action?.includes('STATUS')) return 'swap_horiz';
  if (action?.includes('DELETE')) return 'delete_outline';
  if (action?.includes('CREATE')) return 'add_circle_outline';
  if (targetType === 'TASK') return 'check_circle_outline';
  if (targetType === 'STORY') return 'assignment';
  if (targetType === 'SPRINT') return 'directions_run';
  return 'history';
};

export default function ActivityFeed({ projectId }) {
  const [activities, setActivities] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isForbidden, setIsForbidden] = useState(false);
  const [error, setError] = useState(null);

  const containerRef = useRef(null);

  // Lắng nghe và xử lý sự kiện realtime với logic chống trùng lặp và giữ vị trí cuộn
  const handleNewActivity = useCallback((newActivity) => {
    if (!newActivity || !newActivity.id) return;
    if (newActivity.projectId && String(newActivity.projectId) !== String(projectId)) {
      return;
    }

    const container = containerRef.current;
    const isScrolledDown = container && container.scrollTop > 30;
    const prevScrollHeight = container ? container.scrollHeight : 0;
    const prevScrollTop = container ? container.scrollTop : 0;

    setActivities((prev) => {
      const exists = prev.some((item) => item.id === newActivity.id);
      if (exists) {
        return prev.map((item) => (item.id === newActivity.id ? { ...item, ...newActivity } : item));
      }
      return [newActivity, ...prev];
    });

    if (isScrolledDown && container) {
      requestAnimationFrame(() => {
        const heightDiff = container.scrollHeight - prevScrollHeight;
        if (heightDiff > 0) {
          container.scrollTop = prevScrollTop + heightDiff;
        }
      });
    }
  }, [projectId]);

  // Thiết lập Socket listener và cleanup
  useEffect(() => {
    if (!projectId) return;

    const socket = getSocket();
    if (socket) {
      if (socket.connected) {
        socket.emit('joinProject', projectId);
      }
      socket.on('ACTIVITY_CREATED', handleNewActivity);
    }

    return () => {
      if (socket) {
        socket.off('ACTIVITY_CREATED', handleNewActivity);
      }
    };
  }, [projectId, handleNewActivity]);

  // Gọi API tải dữ liệu Activity Feed
  const fetchActivities = async (cursor = null, isInitial = false) => {
    if (!projectId) return;

    try {
      if (isInitial) {
        setLoading(true);
        setIsForbidden(false);
        setError(null);
      } else {
        setLoadingMore(true);
      }

      const res = await getProjectActivities(projectId, {
        limit: 20,
        cursor: cursor || undefined
      });

      const data = res.data || { items: [], nextCursor: null };
      if (isInitial) {
        setActivities(data.items || []);
      } else {
        setActivities((prev) => {
          const existingIds = new Set(prev.map((a) => a.id));
          const uniqueItems = (data.items || []).filter((a) => !existingIds.has(a.id));
          return [...prev, ...uniqueItems];
        });
      }
      setNextCursor(data.nextCursor || null);
    } catch (err) {
      console.error('Lỗi tải activity feed:', err);
      if (err?.response?.status === 403) {
        setIsForbidden(true);
      } else {
        setError(err?.response?.data?.error || 'Không thể tải lịch sử hoạt động');
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchActivities(null, true);
  }, [projectId]);

  const handleLoadMore = () => {
    if (nextCursor && !loadingMore) {
      fetchActivities(nextCursor, false);
    }
  };

  // 1. Trạng thái lỗi phân quyền 403
  if (isForbidden) {
    return (
      <div className="bg-surface border border-outline-variant rounded-xl p-5 shadow-sm text-center">
        <div className="w-10 h-10 mx-auto rounded-full bg-error-container text-error flex items-center justify-center mb-2">
          <span className="material-symbols-outlined text-xl">lock</span>
        </div>
        <h4 className="text-sm font-semibold text-on-surface">Không có quyền truy cập</h4>
        <p className="text-xs text-on-surface-variant mt-1">
          Bạn không phải là thành viên của dự án này để xem Activity Feed.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-outline-variant rounded-xl p-5 shadow-sm flex flex-col h-full max-h-[500px]">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-outline-variant">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-xl">dynamic_feed</span>
          <h3 className="font-semibold text-sm text-on-surface">Hoạt động gần đây</h3>
        </div>
        <span className="text-[11px] font-medium text-primary px-2 py-0.5 rounded-full bg-primary/10">
          Realtime
        </span>
      </div>

      <div 
        ref={containerRef} 
        className="flex-1 overflow-y-auto pr-1 space-y-3"
      >
        {loading ? (
          <div className="py-8 flex flex-col items-center justify-center gap-2 text-on-surface-variant">
            <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
            <span className="text-xs">Đang tải hoạt động...</span>
          </div>
        ) : error ? (
          <div className="py-6 text-center text-xs text-error">
            {error}
          </div>
        ) : activities.length === 0 ? (
          <div className="py-8 text-center text-on-surface-variant">
            <span className="material-symbols-outlined text-3xl opacity-40 mb-1">hourglass_empty</span>
            <p className="text-xs font-medium">Chưa có hoạt động nào</p>
          </div>
        ) : (
          activities.map((item) => {
            const actorName = item.actor?.name || 'Thành viên';
            const actionText = getActionText(item.action, item.targetType);
            const targetTitle = item.targetTitle || `#${item.targetId || ''}`;
            const relativeTime = formatRelativeTime(item.createdAt);
            const avatar = item.actor?.avatarUrl || item.actor?.avatar;

            return (
              <div 
                key={item.id} 
                className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-surface-variant/40 transition-colors text-xs"
              >
                {/* Avatar / Icon */}
                <div className="relative shrink-0 mt-0.5">
                  {avatar ? (
                    <img 
                      src={getAvatarUrl(avatar)} 
                      alt={actorName} 
                      className="w-7 h-7 rounded-full object-cover border border-outline-variant"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-primary/10 text-primary font-semibold flex items-center justify-center text-[11px]">
                      {actorName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="material-symbols-outlined absolute -bottom-1 -right-1 text-[12px] bg-surface rounded-full p-0.5 text-on-surface-variant shadow-xs">
                    {getActionIcon(item.action, item.targetType)}
                  </span>
                </div>

                {/* Nội dung hoạt động: [Tên actor] + [Hành động] + [Tên đối tượng] + [Thời gian] */}
                <div className="flex-1 min-w-0">
                  <p className="text-on-surface leading-snug">
                    <span className="font-semibold text-on-surface">{actorName}</span>{' '}
                    <span className="text-on-surface-variant">{actionText}</span>{' '}
                    <span className="font-medium text-primary break-words">{targetTitle}</span>
                  </p>
                  <span className="text-[10px] text-on-surface-variant/70 mt-1 block">
                    {relativeTime}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Nút tải thêm */}
      {nextCursor && !loading && (
        <div className="pt-3 border-t border-outline-variant mt-2 text-center">
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="w-full py-1.5 px-3 rounded-lg text-xs font-medium text-primary hover:bg-primary/10 border border-primary/20 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {loadingMore ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                <span>Đang tải thêm...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-sm">expand_more</span>
                <span>Tải thêm hoạt động</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

