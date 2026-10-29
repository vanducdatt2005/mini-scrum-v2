// frontend/src/components/SprintCeremonyModal.jsx
// US-023: Sprint Review  |  US-024: Sprint Retrospective
import { useState, useEffect } from 'react';
import api from '../services/api';

export default function SprintCeremonyModal({ isOpen, onClose, sprint, userRole }) {
  const [activeTab, setActiveTab] = useState('review'); // 'review' | 'retrospective'
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null); // { type: 'success' | 'error', message }

  // Review fields (US-023)
  const [demoContent, setDemoContent] = useState('');
  const [reviewItems, setReviewItems] = useState([]);
  const [newReviewItemText, setNewReviewItemText] = useState('');

  // Retrospective fields (US-024)
  const [retroItems, setRetroItems] = useState([]);
  const [newItemType, setNewItemType] = useState('WENT_WELL'); // WENT_WELL | NEEDS_IMPROVEMENT | ACTION_ITEM
  const [newItemText, setNewItemText] = useState('');
  const [retroFilter, setRetroFilter] = useState('ALL'); // ALL | WENT_WELL | NEEDS_IMPROVEMENT | ACTION_ITEM

  const [reviewMeta, setReviewMeta] = useState(null);
  const [retroMeta, setRetroMeta] = useState(null);

  const currentUser = JSON.parse(localStorage.getItem('user')) || {};
  const isManagement = userRole === 'PO' || userRole === 'SM';

  // Auto-hide toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Load ceremony data khi mở modal
  useEffect(() => {
    if (!isOpen || !sprint) return;

    setLoading(true);
    api.get(`/sprints/${sprint.id}/ceremonies`)
      .then(res => {
        const { review, retrospective } = res.data;

        if (review) {
          setDemoContent(review.demoContent || '');
          setReviewItems(Array.isArray(review.items) ? review.items : []);
          setReviewMeta({ updatedAt: review.updatedAt, updatedBy: review.updatedBy });
        } else {
          setDemoContent('');
          setReviewItems([]);
          setReviewMeta(null);
        }

        if (retrospective && Array.isArray(retrospective.items)) {
          setRetroItems(retrospective.items);
          setRetroMeta({ updatedAt: retrospective.updatedAt, updatedBy: retrospective.updatedBy });
        } else {
          setRetroItems([]);
          setRetroMeta(null);
        }
      })
      .catch(err => {
        console.error('Lỗi tải ceremony data:', err);
        // Nếu API ceremonies chưa có data, set rỗng
        setDemoContent('');
        setReviewItems([]);
        setRetroItems([]);
      })
      .finally(() => setLoading(false));
  }, [isOpen, sprint]);

  const showToast = (type, message) => {
    setToast({ type, message });
  };

  // ==================== SAVE REVIEW DEMO SUMMARY (US-023) ====================
  const handleSaveReview = async () => {
    if (!demoContent.trim()) {
      showToast('error', 'Vui lòng nhập nội dung demo.');
      return;
    }
    setSaving(true);
    try {
      const res = await api.put(`/sprints/${sprint.id}/review`, {
        demoContent: demoContent.trim()
      });
      setReviewMeta({
        updatedAt: res.data.review?.updatedAt,
        updatedBy: res.data.review?.updatedBy
      });
      showToast('success', 'Lưu nội dung Demo thành công!');
    } catch (err) {
      console.error('Lỗi lưu review:', err);
      showToast('error', err.response?.data?.error || 'Không thể lưu nội dung Demo.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddReviewItem = async () => {
    if (!newReviewItemText.trim()) {
      showToast('error', 'Vui lòng nhập nội dung phản hồi.');
      return;
    }
    setSaving(true);
    try {
      const res = await api.post(`/sprints/${sprint.id}/review/items`, {
        text: newReviewItemText.trim()
      });
      setReviewItems(res.data.items || []);
      setNewReviewItemText('');
      showToast('success', 'Thêm nhận xét thành công!');
    } catch (err) {
      console.error('Lỗi thêm nhận xét:', err);
      showToast('error', err.response?.data?.error || 'Không thể thêm nhận xét.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteReviewItem = async (itemId) => {
    if (!window.confirm('Bạn có chắc muốn xóa nhận xét này?')) return;
    try {
      const res = await api.delete(`/sprints/${sprint.id}/review/items/${itemId}`);
      setReviewItems(res.data.items || []);
      showToast('success', 'Xóa nhận xét thành công!');
    } catch (err) {
      console.error('Lỗi xóa nhận xét:', err);
      showToast('error', err.response?.data?.error || 'Không thể xóa nhận xét.');
    }
  };

  // ==================== RETROSPECTIVE ITEMS (US-024) ====================
  const handleAddItem = async () => {
    if (!newItemText.trim()) {
      showToast('error', 'Vui lòng nhập nội dung ý kiến.');
      return;
    }
    setSaving(true);
    try {
      const res = await api.post(`/sprints/${sprint.id}/retrospective/items`, {
        type: newItemType,
        text: newItemText.trim()
      });
      setRetroItems(res.data.items || []);
      setNewItemText('');
      showToast('success', 'Thêm ý kiến thành công!');
    } catch (err) {
      console.error('Lỗi thêm ý kiến:', err);
      showToast('error', err.response?.data?.error || 'Không thể thêm ý kiến.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async (itemId) => {
    if (!window.confirm('Bạn có chắc muốn xóa ý kiến này?')) return;
    try {
      const res = await api.delete(`/sprints/${sprint.id}/retrospective/items/${itemId}`);
      setRetroItems(res.data.items || []);
      showToast('success', 'Xóa ý kiến thành công!');
    } catch (err) {
      console.error('Lỗi xóa ý kiến:', err);
      showToast('error', err.response?.data?.error || 'Không thể xóa ý kiến.');
    }
  };

  if (!isOpen || !sprint) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-[2.5rem] w-full max-w-2xl shadow-2xl overflow-hidden border border-outline-variant/10 animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">

        {/* ===== HEADER ===== */}
        <div className="p-8 pb-0 border-b border-outline-variant/10 bg-surface-container-low">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-3xl">celebration</span>
              </div>
              <div>
                <h2 className="text-2xl font-black text-on-surface font-['Manrope'] tracking-tight">Sprint Ceremony</h2>
                <p className="text-xs text-on-surface-variant font-bold uppercase tracking-widest opacity-60">{sprint.name}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-3 hover:bg-surface-container-high rounded-full transition-all text-on-surface-variant"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          {/* ===== TAB BAR ===== */}
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab('review')}
              className={`flex items-center gap-2 px-6 py-3 rounded-t-2xl text-sm font-bold transition-all ${
                activeTab === 'review'
                  ? 'bg-white text-primary border-t-2 border-x border-primary/30 border-outline-variant/10 -mb-[1px]'
                  : 'text-on-surface-variant hover:bg-surface-container-high/50'
              }`}
            >
              <span className="material-symbols-outlined text-lg">rate_review</span>
              Sprint Review
              {reviewMeta && <span className="w-2 h-2 bg-primary rounded-full"></span>}
            </button>
            <button
              onClick={() => setActiveTab('retrospective')}
              className={`flex items-center gap-2 px-6 py-3 rounded-t-2xl text-sm font-bold transition-all ${
                activeTab === 'retrospective'
                  ? 'bg-white text-primary border-t-2 border-x border-primary/30 border-outline-variant/10 -mb-[1px]'
                  : 'text-on-surface-variant hover:bg-surface-container-high/50'
              }`}
            >
              <span className="material-symbols-outlined text-lg">psychology</span>
              Retrospective
              {retroMeta && <span className="w-2 h-2 bg-primary rounded-full"></span>}
            </button>
          </div>
        </div>

        {/* ===== BODY ===== */}
        <div className="flex-1 overflow-y-auto p-8">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* ========== TAB: SPRINT REVIEW (US-023) ========== */}
              {activeTab === 'review' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-left-2 duration-300">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="material-symbols-outlined text-primary">info</span>
                    <p className="text-xs text-on-surface-variant italic">
                      Team Member đóng góp nội dung Demo. Product Owner/Scrum Master ghi nhận phản hồi từ stakeholders.
                    </p>
                  </div>

                  {/* Nội dung Demo */}
                  <div className="space-y-3">
                    <label className="block text-xs font-black uppercase tracking-widest text-on-surface-variant ml-1">
                      <span className="material-symbols-outlined text-sm align-middle mr-1">slideshow</span>
                      Nội dung Demo
                    </label>
                    <textarea
                      value={demoContent}
                      onChange={e => setDemoContent(e.target.value)}
                      placeholder="Mô tả các tính năng đã demo, kết quả từng User Story..."
                      rows={4}
                      className="w-full px-5 py-4 bg-surface-container-low border-2 border-outline-variant/20 rounded-2xl text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all resize-none disabled:opacity-60 disabled:cursor-not-allowed shadow-inner"
                    />
                    
                    <button
                      onClick={handleSaveReview}
                      disabled={saving || !demoContent.trim()}
                      className="w-full px-8 py-3 rounded-2xl font-bold bg-primary text-on-primary shadow-lg shadow-primary/20 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2 text-sm"
                    >
                      {saving ? (
                        <div className="w-5 h-5 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin" />
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-lg">save</span>
                          Lưu nội dung Demo
                        </>
                      )}
                    </button>
                  </div>

                  {/* Feedback Section (Comments List) */}
                  <div className="space-y-4 pt-6 border-t border-outline-variant/20 mt-6">
                    <label className="block text-xs font-black uppercase tracking-widest text-on-surface-variant mb-3 ml-1">
                      <span className="material-symbols-outlined text-sm align-middle mr-1 text-primary">forum</span>
                      Ý kiến phản hồi (Feedback History)
                    </label>

                    {/* Add Feedback Input */}
                    <div className="flex flex-col gap-3 bg-primary/5 p-4 rounded-2xl border border-primary/20">
                      <textarea
                        value={newReviewItemText}
                        onChange={(e) => setNewReviewItemText(e.target.value)}
                        placeholder="Nhập nhận xét, góp ý từ stakeholders..."
                        rows={2}
                        className="w-full px-4 py-3 bg-white border border-outline-variant/30 rounded-xl text-sm text-on-surface focus:outline-none focus:border-primary/50 resize-none shadow-inner"
                      />
                      <button
                        onClick={handleAddReviewItem}
                        disabled={saving || !newReviewItemText.trim()}
                        className="self-end px-6 py-2 rounded-xl font-bold bg-primary text-on-primary disabled:opacity-50 transition-all flex items-center gap-2 text-sm hover:scale-105 active:scale-95 shadow-md shadow-primary/20"
                      >
                        {saving ? (
                          <div className="w-5 h-5 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin" />
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-sm">send</span>
                            Gửi nhận xét
                          </>
                        )}
                      </button>
                    </div>

                    {/* Feedback Items List */}
                    <div className="flex flex-col gap-3 pb-4">
                      {reviewItems.length === 0 ? (
                        <div className="text-center py-8 text-on-surface-variant opacity-60 italic text-sm border-2 border-dashed border-outline-variant/20 rounded-2xl bg-surface-container-lowest">
                          Chưa có nhận xét nào được ghi lại.
                        </div>
                      ) : (
                        reviewItems.map(item => {
                          const isOwner = currentUser.id === item.userId;
                          const canDelete = isOwner || isManagement;

                          return (
                            <div key={item.id} className="p-4 rounded-2xl border bg-surface-container-lowest border-outline-variant/30 flex gap-3 group animate-in slide-in-from-bottom-2 duration-300 shadow-sm hover:border-primary/20 transition-all">
                              <div className="shrink-0 mt-1">
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                  <span className="material-symbols-outlined text-sm">person</span>
                                </div>
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-bold text-sm text-on-surface flex items-center gap-2">
                                    {item.userName}
                                    {isOwner && <span className="text-[10px] bg-primary text-on-primary px-1.5 py-0.5 rounded font-black tracking-widest uppercase shadow-sm shadow-primary/20">You</span>}
                                  </span>
                                  {item.createdAt && (
                                    <span className="text-[10px] text-on-surface-variant/50 uppercase tracking-widest font-black">
                                      {new Date(item.createdAt).toLocaleTimeString('vi-VN')} {new Date(item.createdAt).toLocaleDateString('vi-VN')}
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-on-surface leading-relaxed whitespace-pre-wrap">{item.text}</p>
                              </div>
                              {canDelete && (
                                <button
                                  onClick={() => handleDeleteReviewItem(item.id)}
                                  className="shrink-0 text-error/40 hover:text-error hover:bg-error/10 p-2 rounded-full transition-all h-fit opacity-0 group-hover:opacity-100 focus:opacity-100"
                                  title="Xóa nhận xét"
                                >
                                  <span className="material-symbols-outlined text-base">delete_sweep</span>
                                </button>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {!isManagement && (
                    <div className="flex items-center gap-2 p-4 bg-blue-50 border border-blue-200 rounded-2xl text-xs text-blue-800">
                      <span className="material-symbols-outlined text-base">info</span>
                      Bạn có quyền đóng góp nội dung Demo và Nhận xét phản hồi.
                    </div>
                  )}
                </div>
              )}

              {/* ========== TAB: SPRINT RETROSPECTIVE (US-024) ========== */}
              {activeTab === 'retrospective' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="material-symbols-outlined text-primary">info</span>
                    <p className="text-xs text-on-surface-variant">
                      Cả nhóm cùng tham gia đóng góp ý kiến Retrospective.
                    </p>
                  </div>

                  {/* Form thêm ý kiến */}
                  <div className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant/20 bg-primary/5">
                    <label className="block text-xs font-black uppercase tracking-widest text-on-surface-variant mb-3">
                      <span className="material-symbols-outlined text-sm align-middle mr-1 text-primary">add_comment</span>
                      Thêm ý kiến thảo luận
                    </label>
                    <div className="flex flex-col gap-3">
                      <select
                        value={newItemType}
                        onChange={(e) => setNewItemType(e.target.value)}
                        className="px-4 py-3 bg-white border border-outline-variant/30 rounded-xl text-sm focus:outline-none focus:border-primary/50 text-on-surface font-semibold"
                      >
                        <option value="WENT_WELL">✅ Went Well (Điều đã làm tốt)</option>
                        <option value="NEEDS_IMPROVEMENT">🚧 Needs Improvement (Cần cải thiện)</option>
                        <option value="ACTION_ITEM">🚀 Action Item (Hành động cụ thể)</option>
                      </select>
                      <textarea
                        value={newItemText}
                        onChange={(e) => setNewItemText(e.target.value)}
                        placeholder="Nhập nội dung ý kiến của bạn..."
                        rows={2}
                        className="w-full px-4 py-3 bg-white border border-outline-variant/30 rounded-xl text-sm text-on-surface focus:outline-none focus:border-primary/50 resize-none shadow-inner"
                      />
                      <button
                        onClick={handleAddItem}
                        disabled={saving || !newItemText.trim()}
                        className="self-end px-6 py-2 rounded-xl font-bold bg-primary text-on-primary disabled:opacity-50 transition-all flex items-center gap-2 text-sm hover:scale-105 active:scale-95 shadow-md shadow-primary/20"
                      >
                        {saving ? (
                          <div className="w-5 h-5 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin" />
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-sm">send</span>
                            Gửi ý kiến
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Bộ lọc (Cho PO/SM) */}
                  <div className="flex gap-2 bg-surface-container-low p-1 rounded-xl w-fit border border-outline-variant/10 shadow-inner">
                    {[
                      { id: 'ALL', label: 'Tất cả' },
                      { id: 'WENT_WELL', label: '✅ Tốt' },
                      { id: 'NEEDS_IMPROVEMENT', label: '🚧 Cải thiện' },
                      { id: 'ACTION_ITEM', label: '🚀 Kế hoạch' }
                    ].map((filter) => (
                      <button
                        key={filter.id}
                        onClick={() => setRetroFilter(filter.id)}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          retroFilter === filter.id
                            ? 'bg-primary text-on-primary shadow-sm scale-105'
                            : 'text-on-surface-variant hover:bg-surface-container-highest'
                        }`}
                      >
                        {filter.label}
                      </button>
                    ))}
                  </div>

                  {/* Danh sách ý kiến */}
                  <div className="flex flex-col gap-3 pb-8">
                    {retroItems.filter(item => retroFilter === 'ALL' || item.type === retroFilter).length === 0 ? (
                      <div className="text-center py-8 text-on-surface-variant opacity-60 italic text-sm border-2 border-dashed border-outline-variant/20 rounded-2xl bg-surface-container-lowest">
                        Chưa có ý kiến nào. Hãy là người mở lời!
                      </div>
                    ) : (
                      retroItems.filter(item => retroFilter === 'ALL' || item.type === retroFilter).map(item => {
                        let config = { icon: 'chat', label: 'Comment', bg: 'bg-surface-container text-on-surface' };
                        if (item.type === 'WENT_WELL') config = { icon: 'thumb_up', label: 'Went Well', textClass: 'text-emerald-700', bg: 'bg-emerald-50/70 border-emerald-200/50' };
                        if (item.type === 'NEEDS_IMPROVEMENT') config = { icon: 'construction', label: 'Improvement', textClass: 'text-amber-700', bg: 'bg-amber-50/70 border-amber-200/50' };
                        if (item.type === 'ACTION_ITEM') config = { icon: 'task_alt', label: 'Action', textClass: 'text-blue-700', bg: 'bg-blue-50/70 border-blue-200/50' };
                        
                        const isOwner = currentUser.id === item.userId;
                        const canDelete = isOwner || isManagement;

                        return (
                          <div key={item.id} className={`p-4 rounded-2xl border flex gap-3 group animate-in slide-in-from-bottom-2 duration-300 shadow-sm ${config.bg}`}>
                            <div className="shrink-0 mt-1">
                              <span className={`material-symbols-outlined ${config.textClass}`}>{config.icon}</span>
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-bold text-sm text-on-surface flex items-center gap-2">
                                  {item.userName}
                                  {isOwner && <span className="text-[10px] bg-primary text-on-primary px-1.5 py-0.5 rounded font-black tracking-widest uppercase shadow-sm shadow-primary/20">You</span>}
                                </span>
                                <div className="flex flex-col items-end">
                                  <span className={`text-[10px] tracking-wider uppercase font-black px-2 py-0.5 rounded bg-white/50 border border-current opacity-80 ${config.textClass}`}>
                                    {config.label}
                                  </span>
                                </div>
                              </div>
                              <p className="text-sm text-on-surface leading-relaxed whitespace-pre-wrap">{item.text}</p>
                              {item.createdAt && (
                                <p className="text-[10px] text-on-surface-variant/50 uppercase tracking-widest mt-2 font-bold">
                                  {new Date(item.createdAt).toLocaleString('vi-VN')}
                                </p>
                              )}
                            </div>
                            {canDelete && (
                              <button
                                onClick={() => handleDeleteItem(item.id)}
                                className="shrink-0 text-error/40 hover:text-error hover:bg-error/10 p-2 rounded-full transition-all h-fit opacity-0 group-hover:opacity-100 focus:opacity-100"
                                title="Xóa ý kiến"
                              >
                                <span className="material-symbols-outlined text-sm">delete</span>
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ===== FOOTER ===== */}
        <div className="p-6 border-t border-outline-variant/10 bg-surface-container-low flex justify-end">
          <button
            onClick={onClose}
            className="px-8 py-3 rounded-2xl font-bold text-on-surface-variant hover:bg-surface-container-high transition-all text-sm"
          >
            Đóng
          </button>
        </div>
      </div>

      {/* ===== TOAST NOTIFICATION ===== */}
      {toast && (
        <div className={`fixed top-6 right-6 z-[200] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl animate-in slide-in-from-top-3 duration-300 ${
          toast.type === 'success'
            ? 'bg-emerald-600 text-white'
            : 'bg-red-600 text-white'
        }`}>
          <span className="material-symbols-outlined text-xl">
            {toast.type === 'success' ? 'check_circle' : 'error'}
          </span>
          <span className="text-sm font-bold">{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 opacity-70 hover:opacity-100 transition-opacity">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>
      )}
    </div>
  );
}
