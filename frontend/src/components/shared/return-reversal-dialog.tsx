"use client";

import type { JSX } from "react";
import { useEffect, useId, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ReturnReversalDialogProps = {
  description: string;
  isSubmitting: boolean;
  noteNumber: string | null;
  onConfirm: (reason: string) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
};

export function ReturnReversalDialog({
  description,
  isSubmitting,
  noteNumber,
  onConfirm,
  onOpenChange,
  open,
  title,
}: ReturnReversalDialogProps): JSX.Element {
  const reasonId = useId();
  const [reason, setReason] = useState("");
  const trimmedReason = reason.trim();

  useEffect(() => {
    if (!open) {
      setReason("");
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {noteNumber ? (
            <div className="rounded-2xl border border-brand-cappuccino bg-brand-latte/70 p-3 text-sm text-brand-mocha">
              Reversing <span className="font-semibold text-brand-espresso">{noteNumber}</span>
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor={reasonId}>Reversal reason</Label>
            <Textarea
              id={reasonId}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Explain why this posted note needs to be reversed."
              value={reason}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            disabled={isSubmitting}
            onClick={() => onOpenChange(false)}
            type="button"
            variant="outline"
          >
            Close
          </Button>
          <Button
            className="bg-danger text-primary-foreground hover:bg-danger"
            disabled={isSubmitting || trimmedReason.length === 0}
            onClick={() => onConfirm(trimmedReason)}
            type="button"
          >
            Reverse
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
