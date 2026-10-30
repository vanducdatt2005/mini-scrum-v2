// frontend/src/hooks/useSocket.js
import { useEffect, useRef } from 'react';
import { getSocket, subscribeProjectRoom, setSocketUser } from '../context/SocketContext';

export { getSocket, setSocketUser };

export default function useSocket(projectId, onDataChanged) {
  const callbackRef = useRef(onDataChanged);
  const debounceRef = useRef(null);

  // Luôn cập nhật callback mới nhất
  useEffect(() => {
    callbackRef.current = onDataChanged;
  }, [onDataChanged]);

  useEffect(() => {
    if (!projectId) return;

    const handleEvent = (data) => {
      console.log(`🔄 [useSocket] Real-time event for project ${projectId}:`, data?.action || data);
      
      if (debounceRef.current) clearTimeout(debounceRef.current);
      
      debounceRef.current = setTimeout(() => {
        if (typeof callbackRef.current === 'function') {
          callbackRef.current(data);
        }
      }, 200);
    };

    // Đăng ký nhận sự kiện an toàn, tự động join room và rejoin khi reconnect
    const unsubscribe = subscribeProjectRoom(projectId, handleEvent);

    return () => {
      unsubscribe();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [projectId]);
}
