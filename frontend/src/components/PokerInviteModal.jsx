import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';

/**
 * Modal hiển thị thông tin phòng Poker vừa mở (Mã phòng + Link tham gia - AC1)
 */
export default function PokerInviteModal({ isOpen, onClose, room, storyTitle }) {
  const navigate = useNavigate();
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  if (!isOpen || !room) return null;

  const roomCode = room.roomCode;
  const joinUrl = `${window.location.origin}/poker/${roomCode}`;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopiedCode(true);
    toast.success(`Đã sao chép mã phòng: ${roomCode}`);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(joinUrl);
    setCopiedLink(true);
    toast.success('Đã sao chép link tham gia phòng Poker!');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleEnterRoom = () => {
    onClose();
    navigate(`/poker/${roomCode}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-surface-container-lowest w-full max-w-md rounded-3xl p-6 shadow-2xl border border-outline-variant/20 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Icon */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-inner">
              <span className="material-symbols-outlined text-2xl">style</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-on-surface">Phòng Planning Poker</h3>
              <p className="text-xs text-on-surface-variant line-clamp-1">
                US: <span className="font-semibold">{storyTitle || room.name}</span>
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-on-surface-variant hover:bg-surface-container rounded-full transition-colors"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        <div className="space-y-4 my-6">
          {/* Mã phòng nổi bật */}
          <div className="bg-surface-container p-4 rounded-2xl border border-outline-variant/30 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-outline block">Mã tham gia phòng</span>
              <span className="text-2xl font-black font-mono tracking-widest text-primary">{roomCode}</span>
            </div>
            <button
              onClick={handleCopyCode}
              className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                copiedCode 
                  ? 'bg-emerald-600 text-white shadow-sm' 
                  : 'bg-primary/10 text-primary hover:bg-primary/20'
              }`}
            >
              <span className="material-symbols-outlined text-sm">
                {copiedCode ? 'done' : 'content_copy'}
              </span>
              <span>{copiedCode ? 'Đã chép' : 'Sao chép mã'}</span>
            </button>
          </div>

          {/* Đường dẫn tham gia (Link Join) */}
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold tracking-wider text-outline block">Link tham gia trực tiếp</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={joinUrl}
                className="w-full bg-surface-container-high px-3.5 py-2.5 rounded-xl text-xs font-mono text-on-surface-variant border-none focus:outline-none select-all"
              />
              <button
                onClick={handleCopyLink}
                className={`p-2.5 rounded-xl text-xs font-bold flex items-center justify-center transition-all shrink-0 ${
                  copiedLink
                    ? 'bg-emerald-600 text-white'
                    : 'bg-surface-container-high hover:bg-primary/10 hover:text-primary text-on-surface'
                }`}
                title="Sao chép link"
              >
                <span className="material-symbols-outlined text-base">
                  {copiedLink ? 'done' : 'link'}
                </span>
              </button>
            </div>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-start gap-2.5">
            <span className="material-symbols-outlined text-amber-600 text-base shrink-0 mt-0.5">lock</span>
            <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed font-medium">
              Chỉ các thành viên thuộc cùng Dự án mới có quyền truy cập vào phòng này. Người ngoài dự án sẽ bị từ chối truy cập.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-on-surface-variant hover:bg-surface-container transition-colors"
          >
            Đóng
          </button>
          <button
            type="button"
            onClick={handleEnterRoom}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary/90 flex items-center gap-2 shadow-sm transition-all"
          >
            <span>Vào phòng ngay</span>
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </button>
        </div>
      </div>
    </div>
  );
}

