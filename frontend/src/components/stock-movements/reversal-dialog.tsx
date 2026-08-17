"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { JSX } from "react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type ReversalSchema, reversalSchema } from "@/lib/validators/stock-movements.schema";
import type { ReversalPayload, StockMovement } from "@/types/stock-movements";

type ReversalDialogProps = {
  isSubmitting: boolean;
  movement: StockMovement | null;
  onClose: () => void;
  onSubmit: (movementId: string, payload: ReversalPayload) => Promise<void>;
  open: boolean;
};

export function ReversalDialog({
  isSubmitting,
  movement,
  onClose,
  onSubmit,
  open,
}: ReversalDialogProps): JSX.Element {
  const form = useForm<ReversalSchema>({
    resolver: zodResolver(reversalSchema),
    defaultValues: { reason: "" },
  });

  useEffect(() => {
    form.reset({ reason: "" });
  }, [form, movement]);

  const handleSubmit = async (values: ReversalSchema): Promise<void> => {
    if (!movement) return;
    await onSubmit(movement.id, { reason: values.reason });
  };

  return (
    <Dialog onOpenChange={(nextOpen) => !nextOpen && onClose()} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reverse movement</DialogTitle>
          <DialogDescription>
            {movement
              ? `Create a reversal entry for ${movement.itemName}. This does not delete the original ledger entry.`
              : "Create a reversal entry."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            void form.handleSubmit((values) => {
              void handleSubmit(values);
            })(event);
          }}
        >
          <div className="rounded-2xl bg-warning-tint p-3 text-sm text-warning-text">
            Reversal is controlled by the backend. Protected sale or purchase movements may be
            rejected.
          </div>
          <div className="space-y-1">
            <Label htmlFor="reversalReason">Reason</Label>
            <Input id="reversalReason" {...form.register("reason")} />
          </div>
          <DialogFooter>
            <Button onClick={onClose} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? "Reversing..." : "Reverse movement"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
