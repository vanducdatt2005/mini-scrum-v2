import React, { useState, useEffect } from 'react';
import { useSocketContext } from '../context/SocketContext';

export default function ConnectionStatusBanner() {
  const { connectionStatus, retryCount, maxRetries, manualReconnect, isOnline } = useSocketContext();
  const [showReconnectedSuccess, setShowReconnectedSuccess] = useState(false);
  const [prevStatus, setPrevStatus] = useState(connectionStatus);
  const [showSimModal, setShowSimModal] = useState(false);

  useEffect(() => {
    // Nếu chuyển từ reconnecting -> connected, hiển thị thông báo thành công tạm thời
    if (prevStatus === 'reconnecting' && connectionStatus === 'connected') {
      setShowReconnectedSuccess(true);
      const timer = setTimeout(() => setShowReconnectedSuccess(false), 4000);
      return () => clearTimeout(timer);
    }
    setPrevStatus(connectionStatus);
  }, [connectionStatus, prevStatus]);

  // Khi đang kết nối bình thường và không cần hiện banner success
  if (connectionStatus === 'connected' && !showReconnectedSuccess && !showSimModal) {
    return null;
  }

  return (
    <>
      {/* 1. Banner khi Đang kết nối lại (AC1) */}
      {connectionStatus === 'reconnecting' && (
        <div className="w-full bg-amber-500/15 border-b border-amber-500/30 text-amber-900 dark:text-amber-200 px-4 py-2.5 flex items-center justify-between text-sm shadow-sm transition-all duration-300 animate-in slide-in-from-top">
          <div className="flex items-center gap-2.5 max-w-4xl mx-auto w-full">
            <div className="w-4 h-4 border-2 border-amber-600 dark:border-amber-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="font-bold">Đang kết nối lại...</span>
              <span className="ml-2 text-xs opacity-90">
                (Lần thử {retryCount || 1}/{maxRetries} theo Exponential Backoff)
              </span>
              <span className="hidden sm:inline-block ml-3 text-xs opacity-75">
                • Hệ thống sẽ tự động xác thực lại và đưa bạn vào lại phòng dự án ngay khi có kết nối.
              </span>
            </div>
            <button
              onClick={() => setShowSimModal(true)}
              className="text-xs px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-900 dark:text-amber-200 font-medium transition-colors cursor-pointer"
              title="Công cụ kiểm thử kịch bản rớt mạng"
            >
              🧪 Kiểm thử
            </button>
          </div>
        </div>
      )}

      {/* 2. Banner khi Thất bại sau số lần thử tối đa / Mất kết nối (AC3) */}
      {connectionStatus === 'disconnected' && (
        <div className="w-full bg-rose-500/15 border-b border-rose-500/30 text-rose-900 dark:text-rose-200 px-4 py-3 flex items-center justify-between text-sm shadow-sm transition-all duration-300 animate-in slide-in-from-top">
          <div className="flex items-center justify-between gap-3 max-w-4xl mx-auto w-full flex-wrap sm:flex-nowrap">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-rose-600 dark:text-rose-400 text-xl flex-shrink-0">
                wifi_off
              </span>
              <div>
                <p className="font-bold">
                  {!isOnline
                    ? 'Bạn đang ngoại tuyến (Offline). Vui lòng kiểm tra lại kết nối Wi-Fi/Internet.'
                    : 'Mất kết nối mạng. Vui lòng kiểm tra lại đường truyền.'}
                </p>
                <p className="text-xs opacity-85 mt-0.5">
                  Đã thử kết nối lại vượt quá {maxRetries} lần nhưng chưa thành công. Bạn có thể bấm nút bên cạnh để thử lại.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-2 sm:mt-0 w-full sm:w-auto justify-end">
              <button
                onClick={() => setShowSimModal(true)}
                className="text-xs px-2.5 py-1.5 rounded bg-rose-500/15 hover:bg-rose-500/25 text-rose-800 dark:text-rose-200 font-medium transition-colors cursor-pointer"
              >
                🧪 Giả lập
              </button>
              <button
                onClick={manualReconnect}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">refresh</span>
                Thử lại thủ công
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Thông báo khôi phục kết nối thành công (AC2) */}
      {connectionStatus === 'connected' && showReconnectedSuccess && (
        <div className="w-full bg-emerald-500/15 border-b border-emerald-500/30 text-emerald-900 dark:text-emerald-200 px-4 py-2 flex items-center justify-between text-sm shadow-sm transition-all duration-300 animate-in slide-in-from-top">
          <div className="flex items-center justify-between gap-2 max-w-4xl mx-auto w-full">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-lg">
                check_circle
              </span>
              <span className="font-semibold text-xs sm:text-sm">
                Đã khôi phục kết nối mạng và tự động gia nhập lại các phòng dự án!
              </span>
            </div>
            <button
              onClick={() => setShowReconnectedSuccess(false)}
              className="p-1 hover:bg-emerald-500/20 rounded text-emerald-800 dark:text-emerald-300 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
        </div>
      )}

      {/* 4. Modal công cụ giả lập kịch bản rớt mạng (DoD Simulation) */}
      {showSimModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-surface-container-lowest dark:bg-zinc-900 text-on-surface rounded-2xl max-w-md w-full p-6 shadow-2xl border border-outline-variant/20 animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-2xl">network_check</span>
                <h3 className="font-black text-lg">Giả lập kịch bản mạng (DoD)</h3>
              </div>
              <button
                onClick={() => setShowSimModal(false)}
                className="p-1.5 rounded-lg hover:bg-surface-container-high text-on-surface-variant cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <p className="text-xs text-on-surface-variant mb-5">
              Dùng các nút dưới đây để kiểm tra phản hồi của WebSocket Reconnect Loop, Rejoin Room và xử lý sự cố mạng:
            </p>

            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-surface-container-low dark:bg-zinc-800/60 border border-outline-variant/10 flex items-center justify-between">
                <div>
                  <div className="font-bold text-xs">AC1: Ngắt kết nối socket</div>
                  <div className="text-[11px] text-on-surface-variant">Kích hoạt reconnect loop & backoff</div>
                </div>
                <button
                  onClick={() => {
                    window.__miniScrumSocket?.simulateDisconnect();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold text-xs hover:bg-amber-500/30 cursor-pointer"
                >
                  Ngắt kết nối
                </button>
              </div>

              <div className="p-3 rounded-xl bg-surface-container-low dark:bg-zinc-800/60 border border-outline-variant/10 flex items-center justify-between">
                <div>
                  <div className="font-bold text-xs">AC1: Giả lập rớt mạng (Offline)</div>
                  <div className="text-[11px] text-on-surface-variant">Mô phỏng mất Wi-Fi / DevTools Offline</div>
                </div>
                <button
                  onClick={() => {
                    window.__miniScrumSocket?.simulateOffline();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-700 dark:text-rose-300 font-bold text-xs hover:bg-rose-500/30 cursor-pointer"
                >
                  Offline
                </button>
              </div>

              <div className="p-3 rounded-xl bg-surface-container-low dark:bg-zinc-800/60 border border-outline-variant/10 flex items-center justify-between">
                <div>
                  <div className="font-bold text-xs">AC2: Khôi phục mạng (Online)</div>
                  <div className="text-[11px] text-on-surface-variant">Tự động kết nối lại & Rejoin Room</div>
                </div>
                <button
                  onClick={() => {
                    window.__miniScrumSocket?.simulateOnline();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold text-xs hover:bg-emerald-500/30 cursor-pointer"
                >
                  Online trở lại
                </button>
              </div>

              <div className="p-3 rounded-xl bg-surface-container-low dark:bg-zinc-800/60 border border-outline-variant/10 flex items-center justify-between">
                <div>
                  <div className="font-bold text-xs">AC3: Thất bại sau 5 lần thử</div>
                  <div className="text-[11px] text-on-surface-variant">Hiển thị lỗi và nút Thử lại thủ công</div>
                </div>
                <button
                  onClick={() => {
                    window.__miniScrumSocket?.simulateMaxRetries();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 text-white font-bold text-xs hover:bg-rose-700 cursor-pointer"
                >
                  Thất bại 5 lần
                </button>
              </div>

              <div className="p-3 rounded-xl bg-surface-container-low dark:bg-zinc-800/60 border border-outline-variant/10 flex items-center justify-between">
                <div>
                  <div className="font-bold text-xs">AC3: Thử lại thủ công</div>
                  <div className="text-[11px] text-on-surface-variant">Bắt đầu kết nối lại ngay lập tức</div>
                </div>
                <button
                  onClick={() => {
                    manualReconnect();
                    setShowSimModal(false);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-primary text-on-primary font-bold text-xs hover:opacity-90 cursor-pointer"
                >
                  Thử lại ngay
                </button>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowSimModal(false)}
                className="px-4 py-2 rounded-xl bg-surface-container-high text-xs font-bold hover:bg-surface-container-highest cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

