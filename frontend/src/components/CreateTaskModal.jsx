import React, { useState, useEffect } from 'react';

export default function CreateTaskModal({ 
  isOpen, 
  onClose, 
  onSubmit, 
  loading, 
  storyTitle,
  userRole = 'MEMBER'
}) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    dueDate: '',
  });

  useEffect(() => {
    if (isOpen) {
      setForm({ title: '', description: '', dueDate: '' });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(form);
  };

  const canSetDeadline = true; // Tất cả mọi người đều phải chọn hạn chót

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-outline-variant/20">
        
        {/* Header */}
        <div className="p-6 border-b border-outline-variant/10 flex items-center justify-between bg-surface-container-low">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined">add_task</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-on-surface">Tạo Task mới</h3>
              <p className="text-xs text-on-surface-variant truncate max-w-[200px]">Cho Story: {storyTitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface-container-high rounded-full transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Tiêu đề */}
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-on-surface-variant">Tiêu đề Task <span className="text-error">*</span></label>
            <input
              required
              autoFocus
              className="w-full px-4 py-3 rounded-xl border border-outline-variant bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm"
              placeholder="VD: Viết unit test cho Login"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              disabled={loading}
            />
          </div>

          {/* Mô tả */}
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-on-surface-variant">Mô tả (tùy chọn)</label>
            <textarea
              className="w-full px-4 py-3 rounded-xl border border-outline-variant bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none min-h-[80px] text-sm"
              placeholder="Chi tiết công việc cần làm..."
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              disabled={loading}
            />
          </div>

          {/* Deadline */}
          <div className="space-y-1.5">
            <label className="text-sm font-bold flex items-center gap-1.5 text-on-surface-variant">
              <span className="material-symbols-outlined text-[18px]">calendar_today</span>
              Hạn chót <span className="text-error">*</span>
            </label>
            <div className="relative">
              <input
                type="date"
                required
                className="w-full px-4 py-3 rounded-xl border border-outline-variant bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm disabled:bg-surface-container-low disabled:cursor-not-allowed appearance-none min-h-[48px]"
                value={form.dueDate}
                onChange={e => setForm({ ...form, dueDate: e.target.value })}
                disabled={loading}
              />
              <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50 pointer-events-none md:hidden">
                calendar_month
              </span>
            </div>
          </div>

          {/* Buttons */}
          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl font-medium border border-outline-variant hover:bg-surface-container-high text-sm"
              disabled={loading}
            >
              Hủy
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl font-bold bg-primary text-on-primary shadow-lg hover:bg-primary/90 transition-all text-sm disabled:opacity-50"
              disabled={loading || !form.title.trim() || !form.dueDate}
            >
              {loading ? 'Đang tạo...' : 'Tạo Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
