'use client';

import { useState, useTransition, type FormEvent, type ReactNode } from 'react';
import { CircleAlertIcon, PlusIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { FieldGroup } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import type { ActionResult } from '@/lib/types';

interface FormDialogProps {
  /** The default trigger is a primary button with a plus icon and this label. */
  triggerLabel?: string;
  /** A custom trigger element instead (rendered with asChild). */
  trigger?: ReactNode;
  title: string;
  description?: ReactNode;
  submitLabel: string;
  /** Usually a Server Action. When it fails, the dialog stays open and shows the API's message. */
  onSubmit: () => Promise<ActionResult<unknown>>;
  /** Toast text after a successful submit, built from the form values. */
  successMessage: () => string;
  /** Called whenever the dialog closes, so the caller can reset its fields. */
  onClose?: () => void;
  /** Opens on first render (links like /app/users?new=1 from the command menu). */
  defaultOpen?: boolean;
  /** Controlled mode, for dialogs opened from a menu. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  submitDisabled?: boolean;
  destructive?: boolean;
  wide?: boolean;
  children: ReactNode;
}

/** A dialog around a form. The caller owns the (controlled) fields. */
export function FormDialog({
  triggerLabel,
  trigger,
  title,
  description,
  submitLabel,
  onSubmit,
  successMessage,
  onClose,
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  submitDisabled = false,
  destructive = false,
  wide = false,
  children,
}: FormDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = (next: boolean) => {
    setUncontrolledOpen(next);
    onOpenChange?.(next);
  };
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  const close = () => {
    setOpen(false);
    setError('');
    onClose?.();
  };

  const handleOpenChange = (next: boolean) => {
    if (next) setOpen(true);
    else if (!pending) close();
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    startTransition(async () => {
      const result = await onSubmit();
      if (result.ok) {
        const message = successMessage();
        close();
        toast.success(message);
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {(trigger || triggerLabel) && (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button>
              <PlusIcon />
              {triggerLabel}
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className={wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'}>
        <form onSubmit={handleSubmit} className="grid gap-5">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          {error && (
            <Alert variant="destructive" aria-live="polite">
              <CircleAlertIcon />
              <AlertDescription>
                <p>{error}</p>
              </AlertDescription>
            </Alert>
          )}
          <FieldGroup>{children}</FieldGroup>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={pending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" variant={destructive ? 'destructive' : 'default'} disabled={pending || submitDisabled}>
              {pending && <Spinner />}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
