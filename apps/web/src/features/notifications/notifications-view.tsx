'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, BellOff, CheckCheck, Filter, AlertTriangle,
  Info, CheckCircle, Settings, Trash2, RefreshCw,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNotificationStore } from '@/store/notification-store';
import { api } from '@/services/api.client';
import { cn, timeAgo } from '@/lib/utils';

// ── Config ─────────────────────────────────────────────────────

const SEVERITY_CONFIG: Record<string, { icon: typeof Info; color: string; bg: string }> = {
  error:    { icon: AlertTriangle, color: 'text-red-400',   bg: 'bg-red-500/15'    },
  warning:  { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/15'  },
  info:     { icon: Info,          color: 'text-blue-400',  bg: 'bg-blue-500/15'   },
  success:  { icon: CheckCircle,   color: 'text-green-400', bg: 'bg-green-500/15'  },
  critical: { icon: AlertTriangle, color: 'text-red-400',   bg: 'bg-red-500/15'    },
};

const CATEGORY_COLORS: Record<string, string> = {
  alarm:       'text-red-400 bg-red-500/10 border-red-500/30',
  production:  'text-brand-400 bg-brand-500/10 border-brand-500/30',
  quality:     'text-purple-400 bg-purple-500/10 border-purple-500/30',
  maintenance: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  downtime:    'text-orange-400 bg-orange-500/10 border-orange-500/30',
  system:      'text-gray-400 bg-gray-500/10 border-gray-500/30',
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

// ── Types ───────────────────────────────────────────────────────

interface NotifItem {
  id: string;
  title: string;
  message: string;
  severity: string;
  category: string;
  isRead: boolean;
  createdAt: string;
  isApiRecord: boolean;
}

// ── Component ───────────────────────────────────────────────────

export function NotificationsView() {
  const wsNotifications = useNotificationStore(s => s.notifications);
  const wsMarkAllRead   = useNotificationStore(s => s.markAllRead);
  const setUnreadCount  = useNotificationStore(s => s.setUnreadCount);
  const [severityFilter, setSeverityFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // ── API queries ─────────────────────────────────────────────

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications', { params: { limit: 100 } }),
    staleTime: 20_000,
  });

  const apiData = data as any;
  const apiNotifications: NotifItem[] = (apiData?.data ?? []).map((n: any) => ({
    id: n.id,
    title: n.title,
    message: n.message ?? '',
    severity: n.severity ?? 'info',
    category: n.category ?? 'system',
    isRead: n.isRead,
    createdAt: n.createdAt,
    isApiRecord: true,
  }));

  // Sync unread count to store after fetch
  useEffect(() => {
    if (apiData?.unreadCount !== undefined && typeof setUnreadCount === 'function') {
      setUnreadCount(apiData.unreadCount);
    }
  }, [apiData, setUnreadCount]);

  // ── Merge WS + API notifications ────────────────────────────

  const apiIds = new Set(apiNotifications.map((n) => n.id));
  const freshWsNotifs: NotifItem[] = wsNotifications
    .filter((n) => !apiIds.has(n.id))
    .map((n) => ({
      id: n.id,
      title: n.title,
      message: n.message,
      severity: n.severity,
      category: n.category,
      isRead: n.isRead,
      createdAt: n.timestamp instanceof Date ? n.timestamp.toISOString() : String(n.timestamp),
      isApiRecord: false,
    }));

  const allNotifications: NotifItem[] = [...freshWsNotifs, ...apiNotifications];
  const unreadCount = allNotifications.filter((n) => !n.isRead).length;

  // ── Filtered list ────────────────────────────────────────────

  const filtered = allNotifications.filter((n) => {
    if (showUnreadOnly && n.isRead) return false;
    if (severityFilter !== 'all' && n.severity !== severityFilter) return false;
    if (categoryFilter !== 'all' && n.category !== categoryFilter) return false;
    return true;
  });

  // ── Mutations ────────────────────────────────────────────────

  const markAllMutation = useMutation({
    mutationFn: () => api.patch('/notifications/read-all'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
      wsMarkAllRead();
      setUnreadCount(0);
      toast({ title: 'All notifications marked as read', variant: 'success' });
    },
    onError: () => toast({ title: 'Failed to mark all read', variant: 'destructive' }),
  });

  const markOneMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/notifications/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
      toast({ title: 'Notification deleted' });
    },
    onError: () => toast({ title: 'Failed to delete', variant: 'destructive' }),
  });

  // ── Render ───────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6 max-w-4xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2.5">
            <Bell className="w-6 h-6 text-primary" />
            Notifications
            {unreadCount > 0 && (
              <Badge className="bg-destructive text-white border-0 text-xs">{unreadCount}</Badge>
            )}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            System alerts, alarms, and operational events
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAllMutation.mutate()}
              disabled={markAllMutation.isPending}
              className="gap-1.5"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Mark all read
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-muted-foreground w-14 shrink-0">Severity</span>
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
          <span className="text-xs font-medium text-muted-foreground w-14 shrink-0">Category</span>
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
            className="h-7 text-xs ml-auto gap-1.5"
          >
            <Filter className="w-3 h-3" />
            Unread only
          </Button>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="glass-card rounded-xl p-12 text-center text-muted-foreground">
          <RefreshCw className="w-8 h-8 mx-auto mb-3 opacity-40 animate-spin" />
          <div className="text-sm">Loading notifications…</div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card rounded-xl p-16 text-center">
          <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mx-auto mb-4">
            <BellOff className="w-8 h-8 text-muted-foreground/40" />
          </div>
          <div className="font-semibold text-foreground/70 text-base">
            {showUnreadOnly || severityFilter !== 'all' || categoryFilter !== 'all'
              ? 'No notifications match your filters'
              : 'No notifications yet'}
          </div>
          <div className="text-muted-foreground text-sm mt-1.5">
            {showUnreadOnly || severityFilter !== 'all' || categoryFilter !== 'all'
              ? 'Try clearing your filters to see all notifications.'
              : 'System events, alarms, and alerts will appear here when triggered.'}
          </div>
          {(showUnreadOnly || severityFilter !== 'all' || categoryFilter !== 'all') && (
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => { setSeverityFilter('all'); setCategoryFilter('all'); setShowUnreadOnly(false); }}
            >
              Clear filters
            </Button>
          )}
        </div>
      ) : (
        <div className="glass-card rounded-xl overflow-hidden divide-y divide-border/50">
          <AnimatePresence>
            {filtered.map((notif) => {
              const cfg = SEVERITY_CONFIG[notif.severity] ?? SEVERITY_CONFIG.info;
              const Icon = cfg.icon;
              return (
                <motion.div
                  key={notif.id}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 40, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className={cn(
                    'flex items-start gap-4 p-4 group transition-colors',
                    !notif.isRead ? 'bg-white/[0.025]' : 'opacity-70',
                    'hover:bg-white/[0.04] hover:opacity-100',
                  )}
                >
                  {/* Severity icon */}
                  <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5', cfg.bg)}>
                    <Icon className={cn('w-4 h-4', cfg.color)} />
                  </div>

                  {/* Content */}
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => {
                      if (!notif.isRead && notif.isApiRecord) {
                        markOneMutation.mutate(notif.id);
                      }
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className={cn('text-sm font-medium', !notif.isRead && 'text-foreground')}>
                        {notif.title}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                          {timeAgo(notif.createdAt)}
                        </span>
                        {!notif.isRead && (
                          <span className="w-2 h-2 rounded-full bg-brand-500 shrink-0" />
                        )}
                      </div>
                    </div>

                    {notif.message && (
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">
                        {notif.message}
                      </p>
                    )}

                    <div className="flex items-center gap-2 mt-1.5">
                      <Badge
                        className={cn('text-[10px] py-0 px-1.5 h-4 border', CATEGORY_COLORS[notif.category] ?? '')}
                      >
                        {notif.category}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={cn('text-[10px] py-0 px-1.5 h-4', cfg.color)}
                      >
                        {notif.severity}
                      </Badge>
                    </div>
                  </div>

                  {/* Delete button — visible on hover */}
                  {notif.isApiRecord && (
                    <button
                      onClick={() => deleteMutation.mutate(notif.id)}
                      className="shrink-0 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity p-1 rounded hover:bg-destructive/20 hover:text-destructive"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Stats footer */}
      {allNotifications.length > 0 && (
        <div className="text-xs text-muted-foreground text-center">
          {allNotifications.length} total · {unreadCount} unread
        </div>
      )}
    </div>
  );
}
