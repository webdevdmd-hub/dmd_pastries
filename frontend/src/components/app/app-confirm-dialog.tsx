"use client";

import type { JSX, ReactNode } from "react";

import { AppButton } from "@/components/app/app-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type AppConfirmDialogTone = "default" | "danger";

type AppConfirmDialogProps = {
  cancelLabel?: string;
  confirmLabel?: string;
  description: ReactNode;
  isSubmitting?: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: ReactNode;
  tone?: AppConfirmDialogTone;
};

export function AppConfirmDialog({
  cancelLabel = "Cancel",
  confirmLabel = "Confirm",
  description,
  isSubmitting = false,
  onConfirm,
  onOpenChange,
  open,
  title,
  tone = "default",
}: AppConfirmDialogProps): JSX.Element {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <AppButton onClick={() => onOpenChange(false)} type="button" variant="outline">
            {cancelLabel}
          </AppButton>
          <AppButton
            disabled={isSubmitting}
            onClick={onConfirm}
            tone={tone === "danger" ? "danger" : "default"}
            type="button"
          >
            {confirmLabel}
          </AppButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
