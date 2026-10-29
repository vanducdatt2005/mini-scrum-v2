import React, { useState } from 'react';
import api from '../services/api';

export default function CompleteSprintModal({ isOpen, onClose, sprint, stories = [], plannedSprints = [], onCompleted }) {
  const [moveTo, setMoveTo] = useState('BACKLOG');
  const [loading, setLoading] = useState(false);

  if (!isOpen || !sprint) return null;

  const completedStories = stories.filter(s => s.status === 'DONE' || s.status === 'REJECTED');
  const unfinishedStories = stories.filter(s => s.status !== 'DONE' && s.status !== 'REJECTED');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.patch(`/sprint/${sprint.id}`, {
        status: 'COMPLETED',
        moveUnfinishedTo: moveTo
      });
      onCompleted();
      onClose();
    } catch (err) {
      console.error("Lỗi khi kết thúc Sprint:", err);
      alert(err.response?.data?.error || "Không thể kết thúc Sprint. Vui lòng kiểm tra lại.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl overflow-hidden border border-outline-variant/10 animate-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="p-8 border-b border-outline-variant/10 flex justify-between items-center bg-surface-container-low">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-600">
              <span className="material-symbols-outlined text-3xl">task_alt</span>
            </div>
            <div>
              <h2 className="text-2xl font-black text-on-surface font-['Manrope'] tracking-tight">Kết thúc {sprint.name}</h2>
              <p className="text-xs text-on-surface-variant font-bold uppercase tracking-widest opacity-60">Hoàn tất quy trình và bàn giao</p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-surface-container-high rounded-full transition-all text-on-surface-variant">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {/* Stats Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-emerald-600">check_circle</span>
                <span className="text-sm font-bold text-emerald-900">User Stories hoàn thành</span>
              </div>
              <span className="text-xl font-black text-emerald-600">{completedStories.length}</span>
            </div>

            <div className="flex items-center justify-between p-4 bg-amber-50 rounded-2xl border border-amber-100">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-amber-600">pending</span>
                <span className="text-sm font-bold text-amber-900">User Stories dang dở</span>
              </div>
              <span className="text-xl font-black text-amber-600">{unfinishedStories.length}</span>
            </div>
          </div>

          {unfinishedStories.length > 0 && (
            <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-on-surface-variant mb-3 ml-1">Kế hoạch cho User Story dang dở</label>
                <div className="space-y-2">
                  <label className={`flex items-center gap-4 p-4 rounded-2xl border-2 cursor-pointer transition-all ${moveTo === 'BACKLOG' ? 'border-primary bg-primary/5' : 'border-outline-variant/10 hover:border-primary/30'}`}>
                    <input 
                      type="radio" 
                      name="moveTo" 
                      className="w-5 h-5 accent-primary" 
                      checked={moveTo === 'BACKLOG'} 
                      onChange={() => setMoveTo('BACKLOG')}
                    />
                    <div className="flex-1">
                      <div className="font-bold text-on-surface text-sm">Đẩy về Product Backlog</div>
                      <div className="text-[10px] text-on-surface-variant leading-none mt-1 uppercase font-bold opacity-60">Sẽ được ưu tiên sau</div>
                    </div>
                  </label>

                  {plannedSprints.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-[10px] text-center text-outline-variant font-black uppercase tracking-[0.2em] py-1">— Hoặc chuyển sang —</div>
                      {plannedSprints.map(ps => (
                        <label key={ps.id} className={`flex items-center gap-4 p-4 rounded-2xl border-2 cursor-pointer transition-all ${moveTo === ps.id ? 'border-primary bg-primary/5' : 'border-outline-variant/10 hover:border-primary/30'}`}>
                          <input 
                            type="radio" 
                            name="moveTo" 
                            className="w-5 h-5 accent-primary" 
                            checked={moveTo === ps.id} 
                            onChange={() => setMoveTo(ps.id)}
                          />
                          <div className="flex-1">
                            <div className="font-bold text-on-surface text-sm">{ps.name}</div>
                            <div className="text-[10px] text-on-surface-variant leading-none mt-1 uppercase font-bold opacity-60">Sprint dự kiến</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          
          <div className="pt-4 flex gap-4">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 px-8 py-4 rounded-2xl font-bold text-on-surface-variant hover:bg-surface-container transition-all"
            >
              Hủy
            </button>
            <button 
              type="submit"
              disabled={loading}
              className="flex-3 px-12 py-4 rounded-2xl font-black bg-emerald-600 text-on-primary shadow-xl shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin" />
              ) : (
                <>
                  <span className="material-symbols-outlined font-bold">check_circle</span>
                  Hoàn tất Sprint
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
