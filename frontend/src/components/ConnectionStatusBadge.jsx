import React, { useState } from 'react';
import { useSocketContext } from '../context/SocketContext';

export default function ConnectionStatusBadge({ className = '' }) {
  const { connectionStatus, retryCount, maxRetries, manualReconnect, isOnline } = useSocketContext();
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      {connectionStatus === 'connected' && (
        <button
          onClick={() => setShowTooltip((v) => !v)}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold cursor-pointer hover:bg-emerald-500/20 transition-colors"
          title="Kết nối thời gian thực ổn định"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="hidden sm:inline">Trực tuyến</span>
        </button>
      )}

      {connectionStatus === 'reconnecting' && (
        <button
          onClick={manualReconnect}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-semibold cursor-pointer hover:bg-amber-500/25 transition-colors"
          title="Đang thử kết nối lại tự động. Bấm để thử lại ngay."
        >
          <div className="w-2.5 h-2.5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <span>Kết nối lại ({retryCount}/{maxRetries})</span>
        </button>
      )}

      {connectionStatus === 'disconnected' && (
        <button
          onClick={manualReconnect}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-semibold cursor-pointer hover:bg-rose-500/25 transition-colors animate-pulse"
          title="Mất kết nối mạng. Bấm để thử lại thủ công."
        >
          <span className="material-symbols-outlined text-[14px]">wifi_off</span>
          <span>Mất kết nối (Thử lại)</span>
        </button>
      )}

      {/* Tooltip giải thích trạng thái */}
      {showTooltip && (
        <div className="absolute right-0 top-full mt-1.5 z-50 w-56 p-2.5 rounded-xl bg-surface-container-highest text-on-surface text-[11px] shadow-lg border border-outline-variant/15 pointer-events-none animate-in fade-in zoom-in-95">
          <p className="font-bold flex items-center gap-1 text-emerald-500">
            <span className="material-symbols-outlined text-sm">wifi</span>
            WebSocket Đang hoạt động
          </p>
          <p className="text-on-surface-variant mt-1">
            Mọi thay đổi trên User Story, Task và Bình luận được tự động cập nhật theo thời gian thực mà không cần tải lại trang.
          </p>
        </div>
      )}
    </div>
  );
}

