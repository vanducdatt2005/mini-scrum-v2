//frondent/src/hooks/useSocket.js
import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || `http://${window.location.hostname}:5000`;
let socket = null;

export const getSocket = () => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: true,
      reconnection: true,
    });
    
    socket.on('connect', () => console.log('🔌 Socket connected:', socket.id));
    socket.on('connect_error', (err) => console.error('❌ Socket connection error:', err));
  }
  return socket;
};

export default function useSocket(projectId, onDataChanged) {
  const callbackRef = useRef(onDataChanged);
  const debounceRef = useRef(null);

  // Luôn cập nhật callback mới nhất
  useEffect(() => {
    callbackRef.current = onDataChanged;
  }, [onDataChanged]);

  useEffect(() => {
    if (!projectId) return;

    const s = getSocket();

    // Đảm bảo socket đã kết nối trước khi join
    const joinRoom = () => {
      console.log(`📂 Emitting joinProject for room: ${projectId}`);
      s.emit('joinProject', projectId);
    };

    if (s.connected) {
      joinRoom();
    } else {
      s.once('connect', joinRoom);
    }

    const handleChange = (data) => {
      console.log(`🔄 Real-time update received for project ${projectId}:`, data);
      console.log("📡 Socket Event:", data?.action);
      
      if (debounceRef.current) clearTimeout(debounceRef.current);
      
      debounceRef.current = setTimeout(() => {
        console.log("🚀 Kích hoạt loadData/loadStories...");
        if (typeof callbackRef.current === 'function') {
          callbackRef.current(data);
        }
      }, 200);
    };

    // Lắng nghe sự kiện
    s.on('userStory:changed', handleChange);
    s.on('task:changed', handleChange);
    s.on('comment:changed', handleChange);

    return () => {
      console.log(`Cleaning up socket listeners for ${projectId}`);
      s.off('userStory:changed', handleChange);
      s.off('task:changed', handleChange);
      s.off('comment:changed', handleChange);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [projectId]);
}