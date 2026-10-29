import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  getStoryComments, 
  createStoryComment, 
  getTaskComments, 
  createTaskComment 
} from '../services/api';
import { useAuth } from '../context/AuthContext';
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
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);

  const isStory = entityType === 'story';
  const getCommentsFn = isStory ? getStoryComments : getTaskComments;
  const createCommentFn = isStory ? createStoryComment : createTaskComment;

  const loadComments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getCommentsFn(entityId);
      setComments(res.data || []);
    } catch (err) {
      console.error("Lỗi load comments:", err);
      setError("Không thể tải bình luận");
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, [entityId, getCommentsFn]);

  useEffect(() => {
    if (entityId) loadComments();
  }, [entityId, loadComments]);

  useSocket(projectId, (data) => {
    console.log("💬 CommentSection received socket data:", data);
    loadComments();
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [comments]);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    const content = newComment.trim();
    if (!content) return;
    
    if (!currentUser?.id) {
      setError("Bạn cần đăng nhập để bình luận");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await createCommentFn(entityId, content);
      setNewComment('');
      await loadComments();
    } catch (err) {
      console.error("Lỗi gửi comment:", err);
      const msg = err.response?.data?.error || "Không thể gửi bình luận";
      setError(msg);
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleString('vi-VN', { 
      hour: '2-digit', minute: '2-digit',
      day: '2-digit', month: '2-digit', year: 'numeric'
    });
  };

  return (
    <div className="mt-6 border-t border-outline-variant/20 pt-6">
      <h4 className="text-sm font-bold text-on-surface flex items-center gap-2 mb-4">
        <span className="material-symbols-outlined text-[18px]">forum</span>
        Thảo luận ({comments.length})
      </h4>

      <div 
        ref={scrollRef}
        className="space-y-4 max-h-[320px] overflow-y-auto pr-2 mb-6 custom-scrollbar scroll-smooth"
      >
        {comments.length === 0 && !loading && (
          <p className="text-xs text-on-surface-variant/50 italic text-center py-4">
            Chưa có bình luận nào. Hãy bắt đầu thảo luận!
          </p>
        )}

        {comments.map((comment) => (
          <div key={comment.id} className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
              {(comment.user?.fullName || comment.user?.email || '?').charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 bg-surface-container-low p-3 rounded-2xl rounded-tl-none border border-outline-variant/10">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[11px] font-bold text-on-surface">
                  {comment.user?.fullName || comment.user?.email}
                </span>
                <span className="text-[9px] text-on-surface-variant/60">
                  {formatTime(comment.createdAt)}
                </span>
              </div>
              <p className="text-[12px] text-on-surface-variant leading-relaxed">
                {comment.content}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <div className="flex-1 relative">
          <textarea
            className="w-full px-4 py-3 rounded-2xl border border-outline-variant bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none text-xs min-h-[44px]"
            placeholder="Viết bình luận..."
            rows="1"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            disabled={loading}
          />
        </div>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading || !newComment.trim()}
          className="w-11 h-11 bg-primary text-on-primary rounded-xl flex items-center justify-center shadow-lg hover:bg-primary/90 transition-all disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[20px]">send</span>
        </button>
      </div>

      {error && <p className="mt-2 text-[10px] text-error">{error}</p>}
    </div>
  );
}