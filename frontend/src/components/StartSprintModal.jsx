import React, { useState, useEffect } from 'react';
import api from '../services/api';

export default function StartSprintModal({ isOpen, onClose, sprint, stories = [], onStarted }) {
  const [formData, setFormData] = useState({
    name: '',
    goal: '',
    startDate: '',
    endDate: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (sprint) {
      setFormData({
        name: sprint.name || '',
        goal: sprint.goal || '',
        startDate: sprint.startDate ? new Date(sprint.startDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        endDate: sprint.endDate ? new Date(sprint.endDate).toISOString().split('T')[0] : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Default 2 weeks
      });
    }
  }, [sprint, isOpen]);

  if (!isOpen || !sprint) return null;

  const totalPoints = stories.reduce((sum, s) => sum + (s.storyPoints || 0), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.patch(`/sprint/${sprint.id}`, {
        ...formData,
        status: 'ACTIVE'
      });
      onStarted();
      onClose();
    } catch (err) {
      console.error("Lỗi khi bắt đầu Sprint:", err);
      alert(err.response?.data?.error || "Không thể bắt đầu Sprint. Vui lòng kiểm tra lại.");
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
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-3xl">play_circle</span>
            </div>
            <div>
              <h2 className="text-2xl font-black text-on-surface font-['Manrope'] tracking-tight">Bắt đầu Sprint</h2>
              <p className="text-xs text-on-surface-variant font-bold uppercase tracking-widest opacity-60">Xác nhận kế hoạch và triển khai</p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-surface-container-high rounded-full transition-all text-on-surface-variant">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/10">
              <span className="text-[10px] font-black uppercase text-outline tracking-widest block mb-1">User Stories</span>
              <span className="text-2xl font-black text-primary">{stories.length}</span>
            </div>
            <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/10">
              <span className="text-[10px] font-black uppercase text-outline tracking-widest block mb-1">Tổng Story Points</span>
              <span className="text-2xl font-black text-secondary">{totalPoints}</span>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2 ml-1">Tên Sprint</label>
              <input 
                required
                className="w-full bg-surface-container-low text-on-surface px-5 py-3.5 rounded-2xl border-2 border-transparent focus:border-primary focus:bg-white outline-none transition-all font-bold"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
              />
            </div>
            
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2 ml-1">Mục tiêu (Goal)</label>
              <textarea 
                className="w-full bg-surface-container-low text-on-surface px-5 py-3.5 rounded-2xl border-2 border-transparent focus:border-primary focus:bg-white outline-none transition-all min-h-[80px] resize-none font-medium"
                placeholder="Mục tiêu chính của sprint này là gì?"
                value={formData.goal}
                onChange={(e) => setFormData({...formData, goal: e.target.value})}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2 ml-1">Ngày bắt đầu</label>
                <input 
                  type="date"
                  required
                  className="w-full bg-surface-container-low text-on-surface px-5 py-3.5 rounded-2xl border-2 border-transparent focus:border-primary focus:bg-white outline-none transition-all font-bold"
                  value={formData.startDate}
                  onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2 ml-1">Ngày kết thúc</label>
                <input 
                  type="date"
                  required
                  className="w-full bg-surface-container-low text-on-surface px-5 py-3.5 rounded-2xl border-2 border-transparent focus:border-primary focus:bg-white outline-none transition-all font-bold"
                  value={formData.endDate}
                  onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                />
              </div>
            </div>
          </div>
          
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
              className="flex-3 px-12 py-4 rounded-2xl font-black bg-primary text-on-primary shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin" />
              ) : (
                <>
                  <span className="material-symbols-outlined font-bold">rocket_launch</span>
                  Bắt đầu ngay
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
