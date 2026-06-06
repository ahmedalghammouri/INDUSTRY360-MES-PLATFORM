'use client';

import { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { Button } from './button';

interface FormDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  onSubmit: () => void;
  submitLabel?: string;
  isSubmitting?: boolean;
  isValid?: boolean;
}

export function FormDialog({
  open,
  onClose,
  title,
  children,
  onSubmit,
  submitLabel = 'Save',
  isSubmitting = false,
  isValid = true,
}: FormDialogProps) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="glass-card rounded-xl w-full max-w-2xl max-h-[90vh] overflow-auto"
          >
            <div className="sticky top-0 bg-background/95 backdrop-blur-sm border-b border-border p-4 flex items-center justify-between">
              <h3 className="font-semibold text-lg">{title}</h3>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="p-6 space-y-4">{children}</div>
            <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm border-t border-border p-4 flex gap-2 justify-end">
              <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button onClick={onSubmit} disabled={!isValid || isSubmitting}>
                {isSubmitting ? 'Saving...' : submitLabel}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
