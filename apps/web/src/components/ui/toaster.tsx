'use client';

import { useEffect, useRef, useState } from 'react';
import { X, CheckCircle2, AlertTriangle, Info, XCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

const VARIANT_STYLES = {
  default: {
    container: 'bg-background/95 border-border text-foreground',
    icon: Info,
    iconCls: 'text-blue-400',
    progress: 'bg-blue-500',
  },
  success: {
    container: 'bg-background/95 border-green-500/40 text-foreground',
    icon: CheckCircle2,
    iconCls: 'text-green-400',
    progress: 'bg-green-500',
  },
  destructive: {
    container: 'bg-background/95 border-red-500/40 text-foreground',
    icon: XCircle,
    iconCls: 'text-red-400',
    progress: 'bg-red-500',
  },
  warning: {
    container: 'bg-background/95 border-yellow-500/40 text-foreground',
    icon: AlertTriangle,
    iconCls: 'text-yellow-400',
    progress: 'bg-yellow-500',
  },
};

function ToastItem({
  id, title, description, variant = 'default', duration = 4000, open,
  onDismiss,
}: {
  id: string; title?: React.ReactNode; description?: React.ReactNode;
  variant?: 'default' | 'destructive' | 'success' | 'warning';
  duration?: number; open?: boolean; onDismiss: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(100);
  const startRef = useRef<number>(Date.now());
  const rafRef = useRef<number>();

  // Slide-in on mount
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  // Slide-out when open=false
  useEffect(() => {
    if (open === false) setVisible(false);
  }, [open]);

  // Progress bar countdown
  useEffect(() => {
    if (!duration || duration === 0) return;
    startRef.current = Date.now();

    const tick = () => {
      const elapsed = Date.now() - startRef.current;
      const pct = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(pct);
      if (pct > 0) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [duration]);

  const cfg = VARIANT_STYLES[variant] ?? VARIANT_STYLES.default;
  const Icon = cfg.icon;

  return (
    <div
      className={cn(
        'relative flex items-start gap-3 rounded-xl border p-4 shadow-lg backdrop-blur-sm',
        'transition-all duration-300 ease-out overflow-hidden',
        cfg.container,
        visible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0',
      )}
    >
      {/* Icon */}
      <Icon size={16} className={cn('shrink-0 mt-0.5', cfg.iconCls)} />

      {/* Content */}
      <div className="flex-1 min-w-0">
        {title && <div className="text-sm font-semibold leading-snug">{title}</div>}
        {description && <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</div>}
      </div>

      {/* Close */}
      <button
        onClick={onDismiss}
        className="shrink-0 rounded-md p-0.5 opacity-60 hover:opacity-100 hover:bg-muted/50 transition-opacity"
      >
        <X size={13} />
      </button>

      {/* Auto-dismiss progress bar */}
      {duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-muted/30">
          <div
            className={cn('h-full transition-none rounded-full', cfg.progress)}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}

export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <div className="fixed bottom-4 right-4 z-[200] flex flex-col-reverse gap-2 w-full max-w-sm pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem
            id={t.id}
            title={t.title}
            description={t.description}
            variant={t.variant}
            duration={t.duration}
            open={t.open}
            onDismiss={() => dismiss(t.id)}
          />
        </div>
      ))}
    </div>
  );
}
