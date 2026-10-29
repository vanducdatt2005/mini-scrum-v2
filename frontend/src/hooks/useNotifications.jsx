import { useNotificationContext } from '../context/NotificationContext';

export default function useNotifications() {
  return useNotificationContext() || {
    notifications: [],
    unreadCount: 0,
    markAsRead: () => {},
    markAllAsRead: () => {}
  };
}
