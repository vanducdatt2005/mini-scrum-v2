import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  getStoryComments, 
  createStoryComment, 
  getTaskComments, 
  createTaskComment,
  updateComment,
  deleteComment,
  uploadCommentAttachment,
  getProjectMembers,
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
  const [error, setError] = useState(null);

  // File attachments state
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const fileInputRef = useRef(null);

  // Inline edit state
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete modal state
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // @Mention state
  const [members, setMembers] = useState([]);
  const [mentionQuery, setMentionQuery] = useState(null); // string query or null
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionStartPos, setMentionStartPos] = useState(-1);
  const textareaRef = useRef(null);
  const mentionDropdownRef = useRef(null);

  const scrollRef = useRef(null);

  const isStory = entityType.toLowerCase().includes('story');
  const getCommentsFn = isStory ? getStoryComments : getTaskComments;
  const createCommentFn = isStory ? createStoryComment : createTaskComment;

  // 1. Tải danh sách thành viên dự án để gợi ý @mention
  useEffect(() => {
    let isMounted = true;
    if (projectId) {
      getProjectMembers(projectId)
        .then((res) => {
          if (!isMounted) return;
          const memberList = (res.data || [])
            .map((m) => m.user || m)
            .filter((u) => u && u.id);
          setMembers(memberList);
        })
        .catch((err) => {
          console.warn("Không thể tải danh sách thành viên cho @mention:", err);
        });
    }
    return () => { isMounted = false; };
  }, [projectId]);

  // 2. Tải danh sách bình luận
  const loadComments = useCallback(async (isSilent = false) => {
    if (!entityId) return;
    try {
      if (!isSilent) setLoading(true);
      setError(null);
      const res = await getCommentsFn(entityId);
      const data = res?.data;
      if (Array.isArray(data)) {
        setComments(data);
      } else if (data && Array.isArray(data.comments)) {
        setComments(data.comments);
      } else {
        setComments([]);
      }
    } catch (err) {
      console.error("Lỗi tải bình luận:", err);
      if (!isSilent) {
        setError("Không thể tải danh sách bình luận");
      }
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [entityId, getCommentsFn]);

  useEffect(() => {
    if (entityId) {
      loadComments();
    }
  }, [entityId, loadComments]);

  // 3. Socket Room và Real-time Listeners (AC4)
  useEffect(() => {
    if (!entityId) return;

    const socket = getSocket();
    if (!socket) return;

    const joinEvent = isStory ? 'JOIN_STORY_ROOM' : 'JOIN_TASK_ROOM';
    const leaveEvent = isStory ? 'LEAVE_STORY_ROOM' : 'LEAVE_TASK_ROOM';
    const legacyJoin = isStory ? 'joinStory' : 'joinTask';
    const legacyLeave = isStory ? 'leaveStory' : 'leaveTask';

    // Tham gia phòng Socket riêng của Task / User Story
    const doJoin = () => {
      socket.emit(joinEvent, entityId);
      socket.emit(legacyJoin, entityId);
      console.log(`📡 [Socket] Joined room for ${entityType} ${entityId}`);
    };

    if (socket.connected) {
      doJoin();
    } else {
      socket.once('connect', doJoin);
    }

    // Handler khi có comment mới
    const handleCommentCreated = (payload) => {
      const targetId = payload?.entityId || payload?.comment?.taskId || payload?.comment?.userStoryId;
      if (String(targetId) === String(entityId)) {
        const commentObj = payload.comment || payload.data;
        if (commentObj && commentObj.id) {
          setComments((prev) => {
            if (prev.some((c) => c.id === commentObj.id)) return prev;
            return [...prev, commentObj];
          });
        } else {
          loadComments(true);
        }
      }
    };

    // Handler khi comment được cập nhật (Edit)
    const handleCommentUpdated = (payload) => {
      const targetId = payload?.entityId || payload?.comment?.taskId || payload?.comment?.userStoryId;
      if (String(targetId) === String(entityId)) {
        const commentObj = payload.comment || payload.data;
        if (commentObj && commentObj.id) {
          setComments((prev) => prev.map((c) => (c.id === commentObj.id ? { ...c, ...commentObj } : c)));
        } else {
          loadComments(true);
        }
      }
    };

    // Handler khi comment bị xóa (Delete)
    const handleCommentDeleted = (payload) => {
      const targetId = payload?.entityId;
      if (String(targetId) === String(entityId)) {
        const delId = payload.commentId || payload.id;
        if (delId) {
          setComments((prev) => prev.filter((c) => c.id !== delId));
        } else {
          loadComments(true);
        }
      }
    };

    // Đăng ký cả event chuẩn và legacy events
    socket.on('COMMENT_CREATED', handleCommentCreated);
    socket.on('comment:new', handleCommentCreated);

    socket.on('COMMENT_UPDATED', handleCommentUpdated);
    socket.on('comment:changed', handleCommentUpdated);

    socket.on('COMMENT_DELETED', handleCommentDeleted);
    socket.on('comment:deleted', handleCommentDeleted);

    return () => {
      if (socket.connected) {
        socket.emit(leaveEvent, entityId);
        socket.emit(legacyLeave, entityId);
      }
      socket.off('COMMENT_CREATED', handleCommentCreated);
      socket.off('comment:new', handleCommentCreated);
      socket.off('COMMENT_UPDATED', handleCommentUpdated);
      socket.off('comment:changed', handleCommentUpdated);
      socket.off('COMMENT_DELETED', handleCommentDeleted);
      socket.off('comment:deleted', handleCommentDeleted);
    };
  }, [entityId, isStory, entityType, loadComments]);

  // Phối hợp thêm useSocket fallback với Project Room
  useSocket(projectId, (data) => {
    if (data?.model === 'Comment' || data?.action?.includes('comment') || data?.entityType === entityType) {
      const targetId = data?.entityId || data?.data?.userStoryId || data?.data?.taskId;
      if (String(targetId) === String(entityId)) {
        loadComments(true);
      }
    }
  });

  // Tự động cuộn xuống dưới cùng khi có bình luận mới
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [comments]);

  // ============================================================
  // XỬ LÝ GÕ VÀ GỢI Ý @MENTION (AC1)
  // ============================================================
  const filteredMembers = React.useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return members.filter((m) => {
      const name = (m.fullName || '').toLowerCase();
      const email = (m.email || '').toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [members, mentionQuery]);

  const handleTextareaChange = (e) => {
    const text = e.target.value;
    const pos = e.target.selectionStart;
    setNewComment(text);

    // Tìm xem con trỏ có đang nằm ngay sau ký tự '@' không
    const leftText = text.slice(0, pos);
    const lastAtIndex = leftText.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      // Đảm bảo @ đứng ở đầu chuỗi hoặc sau dấu cách/xuống dòng
      const charBeforeAt = lastAtIndex > 0 ? leftText[lastAtIndex - 1] : ' ';
      if (/[\s\n]/.test(charBeforeAt)) {
        const query = leftText.slice(lastAtIndex + 1);
        // Nếu không có khoảng trắng hoặc ký tự ngắt thì hiển thị popup
        if (!/[\s\n]/.test(query) && query.length <= 30) {
          setMentionQuery(query);
          setMentionStartPos(lastAtIndex);
          setMentionIndex(0);
          return;
        }
      }
    }

    setMentionQuery(null);
    setMentionStartPos(-1);
  };

  const insertMention = (member) => {
    if (!member || mentionStartPos === -1) return;
    const name = member.fullName || member.email || 'Thành viên';
    const mentionToken = `@[${name}](${member.id}) `;

    const before = newComment.slice(0, mentionStartPos);
    const cursorPos = textareaRef.current ? textareaRef.current.selectionStart : mentionStartPos + (mentionQuery?.length || 0) + 1;
    const after = newComment.slice(cursorPos);

    const updatedText = before + mentionToken + after;
    setNewComment(updatedText);
    setMentionQuery(null);
    setMentionStartPos(-1);

    setTimeout(() => {
      if (textareaRef.current) {
        const newPos = before.length + mentionToken.length;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newPos, newPos);
      }
    }, 0);
  };

  // ============================================================
  // XỬ LÝ PHÍM TẮT (Ctrl + Enter, Phím mũi tên khi Mention)
  // ============================================================
  const handleKeyDown = (e) => {
    // Nếu đang mở menu gợi ý Mention
    if (mentionQuery !== null && filteredMembers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex((prev) => (prev + 1) % filteredMembers.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex((prev) => (prev - 1 + filteredMembers.length) % filteredMembers.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(filteredMembers[mentionIndex]);
        return;
      }
      if (e.key === 'Escape') {
        setMentionQuery(null);
        return;
      }
    }

    // Phím tắt gửi: Ctrl + Enter hoặc Cmd + Enter (AC1)
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
      return;
    }

    // Enter thường (không Shift) để gửi nhanh nếu không mở popup
    if (e.key === 'Enter' && !e.shiftKey && mentionQuery === null) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // ============================================================
  // XỬ LÝ FILE ĐÍNH KÈM
  // ============================================================
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const fileObjects = files.map((file) => {
      const isImage = file.type.startsWith('image/');
      return {
        file,
        previewUrl: isImage ? URL.createObjectURL(file) : null,
        name: file.name,
        size: file.size,
        type: file.type
      };
    });

    setSelectedFiles((prev) => [...prev, ...fileObjects].slice(0, 5)); // Tối đa 5 file
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeSelectedFile = (index) => {
    setSelectedFiles((prev) => {
      const removed = prev[index];
      if (removed && removed.previewUrl) {
        URL.revokeObjectURL(removed.previewUrl);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  // ============================================================
  // GỬI BÌNH LUẬN MỚI
  // ============================================================
  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    const content = newComment.trim();
    if (!content && selectedFiles.length === 0) return;

    if (!currentUser?.id) {
      setError("Bạn cần đăng nhập để gửi bình luận");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      // 1. Nếu có file đính kèm, upload lên trước
      let attachmentIds = [];
      if (selectedFiles.length > 0) {
        setUploadingFiles(true);
        const formData = new FormData();
        selectedFiles.forEach((item) => formData.append('files', item.file));

        const uploadRes = await uploadCommentAttachment(formData);
        const uploadedData = uploadRes.data;
        if (Array.isArray(uploadedData)) {
          attachmentIds = uploadedData.map((a) => a.id);
        } else if (uploadedData && uploadedData.id) {
          attachmentIds = [uploadedData.id];
        }
      }

      // 2. Tạo bình luận kèm attachmentIds
      const res = await createCommentFn(entityId, {
        content: content || "Đã gửi tệp đính kèm",
        attachmentIds
      });

      // 3. Clear form state & thumbnails
      setNewComment('');
      selectedFiles.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
      setSelectedFiles([]);
      setMentionQuery(null);

      // Optimistic update
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
      setUploadingFiles(false);
    }
  };

  // ============================================================
  // CHỈNH SỬA BÌNH LUẬN (INLINE EDIT - AC3)
  // ============================================================
  const handleStartEdit = (comment) => {
    setEditingId(comment.id);
    setEditContent(comment.content);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditContent('');
  };

  const handleSaveEdit = async (commentId) => {
    if (!editContent.trim()) {
      alert("Nội dung bình luận không được để trống!");
      return;
    }
    try {
      setSavingEdit(true);
      const res = await updateComment(commentId, { content: editContent.trim() });
      const updated = res.data;

      setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, ...updated } : c)));
      setEditingId(null);
      setEditContent('');
    } catch (err) {
      console.error("Lỗi lưu chỉnh sửa:", err);
      alert(err.response?.data?.error || "Không thể cập nhật bình luận");
    } finally {
      setSavingEdit(false);
    }
  };

  // ============================================================
  // XÓA BÌNH LUẬN (MODAL XÁC NHẬN - AC3)
  // ============================================================
  const handleConfirmDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      setDeleting(true);
      const targetId = deleteConfirmId;
      setComments((prev) => prev.filter((c) => c.id !== targetId));
      await deleteComment(targetId);
      setDeleteConfirmId(null);
    } catch (err) {
      console.error("Lỗi xóa bình luận:", err);
      alert(err.response?.data?.error || "Không thể xóa bình luận");
      loadComments(true);
    } finally {
      setDeleting(false);
      setDeleteConfirmId(null);
    }
  };

  // ============================================================
  // HELPER FORMAT & PARSER
  // ============================================================
  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays < 7) return `${diffDays} ngày trước`;

    return date.toLocaleString('vi-VN', { 
      hour: '2-digit', 
      minute: '2-digit',
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric'
    });
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Render text có bóc tách và highlight @Mention
  const renderCommentContent = (content = '') => {
    if (!content) return null;
    const mentionRegex = /@\[([^\]]+)\]\(([a-zA-Z0-9_\-]+)\)/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = mentionRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push(content.slice(lastIndex, match.index));
      }
      const mentionName = match[1];
      const mentionUserId = match[2];
      const isMentionMe = currentUser?.id && String(mentionUserId) === String(currentUser.id);

      parts.push(
        <span 
          key={`m-${match.index}`}
          className={`inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded-lg text-[11px] font-bold transition-colors ${
            isMentionMe 
              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60' 
              : 'bg-primary/10 text-primary border border-primary/20 dark:bg-primary/20'
          }`}
        >
          @{mentionName}
        </span>
      );
      lastIndex = mentionRegex.lastIndex;
    }

    if (lastIndex < content.length) {
      parts.push(content.slice(lastIndex));
    }

    return parts;
  };

  return (
    <div className="mt-4 border-t border-outline-variant/20 pt-4">
      {/* Header Thảo luận với Live Indicator */}
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-primary">forum</span>
          <span>Bình luận & Thảo luận ({comments.length})</span>
        </h4>

        {/* Live indicator badge */}
        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 text-[10px] font-bold border border-emerald-300/40">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Realtime</span>
        </div>
      </div>

      {/* Danh sách bình luận */}
      <div 
        ref={scrollRef}
        className="space-y-3.5 max-h-[380px] overflow-y-auto pr-1 mb-4 custom-scrollbar scroll-smooth"
      >
        {loading && comments.length === 0 && (
          <div className="flex items-center justify-center py-8 text-on-surface-variant/60 gap-2 text-xs">
            <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>
            <span>Đang tải bình luận...</span>
          </div>
        )}

        {!loading && comments.length === 0 && (
          <div className="p-6 text-center bg-surface-container-low/40 dark:bg-slate-800/30 rounded-2xl border border-dashed border-outline-variant/30">
            <span className="material-symbols-outlined text-3xl text-on-surface-variant/40 mb-1">chat_bubble_outline</span>
            <p className="text-xs text-on-surface-variant/70 italic">
              Chưa có bình luận nào. Hãy bắt đầu trao đổi hoặc gắn thẻ đồng đội bằng ký tự @!
            </p>
          </div>
        )}

        {comments.map((comment) => {
          const isOwnComment = currentUser?.id && (comment.userId === currentUser.id || comment.user?.id === currentUser.id);
          const authorName = comment.user?.fullName || comment.user?.email || 'Người dùng';
          const authorAvatar = comment.user?.avatar;
          const isBeingEdited = editingId === comment.id;
          const attachments = comment.attachments || [];

          return (
            <div 
              key={comment.id} 
              className="flex gap-2.5 group/item transition-all animate-in fade-in slide-in-from-bottom-1 duration-200"
            >
              {/* Avatar người dùng */}
              <div className="w-8 h-8 rounded-full overflow-hidden bg-primary/10 text-primary flex items-center justify-center text-[11px] font-bold shrink-0 border border-primary/20 shadow-sm mt-0.5">
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
              <div className="flex-1 bg-surface-container-low/90 dark:bg-slate-800/60 hover:bg-surface-container-low p-3 rounded-2xl rounded-tl-sm border border-outline-variant/20 transition-all shadow-sm">
                <div className="flex justify-between items-center mb-1.5 gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[12px] font-bold text-on-surface">
                      {authorName}
                    </span>
                    {isOwnComment && (
                      <span className="text-[9px] font-semibold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full border border-primary/20">
                        Bạn
                      </span>
                    )}
                    {comment.isEdited && (
                      <span className="text-[10px] text-on-surface-variant/60 italic">
                        (Đã chỉnh sửa)
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] text-on-surface-variant/60" title={comment.createdAt ? new Date(comment.createdAt).toLocaleString('vi-VN') : ''}>
                      {formatTime(comment.createdAt)}
                    </span>

                    {/* Actions: Sửa & Xóa (AC3) */}
                    {!isBeingEdited && (
                      <div className="opacity-0 group-hover/item:opacity-100 flex items-center gap-1 transition-opacity">
                        {isOwnComment && (
                          <button
                            type="button"
                            onClick={() => handleStartEdit(comment)}
                            className="p-1 text-on-surface-variant/60 hover:text-primary hover:bg-primary/10 rounded transition-all"
                            title="Chỉnh sửa bình luận"
                          >
                            <span className="material-symbols-outlined text-[14px]">edit</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(comment.id)}
                          className="p-1 text-on-surface-variant/60 hover:text-error hover:bg-error/10 rounded transition-all"
                          title="Xóa bình luận"
                        >
                          <span className="material-symbols-outlined text-[14px]">delete</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Nội dung hoặc Chế độ Inline Edit */}
                {isBeingEdited ? (
                  <div className="mt-2 space-y-2">
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="w-full p-2.5 text-xs rounded-xl border border-primary bg-surface-container-lowest outline-none resize-none min-h-[60px]"
                      rows={2}
                      autoFocus
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        disabled={savingEdit}
                        className="px-2.5 py-1 text-xs rounded-lg hover:bg-surface-variant/40 font-semibold"
                      >
                        Hủy
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(comment.id)}
                        disabled={savingEdit || !editContent.trim()}
                        className="px-3 py-1 text-xs rounded-lg bg-primary text-on-primary font-bold hover:bg-primary/90 flex items-center gap-1 shadow-sm"
                      >
                        {savingEdit && <span className="w-3 h-3 border-2 border-on-primary border-t-transparent rounded-full animate-spin"></span>}
                        <span>Lưu</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-[12px] text-on-surface leading-relaxed whitespace-pre-wrap break-words">
                    {renderCommentContent(comment.content)}
                  </div>
                )}

                {/* Danh sách tệp đính kèm trong bình luận */}
                {attachments.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-outline-variant/15 flex flex-wrap gap-2">
                    {attachments.map((att) => {
                      const isImg = att.fileType && att.fileType.startsWith('image/');
                      return (
                        <div 
                          key={att.id}
                          className="group/att flex items-center gap-2 p-1.5 pr-2.5 bg-surface-container-lowest dark:bg-slate-900 rounded-xl border border-outline-variant/30 hover:border-primary/50 transition-all text-xs"
                        >
                          {isImg ? (
                            <a href={att.fileUrl} target="_blank" rel="noreferrer" className="block w-8 h-8 rounded-lg overflow-hidden shrink-0 border border-outline-variant/20">
                              <img src={att.fileUrl} alt={att.fileName} className="w-full h-full object-cover group-hover/att:scale-105 transition-transform" />
                            </a>
                          ) : (
                            <span className="material-symbols-outlined text-[18px] text-primary">description</span>
                          )}

                          <a 
                            href={att.fileUrl} 
                            target="_blank" 
                            rel="noreferrer" 
                            download 
                            className="flex flex-col truncate max-w-[160px] hover:text-primary transition-colors"
                          >
                            <span className="font-semibold truncate text-[11px]">{att.fileName}</span>
                            <span className="text-[9px] text-on-surface-variant/60">{formatFileSize(att.fileSize)}</span>
                          </a>

                          <a 
                            href={att.fileUrl} 
                            target="_blank" 
                            rel="noreferrer" 
                            download
                            className="p-1 hover:text-primary rounded" 
                            title="Tải về"
                          >
                            <span className="material-symbols-outlined text-[14px]">download</span>
                          </a>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Xem trước tệp đính kèm chuẩn bị gửi */}
      {selectedFiles.length > 0 && (
        <div className="mb-2 p-2 bg-surface-container-low/60 rounded-xl border border-outline-variant/20 flex flex-wrap gap-2">
          {selectedFiles.map((fileObj, idx) => (
            <div 
              key={idx} 
              className="flex items-center gap-1.5 pl-1.5 pr-1 py-1 rounded-lg bg-surface-container-lowest border border-outline-variant/30 text-[11px]"
            >
              {fileObj.previewUrl ? (
                <img src={fileObj.previewUrl} alt="preview" className="w-6 h-6 object-cover rounded" />
              ) : (
                <span className="material-symbols-outlined text-[16px] text-primary">attach_file</span>
              )}
              <span className="max-w-[120px] truncate font-medium">{fileObj.name}</span>
              <button
                type="button"
                onClick={() => removeSelectedFile(idx)}
                className="p-0.5 hover:text-error rounded"
                title="Bỏ tệp"
              >
                <span className="material-symbols-outlined text-[14px]">close</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Khung nhập bình luận mới & Popup @Mention */}
      <div className="relative">
        {/* Dropdown Gợi ý @Mention (AC1) */}
        {mentionQuery !== null && filteredMembers.length > 0 && (
          <div 
            ref={mentionDropdownRef}
            className="absolute bottom-full left-0 mb-2 w-64 max-h-52 overflow-y-auto bg-surface-container-lowest dark:bg-slate-900 rounded-2xl shadow-xl border border-outline-variant/30 py-1 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150"
          >
            <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/60 border-b border-outline-variant/20">
              Nhắc tên thành viên
            </div>
            {filteredMembers.map((member, index) => {
              const isSelected = index === mentionIndex;
              const name = member.fullName || member.email || 'Thành viên';
              return (
                <div
                  key={member.id}
                  onClick={() => insertMention(member)}
                  className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors ${
                    isSelected ? 'bg-primary/10 text-primary font-bold' : 'hover:bg-surface-variant/40 text-on-surface'
                  }`}
                >
                  <div className="w-6 h-6 rounded-full overflow-hidden bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
                    {member.avatar ? (
                      <img src={getAvatarUrl(member.avatar)} alt={name} className="w-full h-full object-cover" />
                    ) : (
                      name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="truncate text-xs">
                    <p className="truncate leading-tight">{name}</p>
                    {member.email && <p className="text-[10px] text-on-surface-variant/60 truncate">{member.email}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex gap-2 items-end">
          {/* Nút đính kèm tệp */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.zip"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="h-[44px] w-[44px] rounded-xl border border-outline-variant/40 bg-surface-container-lowest hover:bg-surface-container-low flex items-center justify-center text-on-surface-variant/70 hover:text-primary transition-all shrink-0"
            title="Đính kèm tệp / hình ảnh"
          >
            <span className="material-symbols-outlined text-[20px]">attach_file</span>
          </button>

          {/* Textarea nhập nội dung */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              className="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant/40 bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none text-xs min-h-[44px] max-h-[110px] transition-all placeholder:text-on-surface-variant/40 leading-relaxed"
              placeholder="Nhập bình luận... (Gõ @ để nhắc tên đồng đội, Ctrl+Enter để gửi)"
              rows="1"
              value={newComment}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              disabled={submitting}
            />
          </div>

          {/* Nút gửi */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || (!newComment.trim() && selectedFiles.length === 0)}
            className="h-[44px] px-4 bg-primary text-on-primary rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-primary/20 hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-50 disabled:shadow-none shrink-0"
            title="Gửi bình luận (Ctrl + Enter)"
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
      </div>

      {error && (
        <p className="mt-2 text-[11px] text-error flex items-center gap-1 animate-in fade-in">
          <span className="material-symbols-outlined text-[14px]">error</span>
          <span>{error}</span>
        </p>
      )}

      {/* Modal Xác nhận Xóa Bình luận (AC3) */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-surface-container-lowest dark:bg-slate-900 p-5 rounded-3xl max-w-sm w-full shadow-2xl border border-outline-variant/30 space-y-4">
            <div className="flex items-center gap-3 text-error">
              <span className="material-symbols-outlined text-2xl">warning</span>
              <h3 className="font-bold text-base text-on-surface">Xóa bình luận?</h3>
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Bạn có chắc chắn muốn xóa bình luận này không? Hành động này không thể hoàn tác và các tệp đính kèm cũng sẽ bị xóa.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                disabled={deleting}
                className="px-3.5 py-2 text-xs rounded-xl font-semibold hover:bg-surface-variant/40 transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="px-4 py-2 text-xs rounded-xl font-bold bg-error text-on-error hover:bg-error/90 transition-all flex items-center gap-1.5 shadow-md shadow-error/20"
              >
                {deleting && <span className="w-3 h-3 border-2 border-on-error border-t-transparent rounded-full animate-spin"></span>}
                <span>Xác nhận xóa</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
