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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Produce output</DialogTitle>
          <DialogDescription>
            Record finished goods stock-in for this production batch.
          </DialogDescription>
        </DialogHeader>
        <Input
          aria-label="Quantity produced"
          min="0"
          onChange={(event) => setQuantityProduced(Number(event.target.value))}
          type="number"
          value={quantityProduced}
        />
        {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
        <DialogFooter>
          <Button onClick={onClose} type="button" variant="outline">
            Cancel
          </Button>
          <Button disabled={isSubmitting} onClick={() => void submit()} type="button">
            Produce
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
