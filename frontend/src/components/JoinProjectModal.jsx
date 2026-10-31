import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { joinProjectByCode } from '../services/api';

export default function JoinProjectModal({ isOpen, onClose, onSuccess }) {
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!inviteCode.trim()) {
      setError('Vui lòng nhập mã mời');
      return;
    }

    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const res = await joinProjectByCode(inviteCode.trim());
      setSuccess(res.data.message || 'Tham gia dự án thành công!');
      setTimeout(() => {
        onClose();
        if (onSuccess) {
          onSuccess(res.data);
        } else if (res.data.projectId) {
          navigate(`/projects/${res.data.projectId}/backlog`);
        }
      }, 900);
    } catch (err) {
      setError(err.response?.data?.error || 'Không thể tham gia dự án. Vui lòng kiểm tra lại mã.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="fixed inset-0" 
        onClick={loading ? undefined : onClose}
      />

      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-outline-variant/10 p-6 md:p-8 overflow-hidden z-10 animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-4 border-b border-outline-variant/10 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">key</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-on-surface">Tham gia dự án</h3>
              <p className="text-xs text-on-surface-variant font-medium">Nhập mã mời được cung cấp bởi Product Owner</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            disabled={loading}
            className="p-1.5 text-on-surface-variant/60 hover:text-on-surface hover:bg-surface-container rounded-full transition-colors"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {error && (
          <div className="mb-5 p-3.5 bg-error-container text-on-error-container rounded-2xl text-xs font-semibold flex items-center gap-2.5 animate-in slide-in-from-top-1">
            <span className="material-symbols-outlined text-lg shrink-0">error</span>
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-5 p-3.5 bg-emerald-100 text-emerald-800 rounded-2xl text-xs font-semibold flex items-center gap-2.5 animate-in slide-in-from-top-1">
            <span className="material-symbols-outlined text-lg shrink-0">check_circle</span>
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">
              Mã mời dự án (Invite Code)
            </label>
            <div className="relative">
              <input
                type="text"
                autoFocus
                placeholder="VD: 5Z7RDK"
                maxLength={10}
                value={inviteCode}
                onChange={(e) => {
                  setInviteCode(e.target.value.toUpperCase().replace(/\s/g, ''));
                  if (error) setError(null);
                }}
                className="w-full text-center text-2xl font-mono font-black tracking-widest uppercase px-4 py-3.5 bg-surface-container-low border-2 border-outline-variant/20 rounded-2xl focus:border-primary focus:bg-white focus:outline-none transition-all placeholder:text-outline-variant placeholder:font-normal placeholder:tracking-normal placeholder:text-sm"
              />
            </div>
            <p className="mt-2 text-[11px] text-on-surface-variant/70 text-center">
              Mã mời gồm 6 ký tự chữ và số do người quản trị dự án chia sẻ
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              disabled={loading}
              onClick={onClose}
              className="flex-1 py-3 px-4 bg-surface-container text-on-surface font-bold text-sm rounded-xl hover:bg-surface-container-high transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading || !inviteCode.trim()}
              className="flex-1 py-3 px-4 bg-primary text-on-primary font-bold text-sm rounded-xl hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-md shadow-primary/20"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Đang kiểm tra...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg">login</span>
                  <span>Tham gia</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

