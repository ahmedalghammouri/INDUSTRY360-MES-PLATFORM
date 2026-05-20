'use client';

import { useToast } from '@/components/ui/use-toast';

export function Toaster() {
  const { toasts } = useToast();

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-sm">
      {toasts.map(({ id, title, description, variant }) => (
        <div
          key={id}
          className={`
            glass-card rounded-lg p-4 shadow-lg border transition-all
            ${variant === 'destructive' ? 'border-red-500/50 bg-red-500/10' : 'border-border'}
          `}
        >
          {title && <div className="font-semibold text-sm">{title}</div>}
          {description && <div className="text-sm text-muted-foreground mt-1">{description}</div>}
        </div>
      ))}
    </div>
  );
}
