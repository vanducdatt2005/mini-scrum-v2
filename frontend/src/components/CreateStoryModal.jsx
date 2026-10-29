//frontend/src/components/CreateStoryModal.jsx
import React, { useState, useEffect } from 'react';
import CommentSection from './CommentSection';
import AttachmentSection from './AttachmentSection'; 
export default function CreateStoryModal({ 
  isOpen, 
  onClose, 
  onSubmit, 
  loading, 
  initialData,
  projectId,
  currentUser 
}) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'MEDIUM',
    storyPoints: '',
    status: 'BACKLOG',
    tags: []
  });

  const [tagInput, setTagInput] = useState('');

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
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
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

  const isEdit = !!initialData;

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
                {isEdit ? "Chỉnh sửa User Story" : "Tạo User Story mới"}
              </h3>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface-container-high rounded-full transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

       
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Tiêu đề */}
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-on-surface-variant">Tiêu đề Story <span className="text-error">*</span></label>
              <input
                required
                autoFocus
                className="w-full px-4 py-3 rounded-xl border border-outline-variant bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
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
                className="w-full px-4 py-3 rounded-xl border border-outline-variant bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none min-h-[100px]"
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
                  className="w-full px-4 py-3 rounded-xl border border-outline-variant bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 outline-none cursor-pointer"
                  value={form.priority}
                  onChange={e => setForm({ ...form, priority: e.target.value })}
                  disabled={loading}
                >
                  <option value="HIGH">HIGH</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="LOW">LOW</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-bold text-on-surface-variant">Trạng thái</label>
                <select
                  className="w-full px-4 py-3 rounded-xl border border-outline-variant bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 outline-none cursor-pointer"
                  value={form.status}
                  onChange={e => setForm({ ...form, status: e.target.value })}
                  disabled={loading}
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
                  className="w-full px-4 py-3 rounded-xl border border-outline-variant bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 outline-none"
                  placeholder="0, 1, 2, 3..."
                  value={form.storyPoints}
                  onChange={e => setForm({ ...form, storyPoints: e.target.value })}
                  disabled={loading}
                />
              </div>
            </div>

            {/* Tags - Có cả nhập tay và chọn nhanh */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-on-surface-variant flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">label</span>
                Nhãn / Tags
              </label>

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

              {/* Danh sách tag đã chọn */}
              {form.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {form.tags.map((tag, index) => (
                    <div key={index} className="flex items-center gap-1 bg-primary/10 text-primary px-3 py-1 rounded-xl text-sm">
                      #{tag}
                      <button 
                        type="button"
                        onClick={() => removeTag(tag)} 
                        className="ml-1 text-error hover:text-red-600 font-bold"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Buttons */}
            <div className="pt-6 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 rounded-xl font-medium border border-outline-variant hover:bg-surface-container-high"
                disabled={loading}
              >
                Hủy
              </button>
              <button
                type="submit"
                className={`flex-1 py-3 rounded-xl font-bold text-on-primary shadow transition-all ${
                  isEdit ? "bg-tertiary" : "bg-primary"
                }`}
                disabled={loading || !form.title.trim()}
              >
                {loading ? 'Đang lưu...' : (isEdit ? 'Lưu thay đổi' : 'Tạo User Story')}
              </button>
            </div>

          </form>

          {/* US-045: Bình luận & US-047: Đính kèm */}
          {/* Đặt NGOÀI form để tránh lỗi nested form (CommentSection chứa form riêng) */}

          {isEdit && initialData?.id && (
            <div className="space-y-6 pt-6 border-t border-outline-variant/20 mt-6">
              {/* Phần Thảo luận */}
              <CommentSection 
                entityId={initialData.id} 
                entityType="story" 
                projectId={projectId}
                currentUser={currentUser}
              />

              {/* Phần Đính kèm cho US-047 */}
              <AttachmentSection 
                entityId={initialData.id} 
                entityType="userStory" 
              />
            </div>
          )}
          
        </div>
      </div>
    </div>
  );
}