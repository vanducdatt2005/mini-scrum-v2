import React, { useState, useEffect } from 'react';
import { updateTask } from '../services/api';

export default function EditTaskModal({
  isOpen,
  onClose,
  task,
  members = [],
  onSaveSuccess
}) {
  const [vCurrent, setVCurrent] = useState(1);
  const [form, setForm] = useState({
    title: '',
    description: '',
    status: 'TODO',
    assigneeId: '',
    dueDate: '',
  });
  const [conflict, setConflict] = useState(null); // { message, latestTask, updatedBy }
  const [showDiff, setShowDiff] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    if (isOpen && task) {
      setVCurrent(task.version ?? 1);
      setForm({
        title: task.title || '',
        description: task.description || '',
        status: task.status || 'TODO',
        assigneeId: task.assigneeId || '',
        dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '',
      });
      setConflict(null);
      setShowDiff(false);
      setErrorMessage(null);
    }
  }, [isOpen, task]);

  if (!isOpen || !task) return null;

  const handleSave = async (overridePayload = null) => {
    setSaving(true);
    setErrorMessage(null);
    try {
      const payload = overridePayload || {
        title: form.title,
        description: form.description,
        status: form.status,
        assigneeId: form.assigneeId ? form.assigneeId : null,
        dueDate: form.dueDate || null,
        version: vCurrent,
      };

      const res = await updateTask(task.id, payload);
      const updated = res.data || res;
      setVCurrent(updated.version);
      setConflict(null);
      setShowDiff(false);
      if (onSaveSuccess) onSaveSuccess(updated);
      onClose();
    } catch (err) {
      if (err.response?.status === 409 && err.response?.data?.code === 'VERSION_MISMATCH') {
        // GIỮ NGUYÊN nội dung người dùng đang nhập, KHÔNG đóng modal, KHÔNG rollback
        const data = err.response.data;
        const updaterName = data.updatedBy?.name || 'Người dùng khác';
        setConflict({
          message: data.message || `Task này vừa được ${updaterName} cập nhật. Vui lòng kiểm tra lại!`,
          latestTask: data.latestTask,
          updatedBy: data.updatedBy,
        });
      } else {
        setErrorMessage(err.response?.data?.error || err.message || 'Lỗi khi cập nhật Task');
      }
    } finally {
      setSaving(false);
    }
  };

  // Nút a: "Tải lại bản mới nhất"
  const handleReloadLatest = () => {
    if (!conflict?.latestTask) return;
    const lt = conflict.latestTask;
    setForm({
      title: lt.title || '',
      description: lt.description || '',
      status: lt.status || 'TODO',
      assigneeId: lt.assigneeId || '',
      dueDate: lt.dueDate ? new Date(lt.dueDate).toISOString().split('T')[0] : '',
    });
    setVCurrent(lt.version);
    setConflict(null);
    setShowDiff(false);
  };

  // Nút b - Option: "Giữ bản của tôi" (ghi đè với version mới)
  const handleKeepMineAndSave = async () => {
    if (!conflict?.latestTask) return;
    const newVersion = conflict.latestTask.version;
    setVCurrent(newVersion);
    await handleSave({
      title: form.title,
      description: form.description,
      status: form.status,
      assigneeId: form.assigneeId ? form.assigneeId : null,
      dueDate: form.dueDate || null,
      version: newVersion,
    });
  };

  // Helper format cho diff
  const formatAssignee = (id) => {
    if (!id) return 'Chưa gán';
    const m = members.find(item => item.user?.id === id);
    return m ? (m.user.fullName || m.user.email) : id;
  };

  const formatDueDate = (dateStr) => {
    if (!dateStr) return 'Không có';
    try {
      return new Date(dateStr).toLocaleDateString('vi-VN');
    } catch {
      return dateStr;
    }
  };

  const diffFields = [
    {
      key: 'title',
      label: 'Tiêu đề',
      mine: form.title,
      latest: conflict?.latestTask?.title || '',
      isDiff: form.title !== (conflict?.latestTask?.title || '')
    },
    {
      key: 'description',
      label: 'Mô tả',
      mine: form.description || '(Trống)',
      latest: conflict?.latestTask?.description || '(Trống)',
      isDiff: (form.description || '') !== (conflict?.latestTask?.description || '')
    },
    {
      key: 'status',
      label: 'Trạng thái',
      mine: form.status,
      latest: conflict?.latestTask?.status || 'TODO',
      isDiff: form.status !== (conflict?.latestTask?.status || 'TODO')
    },
    {
      key: 'assigneeId',
      label: 'Người phụ trách',
      mine: formatAssignee(form.assigneeId),
      latest: formatAssignee(conflict?.latestTask?.assigneeId),
      isDiff: (form.assigneeId || null) !== (conflict?.latestTask?.assigneeId || null)
    },
    {
      key: 'dueDate',
      label: 'Hạn chót',
      mine: formatDueDate(form.dueDate),
      latest: formatDueDate(conflict?.latestTask?.dueDate),
      isDiff: (form.dueDate ? new Date(form.dueDate).toISOString().split('T')[0] : '') !==
             (conflict?.latestTask?.dueDate ? new Date(conflict.latestTask.dueDate).toISOString().split('T')[0] : '')
    }
  ];

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden border border-outline-variant/20 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-5 border-b border-outline-variant/10 flex items-center justify-between bg-surface-container-low shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <span className="material-symbols-outlined">edit_note</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-on-surface">Chỉnh sửa Task</h3>
                <span className="text-xs font-mono font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                  v{vCurrent}
                </span>
              </div>
              <p className="text-xs text-on-surface-variant font-mono">{task.id}</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-surface-container-high rounded-full transition-colors text-on-surface-variant"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">

          {/* Banner lỗi thông thường */}
          {errorMessage && !conflict && (
            <div className="p-3 rounded-xl bg-error/10 border border-error/20 text-error text-xs flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">error</span>
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Banner cảnh báo xung đột (409 VERSION_MISMATCH) */}
          {conflict && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 shadow-sm space-y-3">
              <div className="flex items-start gap-2.5">
                <span className="material-symbols-outlined text-amber-600 text-lg shrink-0 mt-0.5">warning</span>
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-amber-900">Xung đột dữ liệu (Optimistic Locking)</h4>
                  <p className="text-xs text-amber-800 mt-0.5">
                    {conflict.message}
                  </p>
                </div>
              </div>

              {/* 2 nút xử lý xung đột */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleReloadLatest}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-700 text-white hover:bg-amber-800 transition-colors flex items-center gap-1 shadow-sm"
                >
                  <span className="material-symbols-outlined text-sm">sync</span>
                  Tải lại bản mới nhất
                </button>
                <button
                  type="button"
                  onClick={() => setShowDiff(!showDiff)}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg bg-white border border-amber-400 text-amber-900 hover:bg-amber-100 transition-colors flex items-center gap-1 shadow-sm"
                >
                  <span className="material-symbols-outlined text-sm">
                    {showDiff ? 'visibility_off' : 'compare_arrows'}
                  </span>
                  {showDiff ? 'Ẩn so sánh' : 'Xem / So sánh thay đổi'}
                </button>
              </div>

              {/* Bảng so sánh thay đổi (Diff) */}
              {showDiff && (
                <div className="mt-3 pt-3 border-t border-amber-200/80 space-y-2.5">
                  <div className="text-xs font-bold text-amber-950 uppercase tracking-wider flex items-center justify-between">
                    <span>So sánh trường dữ liệu:</span>
                    <span className="text-[10px] font-normal lowercase text-amber-700">(Đỏ/Cam: có sự khác biệt)</span>
                  </div>

                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {diffFields.map(f => (
                      <div 
                        key={f.key} 
                        className={`p-2 rounded-lg text-xs grid grid-cols-1 sm:grid-cols-3 gap-2 border transition-all ${
                          f.isDiff 
                            ? 'bg-amber-100/70 border-amber-300 font-medium' 
                            : 'bg-white/60 border-amber-200/50 opacity-75'
                        }`}
                      >
                        <div className="font-bold text-on-surface flex items-center gap-1">
                          {f.isDiff && <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>}
                          {f.label}:
                        </div>
                        <div className="text-slate-700 truncate" title={String(f.mine)}>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block sm:hidden">Của tôi:</span>
                          {f.mine}
                        </div>
                        <div className="text-blue-700 truncate font-semibold" title={String(f.latest)}>
                          <span className="text-[10px] uppercase font-bold text-blue-400 block sm:hidden">Mới nhất:</span>
                          {f.latest}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Nút hành động trong Diff view */}
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-amber-200">
                    <button
                      type="button"
                      onClick={handleReloadLatest}
                      className="px-3 py-1 text-xs font-bold rounded-lg text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors"
                    >
                      Lấy bản mới
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={handleKeepMineAndSave}
                      className="px-3 py-1 text-xs font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors flex items-center gap-1 shadow-sm"
                    >
                      <span className="material-symbols-outlined text-sm">check</span>
                      Giữ bản của tôi (Lưu lại)
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Form nhập thông tin */}
          <div className="space-y-4">
            {/* Tiêu đề */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                Tiêu đề Task <span className="text-error">*</span>
              </label>
              <input
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm font-medium"
                placeholder="Nhập tiêu đề task..."
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                disabled={saving}
              />
            </div>

            {/* Mô tả */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                Mô tả
              </label>
              <textarea
                rows={3}
                className="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm resize-none"
                placeholder="Mô tả chi tiết công việc..."
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                disabled={saving}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Trạng thái */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                  Trạng thái
                </label>
                <select
                  className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-surface-container-lowest text-sm outline-none focus:border-primary"
                  value={form.status}
                  onChange={e => setForm({ ...form, status: e.target.value })}
                  disabled={saving}
                >
                  <option value="TODO">To Do</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="DONE">Done</option>
                </select>
              </div>

              {/* Người phụ trách */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                  Người phụ trách
                </label>
                <select
                  className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-surface-container-lowest text-sm outline-none focus:border-primary"
                  value={form.assigneeId}
                  onChange={e => setForm({ ...form, assigneeId: e.target.value })}
                  disabled={saving}
                >
                  <option value="">Chưa gán</option>
                  {members.map(m => (
                    <option key={m.user.id} value={m.user.id}>
                      {m.user.fullName || m.user.email}
                    </option>
                  ))}
                </select>
              </div>

              {/* Hạn chót */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                  Hạn chót
                </label>
                <input
                  type="date"
                  className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-surface-container-lowest text-sm outline-none focus:border-primary"
                  value={form.dueDate}
                  onChange={e => setForm({ ...form, dueDate: e.target.value })}
                  disabled={saving}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-outline-variant/10 bg-surface-container-lowest flex items-center justify-between shrink-0">
          <span className="text-[11px] text-on-surface-variant">
            {conflict ? '⚠️ Đã phát hiện xung đột version' : 'Tự động kiểm tra Optimistic Locking'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-xs font-bold rounded-xl border border-outline-variant hover:bg-surface-container text-on-surface transition-colors"
            >
              Hủy
            </button>
            <button
              type="button"
              disabled={saving || !form.title.trim()}
              onClick={() => handleSave()}
              className="px-5 py-2 text-xs font-bold rounded-xl bg-primary text-white hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-1.5 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  <span>Đang lưu...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-sm">save</span>
                  <span>Lưu thay đổi</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
