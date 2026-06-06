'use client';

import { AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './dialog';
import { Button } from './button';

interface DeleteDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  isDeleting?: boolean;
}

export function DeleteDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  isDeleting = false,
}: DeleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-destructive/20 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-destructive" />
            </div>
            <DialogTitle className="text-base">{title}</DialogTitle>
          </div>
        </DialogHeader>
        <div className="py-2">
          <p className="text-sm text-muted-foreground">
            {description || 'This action cannot be undone. Are you sure?'}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
