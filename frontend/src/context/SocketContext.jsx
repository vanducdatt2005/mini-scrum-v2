import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { refreshToken } from '../services/api';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || `http://${window.location.hostname}:5000`;
const MAX_RECONNECT_ATTEMPTS = 5;

// Helper kiểm tra token đã hết hạn hoặc sắp hết hạn (trong vòng 30s)
export function isTokenExpired(token) {
  if (!token) return true;
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const payload = JSON.parse(jsonPayload);
    if (!payload.exp) return false;
    return payload.exp * 1000 <= Date.now() + 30000;
  } catch (err) {
    return true;
  }
}

// Helper lấy hoặc làm mới token trước khi gửi handshake (AC2)
export async function getFreshToken() {
  const currentToken = localStorage.getItem('token');
  if (!currentToken) return null;

  if (isTokenExpired(currentToken)) {
    try {
      console.log('🔄 Token hết hạn hoặc sắp hết hạn, đang tự động làm mới token trước handshake...');
      const res = await refreshToken(currentToken);
      if (res.data?.token) {
        localStorage.setItem('token', res.data.token);
        if (res.data.user) {
          localStorage.setItem('user', JSON.stringify(res.data.user));
        }
        console.log('✅ Làm mới token thành công cho WebSocket handshake');
        return res.data.token;
      }
    } catch (err) {
      console.error('❌ Không thể làm mới token trước handshake:', err);
    }
  }
  return currentToken;
}

// Singleton Socket Instance & Room Registry
let globalSocket = null;
const activeProjectSubscribers = new Map(); // projectId -> Set<callback>
let registeredUserId = null;
const reconnectCallbacks = new Set(); // Callbacks called when reconnect succeeds

export const getSocket = () => {
  if (!globalSocket) {
    const currentToken = localStorage.getItem('token');
    globalSocket = io(SOCKET_URL, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5,
      timeout: 10000,
      auth: (cb) => {
        getFreshToken()
          .then((token) => cb({ token: token || localStorage.getItem('token') }))
          .catch(() => cb({ token: localStorage.getItem('token') }));
      },
    });

    // Lắng nghe sự kiện nghiệp vụ toàn cục và phân phối về các subscriber theo projectId
    const dispatchProjectEvent = (data) => {
      const pId = data?.projectId;
      if (pId && activeProjectSubscribers.has(pId)) {
        const subs = activeProjectSubscribers.get(pId);
        subs.forEach((cb) => {
          try {
            cb(data);
          } catch (e) {
            console.error('Error in project subscriber callback:', e);
          }
        });
      }
    };

    globalSocket.on('userStory:changed', (data) => {
      console.log('📡 [GlobalSocket] userStory:changed:', data);
      dispatchProjectEvent(data);
    });

    globalSocket.on('task:changed', (data) => {
      console.log('📡 [GlobalSocket] task:changed:', data);
      dispatchProjectEvent(data);
    });

    globalSocket.on('comment:changed', (data) => {
      console.log('📡 [GlobalSocket] comment:changed:', data);
      dispatchProjectEvent(data);
    });
  }
  return globalSocket;
};

// Đăng ký UserId cho personal notification room
export const setSocketUser = (userId) => {
  registeredUserId = userId;
  const s = getSocket();
  if (userId && s.connected) {
    s.emit('joinUser', userId);
  }
};

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const [connectionStatus, setConnectionStatus] = useState('connected'); // 'connected' | 'reconnecting' | 'disconnected'
  const [retryCount, setRetryCount] = useState(0);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [lastConnectedAt, setLastConnectedAt] = useState(Date.now());
  const [lastError, setLastError] = useState(null);

  const socketRef = useRef(null);

  // Hàm rejoin toàn bộ các Room hiện hành (AC2)
  const rejoinAllRooms = useCallback(() => {
    const s = socketRef.current || getSocket();
    if (!s || !s.connected) return;

    const projectIds = Array.from(activeProjectSubscribers.keys());
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    const targetUserId = registeredUserId || currentUser?.id;

    console.log('🔄 Đang tự động rejoin lại các Room dự án và cá nhân:', { projectIds, targetUserId });
    
    // Phát sự kiện batch rejoinRooms tới server
    s.emit('rejoinRooms', { projectIds, userId: targetUserId }, (res) => {
      console.log('✅ Server xác nhận đã rejoin các room:', res);
    });

    // Phát song song từng phòng để đảm bảo tương thích
    projectIds.forEach((pId) => s.emit('joinProject', pId));
    if (targetUserId) {
      s.emit('joinUser', targetUserId);
    }

    // Thông báo cho các subscriber là kết nối đã hồi phục để đồng bộ lại dữ liệu
    projectIds.forEach((pId) => {
      const subs = activeProjectSubscribers.get(pId);
      if (subs) {
        subs.forEach((cb) => {
          try {
            cb({ action: 'reconnected', projectId: pId });
          } catch (e) {
            console.error('Error notifying reconnected:', e);
          }
        });
      }
    });

    reconnectCallbacks.forEach((cb) => {
      try {
        cb();
      } catch (e) {
        console.error('Error in reconnect callback:', e);
      }
    });
  }, []);

  // Hàm thử kết nối lại thủ công (AC3)
  const manualReconnect = useCallback(async () => {
    console.log('🔘 Người dùng kích hoạt [Thử lại thủ công]...');
    const s = socketRef.current || getSocket();
    setConnectionStatus('reconnecting');
    setRetryCount(1);
    setLastError(null);

    // Cập nhật token mới nhất trước khi kết nối lại
    const freshToken = await getFreshToken();
    if (freshToken) {
      s.auth = { token: freshToken };
    }

    if (s.connected) {
      s.disconnect();
    }

    // Reset bộ đếm retry của socket.io manager
    if (s.io) {
      s.io.skipReconnect = false;
    }
    s.connect();
  }, []);

  useEffect(() => {
    const s = getSocket();
    socketRef.current = s;

    // Cập nhật trạng thái ban đầu
    setConnectionStatus(s.connected ? 'connected' : 'reconnecting');

    // Sự kiện khi kết nối thành công (lần đầu hoặc sau khi reconnect)
    const handleConnect = () => {
      console.log('🔌 [SocketContext] Kết nối thành công (socket.id:', s.id, ')');
      setConnectionStatus('connected');
      setRetryCount(0);
      setLastError(null);
      setLastConnectedAt(Date.now());
      rejoinAllRooms();
    };

    // Sự kiện khi mất kết nối đột ngột (AC1)
    const handleDisconnect = (reason) => {
      console.warn(`❌ [SocketContext] Mất kết nối WebSocket. Lý do: ${reason}`);
      if (reason === 'io client disconnect') {
        setConnectionStatus('disconnected');
      } else {
        setConnectionStatus('reconnecting');
        setRetryCount((prev) => (prev === 0 ? 1 : prev));
      }
    };

    // Sự kiện khi bắt đầu một lần thử kết nối lại (AC1)
    const handleReconnectAttempt = (attempt) => {
      console.log(`⏳ [SocketContext] Đang thử kết nối lại (Lần ${attempt}/${MAX_RECONNECT_ATTEMPTS})...`);
      setConnectionStatus('reconnecting');
      setRetryCount(attempt);
    };

    // Sự kiện kết nối lại thành công (AC2)
    const handleReconnect = (attempt) => {
      console.log(`🎉 [SocketContext] Kết nối lại thành công sau ${attempt} lần thử!`);
      setConnectionStatus('connected');
      setRetryCount(0);
      setLastError(null);
      setLastConnectedAt(Date.now());
      rejoinAllRooms();
    };

    // Sự kiện một lần thử kết nối lại thất bại
    const handleReconnectError = async (err) => {
      console.warn('⚠️ [SocketContext] Thử kết nối lại thất bại:', err?.message || err);
      setLastError(err?.message || 'Lỗi kết nối lại');

      // Nếu token hết hạn bị server từ chối, làm mới token ngay
      if (err?.message === 'TOKEN_EXPIRED') {
        console.log('🔄 Server trả về TOKEN_EXPIRED trong handshake. Đang refresh token...');
        const newToken = await getFreshToken();
        if (newToken) {
          s.auth = { token: newToken };
        }
      }
    };

    // Sự kiện vượt quá số lần thử kết nối tối đa (AC3)
    const handleReconnectFailed = () => {
      console.error(`🛑 [SocketContext] Đã vượt quá ${MAX_RECONNECT_ATTEMPTS} lần thử kết nối lại. Dừng lại.`);
      setConnectionStatus('disconnected');
      setRetryCount(MAX_RECONNECT_ATTEMPTS);
      setLastError('Vượt quá số lần thử kết nối tối đa');
    };

    // Sự kiện lỗi kết nối / handshake
    const handleConnectError = async (err) => {
      console.warn('⚠️ [SocketContext] Lỗi kết nối (connect_error):', err?.message || err);
      setLastError(err?.message || 'Không thể kết nối máy chủ');

      if (err?.message === 'TOKEN_EXPIRED') {
        console.log('🔄 Bị từ chối handshake do token hết hạn. Đang làm mới token...');
        const newToken = await getFreshToken();
        if (newToken) {
          s.auth = { token: newToken };
          setTimeout(() => s.connect(), 500);
        }
      }
    };

    s.on('connect', handleConnect);
    s.on('disconnect', handleDisconnect);
    s.on('connect_error', handleConnectError);

    if (s.io) {
      s.io.on('reconnect_attempt', handleReconnectAttempt);
      s.io.on('reconnect', handleReconnect);
      s.io.on('reconnect_error', handleReconnectError);
      s.io.on('reconnect_failed', handleReconnectFailed);
    }

    // Lắng nghe sự kiện mạng trình duyệt (Online / Offline)
    const handleOnline = () => {
      console.log('🌐 Trình duyệt đã có kết nối mạng (online)');
      setIsOnline(true);
      if (!s.connected) {
        manualReconnect();
      }
    };

    const handleOffline = () => {
      console.warn('🚫 Trình duyệt bị ngắt kết nối mạng (offline)');
      setIsOnline(false);
      setConnectionStatus('disconnected');
      setLastError('Không có kết nối mạng');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Expose helpers cho Dev & Test Simulation trên window
    window.__miniScrumSocket = {
      getSocket: () => s,
      getStatus: () => ({ connectionStatus, retryCount, isOnline, activeRooms: Array.from(activeProjectSubscribers.keys()) }),
      simulateDisconnect: () => {
        console.log('🧪 [SIMULATION] Giả lập ngắt kết nối socket');
        s.io.engine && s.io.engine.close();
      },
      simulateOffline: () => {
        console.log('🧪 [SIMULATION] Giả lập rớt mạng (Offline)');
        window.dispatchEvent(new Event('offline'));
      },
      simulateOnline: () => {
        console.log('🧪 [SIMULATION] Giả lập khôi phục mạng (Online)');
        window.dispatchEvent(new Event('online'));
      },
      simulateMaxRetries: () => {
        console.log('🧪 [SIMULATION] Giả lập thử lại thất bại 5 lần');
        setConnectionStatus('disconnected');
        setRetryCount(MAX_RECONNECT_ATTEMPTS);
        setLastError('Mất kết nối mạng. Đã thử 5 lần thất bại');
      },
      manualReconnect,
    };

    return () => {
      s.off('connect', handleConnect);
      s.off('disconnect', handleDisconnect);
      s.off('connect_error', handleConnectError);
      if (s.io) {
        s.io.off('reconnect_attempt', handleReconnectAttempt);
        s.io.off('reconnect', handleReconnect);
        s.io.off('reconnect_error', handleReconnectError);
        s.io.off('reconnect_failed', handleReconnectFailed);
      }
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [rejoinAllRooms, manualReconnect]);

  const value = {
    socket: socketRef.current || getSocket(),
    connectionStatus,
    retryCount,
    maxRetries: MAX_RECONNECT_ATTEMPTS,
    isOnline,
    lastConnectedAt,
    lastError,
    manualReconnect,
    rejoinAllRooms,
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

export const useSocketContext = () => {
  const ctx = useContext(SocketContext);
  if (!ctx) {
    throw new Error('useSocketContext must be used within a SocketProvider');
  }
  return ctx;
};

// Đăng ký subscriber cho một Project ID cụ thể
export const subscribeProjectRoom = (projectId, callback) => {
  if (!projectId || typeof callback !== 'function') return () => {};

  if (!activeProjectSubscribers.has(projectId)) {
    activeProjectSubscribers.set(projectId, new Set());
    const s = getSocket();
    if (s.connected) {
      s.emit('joinProject', projectId);
    }
  }

  activeProjectSubscribers.get(projectId).add(callback);

  return () => {
    const subs = activeProjectSubscribers.get(projectId);
    if (subs) {
      subs.delete(callback);
      if (subs.size === 0) {
        activeProjectSubscribers.delete(projectId);
        const s = getSocket();
        if (s.connected) {
          s.emit('leaveProject', projectId);
        }
      }
    }
  };
};

export const onSocketReconnect = (callback) => {
  if (typeof callback === 'function') {
    reconnectCallbacks.add(callback);
    return () => reconnectCallbacks.delete(callback);
  }
  return () => {};
};

