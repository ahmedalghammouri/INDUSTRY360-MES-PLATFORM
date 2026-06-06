'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, BellOff, CheckCheck, Filter, AlertTriangle,
  Info, CheckCircle, Settings, Trash2,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNotificationStore } from '@/store/notification-store';
import { api } from '@/services/api.client';
import { cn, timeAgo } from '@/lib/utils';

const severityConfig = {
  error:   { icon: AlertTriangle, color: 'text-red-400',   bg: 'bg-red-500/20'   },
  warning: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/20' },
  info:    { icon: Info,          color: 'text-blue-400',  bg: 'bg-blue-500/20'  },
  success: { icon: CheckCircle,   color: 'text-green-400', bg: 'bg-green-500/20' },
  // local store uses these names too
  critical: { icon: AlertTriangle, color: 'text-red-400',   bg: 'bg-red-500/20'   },
};

const categoryColors: Record<string, string> = {
  alarm:       'text-red-400 bg-red-500/20 border-red-500/30',
  production:  'text-brand-400 bg-brand-500/20 border-brand-500/30',
  quality:     'text-purple-400 bg-purple-500/20 border-purple-500/30',
  maintenance: 'text-amber-400 bg-amber-500/20 border-amber-500/30',
  downtime:    'text-orange-400 bg-orange-500/20 border-orange-500/30',
  system:      'text-gray-400 bg-gray-500/20 border-gray-500/30',
};

const SEVERITY_FILTERS = [
  { label: 'All',     value: 'all'     },
  { label: 'Error',   value: 'error'   },
  { label: 'Warning', value: 'warning' },
  { label: 'Info',    value: 'info'    },
];

const CATEGORY_FILTERS = [
  { label: 'All',         value: 'all'         },
  { label: 'Production',  value: 'production'  },
  { label: 'Quality',     value: 'quality'     },
  { label: 'Maintenance', value: 'maintenance' },
  { label: 'Downtime',    value: 'downtime'    },
];

interface ApiNotification {
  id: string;
  title: string;
  message?: string;
  severity: string;
  category: string;
  isRead: boolean;
  createdAt: string;
  link?: string;
}

export function NotificationsView() {
  const { notifications: wsNotifications, markAllRead: wsMarkAllRead, clear } = useNotificationStore();
  const [severityFilter, setSeverityFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications', { params: { limit: 100 } }),
    staleTime: 30_000,
  });

  const apiNotifications: ApiNotification[] = (data as any)?.data ?? (data as any) ?? [];

  const markAllMutation = useMutation({
    mutationFn: () => api.patch('/notifications/read-all'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      wsMarkAllRead();
      toast({ title: 'All notifications marked as read' });
    },
  });

  const markOneMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  // Merge API notifications with real-time WebSocket notifications
  // WS notifications that aren't in API (freshly received via socket) come first
  const apiIds = new Set(apiNotifications.map((n) => n.id));
  const freshWsNotifs = wsNotifications.filter((n) => !apiIds.has(n.id));

  const allNotifications = [
    ...freshWsNotifs.map((n) => ({
      id: n.id,
      title: n.title,
      message: n.message,
      severity: n.severity,
      category: n.category,
      isRead: n.isRead,
      createdAt: n.timestamp instanceof Date ? n.timestamp.toISOString() : String(n.timestamp),
    })),
    ...apiNotifications.map((n) => ({
      id: n.id,
      title: n.title,
      message: n.message ?? '',
      severity: n.severity,
      category: n.category,
      isRead: n.isRead,
      createdAt: n.createdAt,
    })),
  ];

  const filtered = allNotifications.filter((n) => {
    if (showUnreadOnly && n.isRead) return false;
    if (severityFilter !== 'all' && n.severity !== severityFilter) return false;
    if (categoryFilter !== 'all' && n.category !== categoryFilter) return false;
    return true;
  });

  const unreadCount = allNotifications.filter((n) => !n.isRead).length;

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            Notifications
            {unreadCount > 0 && (
              <Badge className="bg-brand-600 text-white border-0">{unreadCount}</Badge>
            )}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            System alerts, alarms, and operational events
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => markAllMutation.mutate()}>
            <CheckCheck className="w-4 h-4 mr-2" />
            Mark all read
          </Button>
          <Button variant="outline" size="sm">
            <Settings className="w-4 h-4 mr-2" />
            Preferences
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Severity:</span>
          {SEVERITY_FILTERS.map((f) => (
            <Button
              key={f.value}
              variant={severityFilter === f.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSeverityFilter(f.value)}
              className="h-7 text-xs"
            >
              {f.label}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Category:</span>
          {CATEGORY_FILTERS.map((f) => (
            <Button
              key={f.value}
              variant={categoryFilter === f.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCategoryFilter(f.value)}
              className="h-7 text-xs"
            >
              {f.label}
            </Button>
          ))}
          <Button
            variant={showUnreadOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowUnreadOnly(!showUnreadOnly)}
            className="h-7 text-xs ml-2"
          >
            <Filter className="w-3 h-3 mr-1" />
            Unread only
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center text-muted-foreground">
          <BellOff className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <div className="font-medium">No notifications</div>
          <div className="text-sm mt-1">All caught up!</div>
        </div>
      ) : (
        <div className="glass-card rounded-xl overflow-hidden divide-y divide-border/50">
          <AnimatePresence>
            {filtered.map((notif) => {
              const cfg = severityConfig[notif.severity as keyof typeof severityConfig] ?? severityConfig.info;
              const Icon = cfg.icon;
              const isApiNotif = apiIds.has(notif.id);
              return (
                <motion.div
                  key={notif.id}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className={cn(
                    'flex items-start gap-4 p-4 transition-colors cursor-pointer',
                    !notif.isRead && 'bg-white/[0.02]',
                    'hover:bg-white/[0.04]',
                  )}
                  onClick={() => {
                    if (!notif.isRead && isApiNotif) {
                      markOneMutation.mutate(notif.id);
                    }
                  }}
                >
                  <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5', cfg.bg)}>
                    <Icon className={cn('w-4 h-4', cfg.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-medium text-sm">{notif.title}</div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] text-muted-foreground">
                          {timeAgo(notif.createdAt)}
                        </span>
                        {!notif.isRead && <span className="w-2 h-2 rounded-full bg-brand-500" />}
                      </div>
                    </div>
                    {notif.message && (
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{notif.message}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5">
                      <Badge className={cn('text-[10px] py-0 px-1.5 h-4', categoryColors[notif.category] ?? '')}>
                        {notif.category}
                      </Badge>
                      <Badge variant="outline" className={cn('text-[10px] py-0 px-1.5 h-4', cfg.color)}>
                        {notif.severity}
                      </Badge>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
