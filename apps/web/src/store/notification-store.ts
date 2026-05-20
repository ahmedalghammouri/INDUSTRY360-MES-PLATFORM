import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export type NotificationSeverity = 'info' | 'warning' | 'critical' | 'success';
export type NotificationCategory = 'alarm' | 'production' | 'quality' | 'maintenance' | 'system';

export interface Notification {
  id: string;
  title: string;
  message: string;
  severity: NotificationSeverity;
  category: NotificationCategory;
  timestamp: Date;
  isRead: boolean;
  entityId?: string;
  entityType?: string;
  link?: string;
}

interface NotificationStore {
  notifications: Notification[];
  unreadCount: number;
  add: (notification: Omit<Notification, 'id' | 'timestamp' | 'isRead'>) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  remove: (id: string) => void;
  clear: () => void;
}

export const useNotificationStore = create<NotificationStore>()(
  immer((set) => ({
    notifications: [],
    unreadCount: 0,

    add: (notification) =>
      set((s) => {
        const newNotif: Notification = {
          ...notification,
          id: crypto.randomUUID(),
          timestamp: new Date(),
          isRead: false,
        };
        s.notifications.unshift(newNotif);
        if (s.notifications.length > 100) s.notifications = s.notifications.slice(0, 100);
        s.unreadCount = s.notifications.filter((n) => !n.isRead).length;
      }),

    markRead: (id) =>
      set((s) => {
        const n = s.notifications.find((n) => n.id === id);
        if (n) n.isRead = true;
        s.unreadCount = s.notifications.filter((n) => !n.isRead).length;
      }),

    markAllRead: () =>
      set((s) => {
        s.notifications.forEach((n) => { n.isRead = true; });
        s.unreadCount = 0;
      }),

    remove: (id) =>
      set((s) => {
        s.notifications = s.notifications.filter((n) => n.id !== id);
        s.unreadCount = s.notifications.filter((n) => !n.isRead).length;
      }),

    clear: () =>
      set((s) => {
        s.notifications = [];
        s.unreadCount = 0;
      }),
  })),
);
