'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

/** Default DOM id of the in-page slot where inline forms are rendered. */
export const INLINE_FORM_SLOT_ID = 'inline-form-slot';

/**
 * Placeholder rendered near the top of a page (right below the toolbar) into
 * which any open {@link InlineFormPanel} on that page portals itself. Keeping
 * the markup of the form where it logically lives while displaying it at the
 * top of the page avoids relocating large form blocks.
 */
export function InlineFormSlot({ id = INLINE_FORM_SLOT_ID, className }: { id?: string; className?: string }) {
  return <div id={id} className={className} />;
}

export interface InlineFormPanelProps {
  /** Whether the inline form is visible. */
  open: boolean;
  /** Called when the user dismisses the form (close button). */
  onClose: () => void;
  /** Header title. */
  title: string;
  /** Optional muted sub-title shown under the title. */
  description?: string;
  /** Optional leading icon shown in the header badge. */
  icon?: LucideIcon;
  /** Tailwind classes for the icon glyph color (e.g. "text-primary"). */
  iconClassName?: string;
  /** Tailwind classes for the icon badge background (e.g. "bg-primary/15"). */
  iconWrapClassName?: string;
  /** Optional footer node (typically action buttons). Rendered in a bordered footer bar. */
  footer?: React.ReactNode;
  /** Optional max-width / layout utility class for the panel wrapper. */
  className?: string;
  /** Body container className override. */
  bodyClassName?: string;
  /** Target slot id to portal into (defaults to the page's InlineFormSlot). */
  slotId?: string;
  children: React.ReactNode;
}

/**
 * InlineFormPanel — an in-page, animated create/edit form panel.
 *
 * Replaces popup `Dialog` based add/edit forms with a form that expands inline
 * within the page (in the {@link InlineFormSlot} placed below the toolbar),
 * mirroring the downtime "Log Event" form. Keeps the user in the same scroll
 * context instead of opening a modal overlay.
 *
 * If no slot is present on the page it gracefully falls back to rendering in
 * place wherever the panel is mounted.
 */
export function InlineFormPanel({
  open,
  onClose,
  title,
  description,
  icon: Icon,
  iconClassName = 'text-primary',
  iconWrapClassName = 'bg-primary/15',
  footer,
  className,
  bodyClassName,
  slotId = INLINE_FORM_SLOT_ID,
  children,
}: InlineFormPanelProps) {
  // Lazy init resolves the slot synchronously when a form mounts already-open
  // (the slot was committed by the page on an earlier render), avoiding a
  // one-frame flash of the panel at its in-tree position before it portals.
  const [container, setContainer] = React.useState<HTMLElement | null>(
    () => (typeof document !== 'undefined' ? document.getElementById(slotId) : null),
  );

  React.useEffect(() => {
    setContainer(document.getElementById(slotId));
  }, [slotId]);

  const panel = (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
          className={className}
        >
          <div className="border rounded-2xl bg-card shadow-lg overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b bg-muted/20">
              <div className="flex items-center gap-2">
                {Icon && (
                  <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', iconWrapClassName)}>
                    <Icon size={14} className={iconClassName} />
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold">{title}</p>
                  {description && <p className="text-[11px] text-muted-foreground">{description}</p>}
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
                <X size={14} />
              </Button>
            </div>

            {/* Body */}
            <div className={cn('p-5 flex flex-col gap-5 max-h-[70vh] overflow-y-auto', bodyClassName)}>
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t bg-muted/20">
                {footer}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // Portal into the page slot when available; otherwise render in place.
  // AnimatePresence stays mounted so enter/exit animations play either way.
  return container ? createPortal(panel, container) : panel;
}
