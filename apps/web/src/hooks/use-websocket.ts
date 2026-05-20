'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

import { useAuthStore } from '@/store/auth-store';
import { useNotificationStore } from '@/store/notification-store';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';

let globalSocket: Socket | null = null;

export function useWebSocket() {
  const { accessToken, isAuthenticated } = useAuthStore();
  const { add: addNotification } = useNotificationStore();
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !accessToken) return;

    if (!globalSocket) {
      globalSocket = io(WS_URL, {
        auth: { token: accessToken },
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        transports: ['websocket', 'polling'],
      });
    }

    const socket = globalSocket;

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    socket.on('notification', (data: {
      title: string;
      message: string;
      severity: 'info' | 'warning' | 'critical' | 'success';
      category: 'alarm' | 'production' | 'quality' | 'maintenance' | 'system';
    }) => {
      addNotification(data);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('notification');
    };
  }, [isAuthenticated, accessToken, addNotification]);

  const subscribe = useCallback((event: string, handler: (...args: unknown[]) => void) => {
    if (!globalSocket) return () => {};
    globalSocket.on(event, handler);
    return () => globalSocket?.off(event, handler);
  }, []);

  const emit = useCallback((event: string, data?: unknown) => {
    if (!globalSocket?.connected) return;
    globalSocket.emit(event, data);
  }, []);

  return { isConnected, subscribe, emit };
}

export function useWebSocketStatus(): boolean {
  const { isConnected } = useWebSocket();
  return isConnected;
}

export function useRealtimeData<T>(event: string, initialData: T) {
  const { subscribe } = useWebSocket();
  const [data, setData] = useState<T>(initialData);

  useEffect(() => {
    const unsubscribe = subscribe(event, (newData) => {
      setData(newData as T);
    });
    return unsubscribe;
  }, [event, subscribe]);

  return data;
}
