//frontend/src/components/CreateStoryModal.jsx
import React, { useState, useEffect } from 'react';
import CommentSection from './CommentSection';
import AttachmentSection from './AttachmentSection'; 
import ActivityLog from './ActivityLog';
import { useAuth } from '../context/AuthContext';
import PokerInviteModal from './PokerInviteModal';
import { createPokerRoom } from '../services/api';
import { toast } from 'react-hot-toast';

export default function CreateStoryModal({ 
  isOpen, 
  onClose, 
  onSubmit, 
  loading, 
  initialData,
  projectId: propProjectId,
  currentUser: propCurrentUser,
  userRole = 'MEMBER',
  initialTab = 'comments'
}) {
  const { user: authUser } = useAuth();
  const currentUser = propCurrentUser || authUser || (() => {
    try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
  })();

  const projectId = propProjectId || initialData?.projectId;
  const isManagement = userRole === 'PO' || userRole === 'SM';
  const isEdit = !!initialData;
  const canEditStoryFields = !isEdit || isManagement; // Member chỉ được xem chi tiết và thảo luận khi sửa

  const [activeTab, setActiveTab] = useState(initialTab);

  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'MEDIUM',
    storyPoints: '',
    status: 'BACKLOG',
    tags: []
  });

  const [tagInput, setTagInput] = useState('');
  const [pokerRoom, setPokerRoom] = useState(null);
  const [isPokerModalOpen, setIsPokerModalOpen] = useState(false);
  const [isCreatingPoker, setIsCreatingPoker] = useState(false);

  const handleOpenPoker = async () => {
    if (!initialData?.id) return;
    setIsCreatingPoker(true);
    try {
      const res = await createPokerRoom(initialData.id);
      setPokerRoom(res.data.room);
      setIsPokerModalOpen(true);
      toast.success('Đã mở phòng Planning Poker cho Story này!');
    } catch (err) {
      console.error('Lỗi mở phòng Poker:', err);
      toast.error(err.response?.data?.error || 'Không thể mở phòng Poker. Bạn cần là Scrum Master hoặc PO.');
    } finally {
      setIsCreatingPoker(false);
    }
  };

  useEffect(() => {
    if (initialData) {
      setForm({
        title: initialData.title || '',
        description: initialData.description || '',
        priority: initialData.priority || 'MEDIUM',
        storyPoints: initialData.storyPoints || '',
        status: initialData.status || 'BACKLOG',
        tags: Array.isArray(initialData.tags) 
          ? initialData.tags 
          : (typeof initialData.tags === 'string' 
              ? JSON.parse(initialData.tags || '[]') 
              : [])
      });
    } else {
      setForm({ 
        title: '', 
        description: '', 
        priority: 'MEDIUM', 
        storyPoints: '',
        status: 'BACKLOG',
        tags: [] 
      });
    }
    setTagInput('');
    setActiveTab(initialData?.defaultTab || initialTab || 'comments');
  }, [initialData, initialTab, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canEditStoryFields) return;
    onSubmit({
      ...form,
      storyPoints: parseInt(form.storyPoints) || 0,
      tags: form.tags
    });
  };

  const addTag = () => {
    const trimmed = tagInput.trim();
    if (!trimmed || form.tags.includes(trimmed)) return;
    setForm(prev => ({ ...prev, tags: [...prev.tags, trimmed] }));
    setTagInput('');
  };

  const removeTag = (tagToRemove) => {
    setForm(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleTagKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
      
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-outline-variant/10 flex items-center justify-between bg-surface-container-low">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isEdit ? "bg-tertiary/10 text-tertiary" : "bg-primary/10 text-primary"}`}>
              <span className="material-symbols-outlined">{isEdit ? "edit_note" : "add_task"}</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-on-surface">
                {isEdit 
                  ? (isManagement ? "Chỉnh sửa User Story" : "Chi tiết & Thảo luận User Story") 
                  : "Tạo User Story mới"}
              </h3>
              {isEdit && !isManagement && (
                <p className="text-[11px] text-on-surface-variant/70">
                  Chế độ thảo luận (Chỉ PO / SM mới có quyền sửa nội dung story)
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isEdit && initialData?.id && (
              <button
                type="button"
                onClick={handleOpenPoker}
                disabled={isCreatingPoker}
                className="px-3 py-1.5 bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/90 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
                title="Mở phòng Planning Poker cho User Story này"
              >
                <span className="material-symbols-outlined text-sm">style</span>
                <span>{isCreatingPoker ? "Đang tạo..." : "Mở Poker"}</span>
              </button>
            )}
            <button 
              type="button"
              onClick={onClose} 
              className="p-2 hover:bg-surface-container-high rounded-full transition-colors"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Tiêu đề */}
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-on-surface-variant">Tiêu đề Story <span className="text-error">*</span></label>
              <input
                required
                autoFocus={canEditStoryFields}
                readOnly={!canEditStoryFields}
                className={`w-full px-4 py-3 rounded-xl border border-outline-variant bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none
                  ${!canEditStoryFields ? 'bg-surface-container/50 cursor-not-allowed opacity-80' : ''}`}
                placeholder="VD: Thiết kế giao diện Dashboard"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                disabled={loading}
              />
            </div>

            {/* Mô tả */}
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-on-surface-variant">Mô tả chi tiết</label>
              <textarea
                readOnly={!canEditStoryFields}
                className={`w-full px-4 py-3 rounded-xl border border-outline-variant bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none min-h-[100px]
                  ${!canEditStoryFields ? 'bg-surface-container/50 cursor-not-allowed opacity-80' : ''}`}
                placeholder="Mô tả các tiêu chí chấp nhận..."
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                disabled={loading}
              />
            </div>

            {/* Ưu tiên - Trạng thái - Story Points */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-on-surface-variant">Độ ưu tiên</label>
                <select
                  disabled={loading || !canEditStoryFields}
                  className={`w-full px-4 py-3 rounded-xl border border-outline-variant bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 outline-none
                    ${!canEditStoryFields ? 'bg-surface-container/50 cursor-not-allowed opacity-80' : 'cursor-pointer'}`}
                  value={form.priority}
                  onChange={e => setForm({ ...form, priority: e.target.value })}
                >
                  <option value="HIGH">HIGH</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="LOW">LOW</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-bold text-on-surface-variant">Trạng thái</label>
                <select
                  disabled={loading || !canEditStoryFields}
                  className={`w-full px-4 py-3 rounded-xl border border-outline-variant bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 outline-none
                    ${!canEditStoryFields ? 'bg-surface-container/50 cursor-not-allowed opacity-80' : 'cursor-pointer'}`}
                  value={form.status}
                  onChange={e => setForm({ ...form, status: e.target.value })}
                >
                  <option value="BACKLOG">Backlog</option>
                  <option value="TODO">Todo</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="DONE">Done</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-bold text-on-surface-variant">Story Points</label>
                <input
                  type="number"
                  readOnly={!canEditStoryFields}
                  className={`w-full px-4 py-3 rounded-xl border border-outline-variant bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 outline-none
                    ${!canEditStoryFields ? 'bg-surface-container/50 cursor-not-allowed opacity-80' : ''}`}
                  placeholder="0, 1, 2, 3..."
                  value={form.storyPoints}
                  onChange={e => setForm({ ...form, storyPoints: e.target.value })}
                  disabled={loading}
                />
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-on-surface-variant flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">label</span>
                Nhãn / Tags
              </label>

              {canEditStoryFields && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 px-4 py-3 rounded-xl border border-outline-variant bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    placeholder="Nhập tag mới..."
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleTagKeyDown}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={addTag}
                    className="px-6 py-3 bg-primary text-on-primary rounded-xl font-medium hover:bg-primary/90 disabled:opacity-50"
                    disabled={!tagInput.trim() || loading}
                  >
                    Thêm
                  </button>
                </div>
              )}

              {/* Danh sách tag đã chọn */}
              {form.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {form.tags.map((tag, index) => (
                    <div key={index} className="flex items-center gap-1 bg-primary/10 text-primary px-3 py-1 rounded-xl text-sm">
                      #{tag}
                      {canEditStoryFields && (
                        <button 
                          type="button"
                          onClick={() => removeTag(tag)} 
                          className="ml-1 text-error hover:text-red-600 font-bold"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Buttons */}
            <div className="pt-4 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 rounded-xl font-medium border border-outline-variant hover:bg-surface-container-high transition-colors"
                disabled={loading}
              >
                Đóng
              </button>
              {canEditStoryFields && (
                <button
                  type="submit"
                  className={`flex-1 py-3 rounded-xl font-bold text-on-primary shadow transition-all ${
                    isEdit ? "bg-tertiary hover:bg-tertiary/90" : "bg-primary hover:bg-primary/90"
                  }`}
                  disabled={loading || !form.title.trim()}
                >
                  {loading ? 'Đang lưu...' : (isEdit ? 'Lưu thay đổi' : 'Tạo User Story')}
                </button>
              )}
            </div>

          </form>

          {/* US-045: Bình luận Realtime, US-047: Đính kèm & US-064: Lịch sử hoạt động (Activity Log) */}
          {isEdit && initialData?.id && (
            <div className="pt-5 border-t border-outline-variant/20 mt-5">
              {/* Thanh Tab Chuyển đổi */}
              <div className="flex items-center gap-2 border-b border-outline-variant/20 pb-3 mb-4 flex-wrap">
                <button
                  type="button"
                  onClick={() => setActiveTab('comments')}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                    activeTab === 'comments'
                      ? 'bg-primary text-white shadow-md shadow-primary/20'
                      : 'text-on-surface-variant hover:bg-surface-container-high'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">forum</span>
                  <span>Thảo luận ({initialData.comments?.length || 0})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('attachments')}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                    activeTab === 'attachments'
                      ? 'bg-primary text-white shadow-md shadow-primary/20'
                      : 'text-on-surface-variant hover:bg-surface-container-high'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">attach_file</span>
                  <span>Đính kèm tệp</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('activity')}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                    activeTab === 'activity'
                      ? 'bg-primary text-white shadow-md shadow-primary/20'
                      : 'text-on-surface-variant hover:bg-surface-container-high'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">manage_history</span>
                  <span>Lịch sử thay đổi (Activity Log)</span>
                </button>
              </div>

              {/* Nội dung từng Tab */}
              {activeTab === 'comments' && (
                <div className="animate-in fade-in duration-200">
                  <CommentSection 
                    entityId={initialData.id} 
                    entityType="story" 
                    projectId={projectId}
                    currentUser={currentUser}
                  />
                </div>
              )}

              {activeTab === 'attachments' && (
                <div className="animate-in fade-in duration-200">
                  <AttachmentSection 
                    entityId={initialData.id} 
                    entityType="userStory" 
                  />
                </div>
              )}

              {activeTab === 'activity' && (
                <div className="animate-in fade-in duration-200 bg-surface-container-lowest dark:bg-slate-900/60 p-4 rounded-2xl border border-outline-variant/20 shadow-sm">
                  <ActivityLog 
                    entityType="USER_STORY" 
                    entityId={initialData.id} 
                  />
                </div>
              )}
            </div>
          )}
          
        </div>
      </div>

      {/* Modal mời vào phòng Poker */}
      <PokerInviteModal
        isOpen={isPokerModalOpen}
        onClose={() => setIsPokerModalOpen(false)}
        room={pokerRoom}
        storyTitle={initialData?.title}
      />
    </div>
  );
}
