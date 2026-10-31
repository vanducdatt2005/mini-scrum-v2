import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  getStoryComments, 
  createStoryComment, 
  getTaskComments, 
  createTaskComment,
  deleteComment,
  getAvatarUrl
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import { getSocket } from '../context/SocketContext';
import useSocket from '../hooks/useSocket';

export default function CommentSection({ 
  entityId, 
  entityType = 'story',   // 'story' hoặc 'task'
  currentUser: currentUserProp,
  projectId
}) {
  const { user: authUser } = useAuth();
  const currentUser = authUser || currentUserProp || (() => {
    try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
  })();

  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);

  const isStory = entityType === 'story';
  const getCommentsFn = isStory ? getStoryComments : getTaskComments;
  const createCommentFn = isStory ? createStoryComment : createTaskComment;

  const loadComments = useCallback(async (isSilent = false) => {
    if (!entityId) return;
    try {
      if (!isSilent) setLoading(true);
      setError(null);
      const res = await getCommentsFn(entityId);
      setComments(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Lỗi tải bình luận:", err);
      if (!isSilent) {
        setError("Không thể tải danh sách bình luận");
      }
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [entityId, getCommentsFn]);

  // Tải danh sách comment ban đầu
  useEffect(() => {
    if (entityId) {
      loadComments();
    }
  }, [entityId, loadComments]);

  // Kết nối Socket.io Realtime trực tiếp cho Story/Task
  useEffect(() => {
    if (!entityId) return;

    const socket = getSocket();
    if (!socket) return;

    const roomName = isStory ? `story_${entityId}` : `task_${entityId}`;
    const joinEvent = isStory ? 'joinStory' : 'joinTask';
    const leaveEvent = isStory ? 'leaveStory' : 'leaveTask';

    // Tham gia phòng Socket riêng của Entity (Story hoặc Task)
    if (socket.connected) {
      socket.emit(joinEvent, entityId);
    } else {
      socket.once('connect', () => {
        socket.emit(joinEvent, entityId);
      });
    }

    // Xử lý khi có bình luận mới được tạo realtime
    const handleNewComment = (payload) => {
      console.log('💬 [Realtime] comment:new received:', payload);
      const targetId = payload.entityId || payload.comment?.userStoryId || payload.comment?.taskId;
      
      if (String(targetId) === String(entityId)) {
        if (payload.action === 'create' && payload.comment) {
          setComments((prev) => {
            // Tránh trùng lặp nếu người gửi là chính client này
            if (prev.some((c) => c.id === payload.comment.id)) {
              return prev;
            }
            return [...prev, payload.comment];
          });
        } else if (payload.action === 'delete') {
          const delId = payload.commentId || payload.comment?.id;
          if (delId) {
            setComments((prev) => prev.filter((c) => c.id !== delId));
          }
        } else {
          loadComments(true);
        }
      }
    };

    // Xử lý khi có thay đổi chung từ project room
    const handleCommentChanged = (payload) => {
      const targetId = payload.entityId || payload.data?.userStoryId || payload.data?.taskId || payload.comment?.userStoryId || payload.comment?.taskId;
      if (String(targetId) === String(entityId)) {
        console.log('💬 [Realtime] comment:changed for current entity, syncing...');
        if (payload.action === 'create' && (payload.comment || payload.data?.content)) {
          const newC = payload.comment || payload.data;
          setComments((prev) => {
            if (prev.some((c) => c.id === newC.id)) return prev;
            return [...prev, newC];
          });
        } else if (payload.action === 'delete') {
          const delId = payload.commentId || payload.entityId;
          setComments((prev) => prev.filter((c) => c.id !== delId));
        } else {
          loadComments(true);
        }
      }
    };

    // Xử lý khi bình luận bị xóa
    const handleCommentDeleted = (payload) => {
      console.log('🗑️ [Realtime] comment:deleted received:', payload);
      const targetId = payload.entityId;
      if (String(targetId) === String(entityId)) {
        const delId = payload.commentId;
        if (delId) {
          setComments((prev) => prev.filter((c) => c.id !== delId));
        } else {
          loadComments(true);
        }
      }
    };

    socket.on('comment:new', handleNewComment);
    socket.on('comment:changed', handleCommentChanged);
    socket.on('comment:deleted', handleCommentDeleted);

    return () => {
      if (socket.connected) {
        socket.emit(leaveEvent, entityId);
      }
      socket.off('comment:new', handleNewComment);
      socket.off('comment:changed', handleCommentChanged);
      socket.off('comment:deleted', handleCommentDeleted);
    };
  }, [entityId, isStory, loadComments]);

  // Phối hợp thêm với useSocket(projectId) nếu có projectId để dự phòng
  useSocket(projectId, (data) => {
    if (data?.model === 'Comment' || data?.action?.includes('comment') || data?.entityType === entityType) {
      console.log('💬 [useSocket-Fallback] Project room comment change detected:', data);
      const targetId = data?.entityId || data?.data?.userStoryId || data?.data?.taskId;
      if (String(targetId) === String(entityId)) {
        loadComments(true);
      }
    }
  });

  // Tự động cuộn xuống khi có tin nhắn/bình luận mới
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [comments]);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    const content = newComment.trim();
    if (!content) return;
    
    if (!currentUser?.id) {
      setError("Bạn cần đăng nhập để gửi bình luận");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const res = await createCommentFn(entityId, content);
      setNewComment('');
      
      // Cập nhật optimistic ngay lập tức nếu server trả về bản ghi hợp lệ
      if (res?.data && res.data.id) {
        setComments((prev) => {
          if (prev.some((c) => c.id === res.data.id)) return prev;
          return [...prev, res.data];
        });
      }
    } catch (err) {
      console.error("Lỗi gửi bình luận:", err);
      const msg = err.response?.data?.error || "Không thể gửi bình luận. Vui lòng thử lại!";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa bình luận này?")) return;

    try {
      setDeletingId(commentId);
      // Xóa optimistic trên UI trước
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      await deleteComment(commentId);
    } catch (err) {
      console.error("Lỗi xóa bình luận:", err);
      alert(err.response?.data?.error || "Không thể xóa bình luận");
      loadComments(true); // Tải lại nếu xóa thất bại
    } finally {
      setDeletingId(null);
    }
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    
    return date.toLocaleString('vi-VN', { 
      hour: '2-digit', 
      minute: '2-digit',
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric'
    });
  };

  return (
    <div className="mt-4 border-t border-outline-variant/20 pt-4">
      {/* Header Thảo luận với chỉ báo Realtime */}
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-primary">forum</span>
          <span>Thảo luận ({comments.length})</span>
        </h4>

        {/* Live indicator badge */}
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-success/10 text-success text-[10px] font-semibold border border-success/20">
          <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse"></span>
          <span>Trực tiếp</span>
        </div>
      </div>

      {/* Danh sách bình luận */}
      <div 
        ref={scrollRef}
        className="space-y-3 max-h-[300px] overflow-y-auto pr-1 mb-4 custom-scrollbar scroll-smooth"
      >
        {loading && comments.length === 0 && (
          <div className="flex items-center justify-center py-6 text-on-surface-variant/60 gap-2 text-xs">
            <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>
            <span>Đang tải bình luận...</span>
          </div>
        )}

        {!loading && comments.length === 0 && (
          <div className="p-6 text-center bg-surface-container-low/40 rounded-2xl border border-dashed border-outline-variant/20">
            <span className="material-symbols-outlined text-2xl text-on-surface-variant/40 mb-1">chat_bubble_outline</span>
            <p className="text-xs text-on-surface-variant/70 italic">
              Chưa có bình luận nào. Hãy bắt đầu cuộc trò chuyện!
            </p>
          </div>
        )}

        {comments.map((comment) => {
          const isOwnComment = currentUser?.id && (comment.userId === currentUser.id || comment.user?.id === currentUser.id);
          const authorName = comment.user?.fullName || comment.user?.email || 'Người dùng';
          const authorAvatar = comment.user?.avatar;

          return (
            <div 
              key={comment.id} 
              className="flex gap-2.5 group/item transition-all animate-in fade-in slide-in-from-bottom-1 duration-200"
            >
              {/* Avatar người dùng */}
              <div className="w-7 h-7 rounded-full overflow-hidden bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0 border border-primary/20 shadow-sm mt-0.5">
                {authorAvatar ? (
                  <img 
                    src={getAvatarUrl(authorAvatar)} 
                    alt={authorName} 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  authorName.charAt(0).toUpperCase()
                )}
              </div>

              {/* Hộp nội dung bình luận */}
              <div className="flex-1 bg-surface-container-low/80 hover:bg-surface-container-low p-2.5 rounded-2xl rounded-tl-sm border border-outline-variant/15 transition-colors">
                <div className="flex justify-between items-center mb-1 gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-bold text-on-surface leading-none">
                      {authorName}
                    </span>
                    {isOwnComment && (
                      <span className="text-[9px] font-semibold bg-primary/10 text-primary px-1.5 py-0.2 rounded-full border border-primary/20">
                        Bạn
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[9px] text-on-surface-variant/60" title={comment.createdAt ? new Date(comment.createdAt).toLocaleString('vi-VN') : ''}>
                      {formatTime(comment.createdAt)}
                    </span>
                    
                    {/* Nút xóa bình luận (cho tác giả) */}
                    {isOwnComment && (
                      <button
                        type="button"
                        onClick={() => handleDelete(comment.id)}
                        disabled={deletingId === comment.id}
                        className="opacity-0 group-hover/item:opacity-100 p-0.5 text-on-surface-variant/40 hover:text-error hover:bg-error/10 rounded transition-all"
                        title="Xóa bình luận"
                      >
                        <span className="material-symbols-outlined text-[13px] leading-none">delete</span>
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-[12px] text-on-surface leading-relaxed whitespace-pre-wrap break-words">
                  {comment.content}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Khung nhập bình luận mới */}
      <div className="flex gap-2 items-end">
        <div className="flex-1 relative">
          <textarea
            className="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant/40 bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none text-xs min-h-[44px] max-h-[100px] transition-all placeholder:text-on-surface-variant/40"
            placeholder="Viết bình luận... (Enter để gửi, Shift+Enter xuống dòng)"
            rows="1"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            disabled={submitting}
          />
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || !newComment.trim()}
          className="h-[44px] px-3.5 bg-primary text-on-primary rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-primary/20 hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-50 disabled:shadow-none shrink-0"
          title="Gửi bình luận"
        >
          {submitting ? (
            <span className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin"></span>
          ) : (
            <>
              <span className="material-symbols-outlined text-[18px]">send</span>
              <span className="text-xs font-bold hidden sm:inline">Gửi</span>
            </>
          )}
        </button>
      </div>

      {error && (
        <p className="mt-2 text-[11px] text-error flex items-center gap-1">
          <span className="material-symbols-outlined text-[14px]">error</span>
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
