import React from 'react';

/**
 * US-063: Subtle Sync Indicator (AC4)
 * Hiển thị indicator nhẹ nhàng, tinh tế khi hệ thống đang đối chiếu dữ liệu sau khi Reconnect,
 * không che khuất màn hình hay làm gián đoạn trải nghiệm người dùng.
 */
export default function SyncIndicator({ isSyncing, syncStatus, lastSyncAt }) {
  if (!isSyncing && syncStatus !== 'synced' && syncStatus !== 'error') {
    return null;
  }

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-top-1">
      {isSyncing && (
        <div className="flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 px-2.5 py-0.5 rounded-full shadow-sm">
          <div className="w-2.5 h-2.5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <span className="text-[11px] font-bold tracking-tight">Đang đồng bộ dữ liệu...</span>
        </div>
      )}

      {!isSyncing && syncStatus === 'synced' && (
        <div className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-2.5 py-0.5 rounded-full shadow-sm">
          <span className="material-symbols-outlined text-[13px] font-black">check_circle</span>
          <span className="text-[11px] font-bold tracking-tight">Dữ liệu đã đồng bộ</span>
        </div>
      )}

      {!isSyncing && syncStatus === 'error' && (
        <div className="flex items-center gap-1.5 bg-error/10 text-error border border-error/20 px-2.5 py-0.5 rounded-full shadow-sm">
          <span className="material-symbols-outlined text-[13px]">warning</span>
          <span className="text-[11px] font-bold tracking-tight">Lỗi đối chiếu</span>
        </div>
      )}
    </div>
  );
}

