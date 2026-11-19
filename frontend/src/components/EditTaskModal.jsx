import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { updateTask } from '../services/api';
import { getSocket } from '../context/SocketContext';
import { formatTimeAgo, copyDraftToClipboard, buildDraftCopyText } from '../utils/conflictUtils';

export function useEditTaskModal(props, reactLib = React) {
  const { useState, useEffect, useRef } = reactLib;
  const {
    isOpen,
    onClose,
    task,
    members = [],
    onSaveSuccess,
    socket: socketProp,
    updateTaskFn = updateTask,
    toastLib = toast
  } = props;
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

  const conflictRef = useRef(conflict);
  useEffect(() => {
    conflictRef.current = conflict;
  }, [conflict]);

  const prevTaskIdRef = useRef(task?.id);
  const wasOpenRef = useRef(isOpen);

  // Khởi tạo và đồng bộ form khi mở modal / đổi task
  useEffect(() => {
    if (!isOpen || !task) {
      wasOpenRef.current = isOpen;
      return;
    }

    const justOpened = !wasOpenRef.current && isOpen;
    const taskSwitched = prevTaskIdRef.current !== task.id;
    prevTaskIdRef.current = task.id;
    wasOpenRef.current = isOpen;

    if (justOpened || taskSwitched) {
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
      return;
    }

    // AC4 & DoD - No Data Loss: KHI BANNER XUNG ĐỘT ĐANG HIỆN,
    // Chặn tuyệt đối việc ghi đè state form từ prop hoặc re-render bên ngoài!
    if (conflictRef.current) {
      return;
    }
  }, [isOpen, task]);

  // Lắng nghe socket event task:changed để chặn việc ghi đè form khi đang có xung đột
  useEffect(() => {
    if (!isOpen || !task?.id) return;
    let socket = socketProp;
    if (!socket) {
      try {
        socket = typeof getSocket === 'function' ? getSocket() : null;
      } catch {
        socket = null;
      }
    }

    if (!socket || typeof socket.on !== 'function') return;

    const handleTaskChanged = (event) => {
      const data = event?.data || event;
      const changedId = String(event?.entityId || data?.id || '').replace('task-', '');
      const currentId = String(task.id).replace('task-', '');
      if (changedId !== currentId) return;

      // AC4: Khi banner xung đột đang hiện -> Chặn tuyệt đối việc tự động ghi đè form
      if (conflictRef.current) {
        return;
      }
    };

    socket.on('task:changed', handleTaskChanged);
    return () => {
      if (typeof socket.off === 'function') {
        socket.off('task:changed', handleTaskChanged);
      }
    };
  }, [isOpen, task?.id, socketProp]);

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

      const res = await updateTaskFn(task.id, payload);
      const updated = res.data || res;
      setVCurrent(updated.version);
      setConflict(null);
      setShowDiff(false);
      if (onSaveSuccess) onSaveSuccess(updated);
      if (onClose) onClose();
    } catch (err) {
      if (err.response?.status === 409 && err.response?.data?.code === 'VERSION_MISMATCH') {
        // GIỮ NGUYÊN nội dung người dùng đang nhập, KHÔNG đóng modal, KHÔNG rollback
        const data = err.response.data;
        const updaterName = data.updatedBy?.name || data.latestTask?.updatedBy?.name || 'người khác';
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

  // AC4: "Nạp bản mới nhất" - Ghi đè form bằng dữ liệu latestTask, cập nhật vCurrent, ẩn banner xung đột
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
    setErrorMessage(null);
  };

  // AC2: "Sao chép nội dung của tôi"
  const handleCopyDraft = async () => {
    const textToCopy = buildDraftCopyText(form, members);
    const ok = await copyDraftToClipboard(textToCopy);
    if (ok) {
      toastLib.success('Đã sao chép nội dung nháp!');
    }
    return ok;
  };

  // Option nâng cao: "Giữ bản của tôi" (ghi đè với version mới)
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

  const updaterName = conflict?.latestTask?.updatedBy?.name || conflict?.updatedBy?.name || conflict?.latestTask?.assignee?.fullName || 'người khác';
  const latestUpdatedAt = conflict?.latestTask?.updated_at || conflict?.latestTask?.updatedAt;
  const relativeTimeAgo = formatTimeAgo(latestUpdatedAt);

  return {
    vCurrent,
    setVCurrent,
    form,
    setForm,
    conflict,
    setConflict,
    showDiff,
    setShowDiff,
    saving,
    errorMessage,
    handleSave,
    handleReloadLatest,
    handleCopyDraft,
    handleKeepMineAndSave,
    diffFields,
    updaterName,
    relativeTimeAgo
  };
}

export default function EditTaskModal(props) {
  const {
    isOpen,
    onClose,
    task,
    members = []
  } = props;

  const {
    vCurrent,
    form,
    setForm,
    conflict,
    showDiff,
    setShowDiff,
    saving,
    errorMessage,
    handleSave,
    handleReloadLatest,
    handleCopyDraft,
    handleKeepMineAndSave,
    diffFields,
    updaterName,
    relativeTimeAgo
  } = useEditTaskModal(props);

  if (!isOpen || !task) return null;

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

          {/* Banner cảnh báo xung đột (AC1: Vàng/Cam cảnh báo) */}
          {conflict && (
            <div 
              data-testid="conflict-banner"
              className="p-4 rounded-xl bg-amber-50 border-2 border-amber-400 text-amber-950 shadow-sm space-y-3"
            >
              <div className="flex items-start gap-2.5">
                <span className="material-symbols-outlined text-amber-600 text-xl shrink-0 mt-0.5">warning</span>
                <div className="flex-1 space-y-1">
                  <h4 className="text-sm font-bold text-amber-950 flex items-center gap-1.5">
                    <span>Xung đột dữ liệu</span>
                    <span className="text-[11px] font-normal px-2 py-0.5 rounded bg-amber-200/80 text-amber-900 font-semibold">
                      v{vCurrent} → v{conflict.latestTask?.version || '?'}
                    </span>
                  </h4>
                  {/* AC1 - Dòng chính */}
                  <p className="text-xs text-amber-900 leading-snug">
                    Task này vừa được <span className="font-bold text-amber-950">{updaterName}</span> thay đổi cách đây <span className="font-bold text-amber-950">{relativeTimeAgo}</span>.
                  </p>
                  {/* AC1 - Dòng phụ bên dưới */}
                  <p className="text-xs text-amber-800 flex items-center gap-1 font-medium pt-0.5">
                    <span className="material-symbols-outlined text-[13px] text-amber-700">lock</span>
                    <span>Nội dung bạn nhập vẫn được giữ nguyên</span>
                  </p>
                </div>
              </div>

              {/* Các nút xử lý xung đột */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {/* Nút 1: Nạp bản mới nhất */}
                <button
                  type="button"
                  data-testid="btn-reload-latest"
                  onClick={handleReloadLatest}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-700 text-white hover:bg-amber-800 transition-colors flex items-center gap-1 shadow-sm"
                >
                  <span className="material-symbols-outlined text-sm">sync</span>
                  Nạp bản mới nhất
                </button>

                {/* Nút 2: Xem điểm khác biệt */}
                <button
                  type="button"
                  data-testid="btn-view-diff"
                  onClick={() => setShowDiff(!showDiff)}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg bg-white border border-amber-400 text-amber-900 hover:bg-amber-100 transition-colors flex items-center gap-1 shadow-sm"
                >
                  <span className="material-symbols-outlined text-sm">
                    {showDiff ? 'visibility_off' : 'compare_arrows'}
                  </span>
                  {showDiff ? 'Ẩn điểm khác biệt' : 'Xem điểm khác biệt'}
                </button>

                {/* Nút 3: Sao chép nội dung của tôi (AC2) */}
                <button
                  type="button"
                  data-testid="btn-copy-draft"
                  onClick={handleCopyDraft}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-100/90 border border-amber-300 text-amber-900 hover:bg-amber-200 transition-colors flex items-center gap-1 shadow-sm"
                  title="Sao chép toàn bộ nội dung bạn đang nhập dở vào bộ nhớ tạm"
                >
                  <span className="material-symbols-outlined text-sm">content_copy</span>
                  Sao chép nội dung của tôi
                </button>
              </div>

              {/* Bảng so sánh thay đổi (Diff View) */}
              {showDiff && (
                <div data-testid="diff-view" className="mt-3 pt-3 border-t border-amber-300 space-y-2.5">
                  <div className="text-xs font-bold text-amber-950 uppercase tracking-wider flex items-center justify-between">
                    <span>Bảng so sánh chi tiết:</span>
                    <span className="text-[10px] font-normal lowercase text-amber-700">(Cam đậm: trường có chênh lệch)</span>
                  </div>

                  {/* Header 2 cột: Nội dung bạn vừa nhập & Nội dung mới nhất trên Server */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 px-2 py-1 text-[11px] font-bold text-amber-950 bg-amber-100/60 rounded-md border border-amber-200">
                    <div>Trường dữ liệu</div>
                    <div>Nội dung bạn vừa nhập</div>
                    <div>Nội dung mới nhất trên Server</div>
                  </div>

                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-0.5">
                    {diffFields.map(f => (
                      <div 
                        key={f.key}
                        data-testid={`diff-row-${f.key}`}
                        className={`p-2.5 rounded-lg text-xs grid grid-cols-1 sm:grid-cols-3 gap-2 border transition-all ${
                          f.isDiff 
                            ? 'bg-amber-100/90 border-amber-400 font-medium ring-1 ring-amber-300 text-amber-950 shadow-xs' 
                            : 'bg-white/70 border-amber-200/50 opacity-80 text-slate-700'
                        }`}
                      >
                        <div className="font-bold flex items-center gap-1.5">
                          {f.isDiff ? (
                            <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0" title="Có chênh lệch"></span>
                          ) : (
                            <span className="w-2 h-2 rounded-full bg-slate-300 shrink-0"></span>
                          )}
                          <span>{f.label}</span>
                          {f.isDiff && (
                            <span className="text-[9px] px-1.5 py-0.5 bg-amber-200 text-amber-900 rounded font-bold uppercase ml-1">
                              Khác
                            </span>
                          )}
                        </div>
                        <div className="break-words" title={String(f.mine)}>
                          <span className="text-[10px] uppercase font-bold text-slate-500 block sm:hidden">Nội dung bạn vừa nhập:</span>
                          <span className={f.isDiff ? 'font-semibold text-amber-950' : 'text-slate-700'}>
                            {f.mine}
                          </span>
                        </div>
                        <div className="break-words" title={String(f.latest)}>
                          <span className="text-[10px] uppercase font-bold text-blue-500 block sm:hidden">Nội dung mới nhất trên Server:</span>
                          <span className={f.isDiff ? 'text-blue-800 font-bold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 inline-block' : 'text-slate-600'}>
                            {f.latest}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Nút hành động trong Diff view */}
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-amber-300">
                    <button
                      type="button"
                      onClick={handleReloadLatest}
                      className="px-3 py-1.5 text-xs font-bold rounded-lg text-amber-900 bg-white border border-amber-400 hover:bg-amber-100 transition-colors flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-sm">sync</span>
                      Nạp bản mới nhất
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={handleKeepMineAndSave}
                      className="px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors flex items-center gap-1 shadow-sm"
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
                data-testid="input-task-title"
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
                data-testid="input-task-description"
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
                  data-testid="select-task-status"
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
                  data-testid="select-task-assignee"
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
                  data-testid="input-task-duedate"
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
              data-testid="btn-save-task"
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
