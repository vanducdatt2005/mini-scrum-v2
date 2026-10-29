import React, { createContext, useContext, useState, useEffect } from 'react';
import { getSocket } from '../hooks/useSocket';
import { getNotifications, markNotificationAsRead } from '../services/api';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  // Load initial notifications
  useEffect(() => {
    let isMounted = true;
    const fetchNotifs = async () => {
      if (!currentUser?.id) return;
      try {
        const { data } = await getNotifications();
        if (isMounted) {
          setNotifications(data || []);
          setUnreadCount((data || []).filter(n => !n.isRead).length);
        }
      } catch (err) {
        console.error("Lỗi lấy notifications:", err);
      }
    };

    fetchNotifs();
    return () => { isMounted = false; };
  }, [currentUser?.id]);

  const markAsRead = async (id) => {
    const notif = notifications.find(n => n.id === id);
    if (!notif || notif.isRead) return;

    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, isRead: true } : n)));
    setUnreadCount(prev => Math.max(0, prev - 1));

    try {
      await markNotificationAsRead(id);
    } catch (err) {
      console.error("Lỗi đánh dấu đã đọc:", err);
      setNotifications(prev => prev.map(n => (n.id === id ? { ...n, isRead: false } : n)));
      setUnreadCount(prev => prev + 1);
    }
  };

  // Handle Socket
  useEffect(() => {
    if (!currentUser?.id) return;

    const s = getSocket();
    
    const joinUserRoom = () => {
      s.emit('joinUser', currentUser.id);
    };

    if (s.connected) {
      joinUserRoom();
    } else {
      s.once('connect', joinUserRoom);
    }

    const handleNewNotification = (data) => {
      setNotifications(prev => {
        if (prev.find(n => n.id === data.id)) return prev;
        return [data, ...prev];
      });
      
      if (!data.isRead) {
         setUnreadCount(prev => prev + 1);
         
         const sender = data.senderName || "Hệ thống";
         const message = data.message || data.content;
         
         const d = new Date(data.createdAt || Date.now());
         const timeStr = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;

         toast.success(
           <div 
             className="cursor-pointer"
             onClick={() => {
               toast.dismiss();
               if (data.id) markAsRead(data.id);
               if (data.link) navigate(data.link);
             }}
           >
             [{timeStr}] - {sender}: {message}
           </div>,  
           {
             duration: 4000,
             position: 'top-right',
           }
         );
      }
    };

    s.on('notification:new', handleNewNotification);

    return () => {
      s.emit('leaveUser', currentUser.id);
      s.off('notification:new', handleNewNotification);
    };
  }, [currentUser?.id]);

  const markAllAsRead = async () => {
    const unreadIds = notifications.filter(n => !n.isRead).map(n => n.id);
    if (unreadIds.length === 0) return;
    
    const prevNotifs = [...notifications];
    const prevCount = unreadCount;
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    setUnreadCount(0);

    try {
      await Promise.all(unreadIds.map(id => markNotificationAsRead(id)));
    } catch (err) {
      console.error("Lỗi đánh dấu tất cả đã đọc:", err);
      setNotifications(prevNotifs);
      setUnreadCount(prevCount);
    }
  };

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead, markAllAsRead }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotificationContext = () => useContext(NotificationContext);
