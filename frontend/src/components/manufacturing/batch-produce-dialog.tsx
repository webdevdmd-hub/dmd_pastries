"use client";

import type { JSX } from "react";
import { useState } from "react";

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
import { produceSchema } from "@/lib/validators/manufacturing.schema";
import type { ProducePayload } from "@/types/manufacturing";

export function BatchProduceDialog({
  isSubmitting,
  onClose,
  onProduce,
  open,
}: {
  isSubmitting: boolean;
  onClose: () => void;
  onProduce: (payload: ProducePayload) => Promise<void>;
  open: boolean;
}): JSX.Element {
  const [quantityProduced, setQuantityProduced] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const submit = async (): Promise<void> => {
    const result = produceSchema.safeParse({ quantityProduced });

    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Please check produced quantity.");
      return;
    }

    await onProduce(result.data);
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}>
      <DialogContent className="max-w-xl p-0">
        <DialogHeader className="border-b border-border px-7 py-6">
          <DialogTitle>Produce output</DialogTitle>
          <DialogDescription>
            Record finished goods stock-in for this production batch.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 px-7 py-6">
          <label className="text-sm font-medium text-foreground">Quantity produced</label>
          <Input
            aria-label="Quantity produced"
            min="0"
            onChange={(event) => setQuantityProduced(Number(event.target.value))}
            type="number"
            value={quantityProduced}
          />
          <p className="text-sm text-foreground-muted">
            Finished stock increases only when backend accepts this output record.
          </p>
          {error ? <p className="text-sm font-semibold text-danger-text">{error}</p> : null}
        </div>
        <DialogFooter className="border-t border-border bg-muted px-7 py-5">
          <Button onClick={onClose} type="button" variant="outline">
            Cancel
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary"
            disabled={isSubmitting}
            onClick={() => void submit()}
            type="button"
          >
            Produce
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
