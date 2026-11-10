import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function JoinPokerModal({ isOpen, onClose }) {
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleJoin = (e) => {
    e.preventDefault();
    let raw = roomCode.trim().toUpperCase().replace(/\s+/g, '');
    if (!raw) {
      setError('Vui lòng nhập mã phòng');
      return;
    }
    // Nếu người dùng dán cả URL
    if (raw.includes('/POKER/')) {
      raw = raw.split('/POKER/').pop();
    }
    // Nếu người dùng chỉ gõ 5 ký tự sau (quên PKR-)
    if (!raw.startsWith('PKR-') && !raw.startsWith('PKR')) {
      raw = `PKR-${raw}`;
    } else if (raw.startsWith('PKR') && !raw.startsWith('PKR-')) {
      raw = `PKR-${raw.slice(3)}`;
    }

    setError('');
    onClose();
    navigate(`/poker/${raw}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-3xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-3 border-b border-outline-variant/10 mb-4">
          <div className="flex items-center gap-2 text-primary font-bold text-base">
            <span className="material-symbols-outlined text-xl">style</span>
            <h3>Tham gia phòng Planning Poker</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-on-surface-variant hover:bg-surface-container-high transition-colors"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-on-surface-variant mb-1">
              Mã phòng Poker (ví dụ: PKR-A1B2C)
            </label>
            <input
              type="text"
              value={roomCode}
              onChange={(e) => {
                setRoomCode(e.target.value);
                if (error) setError('');
              }}
              placeholder="PKR-XXXXX"
              className="w-full px-4 py-2.5 rounded-xl border border-outline-variant/30 bg-surface-container-low text-on-surface font-mono text-center tracking-wider text-sm focus:outline-none focus:ring-2 focus:ring-primary uppercase"
              autoFocus
            />
            {error && <p className="text-error text-xs mt-1">{error}</p>}
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-outline-variant/20 text-on-surface-variant hover:bg-surface-container-high transition-colors text-xs font-bold"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold text-xs shadow-md hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-sm">login</span>
              Vào phòng
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

