import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getActivities, getAvatarUrl } from '../services/api';
import { getSocket } from '../hooks/useSocket';
import VisualDiff from './VisualDiff';

/**
 * Hàm tính thời gian tương đối
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

/**
 * Tạo câu mô tả hành động tự nhiên (AC2)
 */
const getActionDescription = (actionType, entityType) => {
  const isTask = entityType?.toUpperCase() === 'TASK';
  const entityLabel = isTask ? 'Task' : 'User Story';

  switch (actionType) {
    case 'CREATED':
      return `đã tạo ${entityLabel}`;
    case 'UPDATED_STATUS':
      return 'đã chuyển trạng thái';
    case 'UPDATED_ASSIGNEE':
      return 'đã cập nhật người phụ trách';
    case 'UPDATED_TITLE':
      return 'đã đổi tiêu đề';
    case 'UPDATED_DESCRIPTION':
      return 'đã chỉnh sửa mô tả';
    case 'UPDATED_PRIORITY':
      return 'đã đổi mức độ ưu tiên';
    case 'ATTACHMENT_ADDED':
      return 'đã tải lên tệp đính kèm';
    case 'ATTACHMENT_REMOVED':
      return 'đã xóa tệp đính kèm';
    case 'COMMENT_ADDED':
      return 'đã thêm bình luận mới';
    case 'COMMENT_DELETED':
      return 'đã xóa bình luận';
    default:
      return 'đã cập nhật';
  }
};

/**
 * Icon đại diện cho từng loại hành động
 */
const getActionIcon = (actionType) => {
  switch (actionType) {
    case 'CREATED':
      return { icon: 'add_circle', color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40' };
    case 'UPDATED_STATUS':
      return { icon: 'published_with_changes', color: 'text-blue-500 bg-blue-50 dark:bg-blue-950/40' };
    case 'UPDATED_ASSIGNEE':
      return { icon: 'person_pin', color: 'text-purple-500 bg-purple-50 dark:bg-purple-950/40' };
    case 'UPDATED_TITLE':
      return { icon: 'edit_note', color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/40' };
    case 'UPDATED_DESCRIPTION':
      return { icon: 'description', color: 'text-cyan-500 bg-cyan-50 dark:bg-cyan-950/40' };
    case 'UPDATED_PRIORITY':
      return { icon: 'flag', color: 'text-rose-500 bg-rose-50 dark:bg-rose-950/40' };
    case 'ATTACHMENT_ADDED':
      return { icon: 'attach_file', color: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-950/40' };
    case 'ATTACHMENT_REMOVED':
      return { icon: 'attachment', color: 'text-rose-500 bg-rose-50 dark:bg-rose-950/40' };
    case 'COMMENT_ADDED':
      return { icon: 'comment', color: 'text-sky-500 bg-sky-50 dark:bg-sky-950/40' };
    case 'COMMENT_DELETED':
      return { icon: 'delete_sweep', color: 'text-slate-500 bg-slate-50 dark:bg-slate-800' };
    default:
      return { icon: 'history', color: 'text-slate-500 bg-slate-50 dark:bg-slate-800' };
  }
};

export default function ActivityLog({ entityType, entityId }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  const containerRef = useRef(null);

  const normalizedType = entityType?.toUpperCase() === 'STORY' ? 'USER_STORY' : entityType?.toUpperCase();

  // Load danh sách ban đầu
  const fetchInitial = useCallback(async () => {
    if (!entityId || !normalizedType) return;
    setLoading(true);
    try {
      const res = await getActivities({
        entityType: normalizedType,
        entityId,
        limit: 15
      });
      setActivities(res.data?.activities || []);
      setNextCursor(res.data?.nextCursor || null);
      setHasMore(Boolean(res.data?.hasMore));
      setTotalCount(res.data?.totalCount || 0);
    } catch (err) {
      console.error('Lỗi tải Activity Logs:', err);
    } finally {
      setLoading(false);
    }
  }, [entityId, normalizedType]);

  useEffect(() => {
    fetchInitial();
  }, [fetchInitial]);

  // Load More (Cursor-based Pagination cho Infinite Scroll - DoD, AC2)
  const loadMore = async () => {
    if (!hasMore || !nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await getActivities({
        entityType: normalizedType,
        entityId,
        cursor: nextCursor,
        limit: 15
      });
      const newItems = res.data?.activities || [];
      setActivities(prev => [...prev, ...newItems]);
      setNextCursor(res.data?.nextCursor || null);
      setHasMore(Boolean(res.data?.hasMore));
    } catch (err) {
      console.error('Lỗi tải thêm Activity Logs:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  // Infinite Scroll Trigger khi cuộn xuống đáy container (AC2, DoD)
  const handleScroll = () => {
    if (!containerRef.current || loadingMore || !hasMore) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    if (scrollTop + clientHeight >= scrollHeight - 30) {
      loadMore();
    }
  };

  // Realtime WebSocket listener: tự động thêm hoạt động mới vào đầu danh sách
  useEffect(() => {
    if (!entityId || !normalizedType) return;
    const socket = getSocket();

    const room = normalizedType === 'TASK' ? `task_${entityId}` : `story_${entityId}`;
    if (socket.connected) {
      socket.emit('joinRoom', room);
    }

    const handleNewActivity = (log) => {
      if (
        log &&
        log.entityId === entityId &&
        log.entityType === normalizedType
      ) {
        setActivities(prev => {
          if (prev.some(item => item.id === log.id)) return prev;
          return [log, ...prev];
        });
        setTotalCount(c => c + 1);
      }
    };

    socket.on('activity:new', handleNewActivity);
    socket.on('activity:global_new', handleNewActivity);

    return () => {
      socket.off('activity:new', handleNewActivity);
      socket.off('activity:global_new', handleNewActivity);
    };
  }, [entityId, normalizedType]);

  if (loading) {
    return (
      <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
        <span className="material-symbols-outlined animate-spin text-2xl text-primary">sync</span>
        <span className="text-xs font-medium">Đang tải lịch sử thay đổi...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header trạng thái */}
      <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-200/80 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-base">manage_history</span>
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            Lịch sử hoạt động ({totalCount})
          </span>
        </div>
        <button
          onClick={fetchInitial}
          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
          title="Làm mới"
        >
          <span className="material-symbols-outlined text-sm">refresh</span>
        </button>
      </div>

      {/* Danh sách Activity Items (Chronological Order - Mới nhất lên đầu - AC2) */}
      <div 
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto max-h-[460px] pr-1 space-y-4"
      >
        {activities.length === 0 ? (
          <div className="py-12 text-center text-slate-400 italic text-xs">
            <span className="material-symbols-outlined text-3xl mb-1 opacity-30">history_toggle_off</span>
            <p>Chưa có lịch sử thay đổi nào được ghi nhận</p>
          </div>
        ) : (
          activities.map((act) => {
            const actorName = act.actor?.fullName || act.actor?.email || 'Hệ thống';
            const avatarUrl = getAvatarUrl(act.actor?.avatar);
            const { icon, color } = getActionIcon(act.actionType);

            return (
              <div 
                key={act.id} 
                className="group relative flex items-start gap-3 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 hover:shadow-sm transition-all"
              >
                {/* Avatar Người thực hiện (Actor Avatar) */}
                <div className="relative shrink-0">
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700 flex items-center justify-center">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={actorName} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                        {actorName.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  {/* Badge Icon nhỏ ở góc Avatar */}
                  <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-white dark:ring-slate-900 ${color}`}>
                    <span className="material-symbols-outlined text-[10px] leading-none">{icon}</span>
                  </div>
                </div>

                {/* Nội dung hoạt động */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2 flex-wrap">
                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-snug">
                      <strong className="text-slate-900 dark:text-white font-bold">{actorName}</strong>
                      {' '}
                      <span className="text-slate-600 dark:text-slate-400">
                        {getActionDescription(act.actionType, normalizedType)}
                      </span>
                    </p>
                    {/* Thời gian tương đối (ví dụ: "10 phút trước" - AC2) */}
                    <span className="text-[10px] text-slate-400 font-medium shrink-0">
                      {formatRelativeTime(act.createdAt)}
                    </span>
                  </div>

                  {/* Component Hiển thị Diff Trực quan (AC3) */}
                  <VisualDiff 
                    actionType={act.actionType} 
                    changesPayload={act.changesPayload} 
                  />
                </div>
              </div>
            );
          })
        )}

        {/* Nút hoặc Indicator Tải thêm (Infinite Scroll) */}
        {hasMore && (
          <div className="pt-2 text-center">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="px-4 py-2 text-xs font-bold text-primary bg-primary/5 hover:bg-primary/10 rounded-xl transition-all inline-flex items-center gap-1.5"
            >
              {loadingMore ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-sm">sync</span>
                  <span>Đang tải thêm...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-sm">expand_more</span>
                  <span>Tải thêm lịch sử cũ hơn</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

