"use client";

import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ExpiryBatch, ExpiryBatchStatus } from "@/types/inventory";

type ExpiryBatchesSectionProps = {
  batches: ExpiryBatch[];
  canManage: boolean;
  isLoading: boolean;
  onStatusChange: (batchId: string, status: ExpiryBatchStatus) => void;
};

// Semantic variants so each batch state carries a dot (DESIGN.md sections 6
// and 9). Depleted moves from the legacy `secondary` to `draft`: a depleted
// batch is spent, which is the absence of a state rather than a state.
function statusBadge(status: ExpiryBatchStatus): JSX.Element {
  if (status === "expired") {
    return <Badge variant="danger">Expired</Badge>;
  }

  if (status === "depleted") {
    return <Badge variant="draft">Depleted</Badge>;
  }

  return <Badge variant="money">Active</Badge>;
}

function formatDate(value: string): string {
  return value ? new Date(value).toLocaleDateString("en-AE") : "Not recorded";
}

export function ExpiryBatchesSection({
  batches,
  canManage,
  isLoading,
  onStatusChange,
}: ExpiryBatchesSectionProps): JSX.Element {
  if (isLoading) {
    return <p className="text-sm text-foreground-muted">Loading expiry batches...</p>;
  }

  if (batches.length === 0) {
    return <p className="text-sm text-foreground-muted">No expiry batches recorded.</p>;
  }

  return (
    <div className="space-y-3">
      {batches.map((batch) => (
        <div className="rounded-2xl border border-border bg-card/70 p-3" key={batch.id}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium text-foreground">{batch.batchNumber}</p>
              <p className="text-xs text-foreground-muted">
                Qty {batch.quantity} · Expires {formatDate(batch.expiryDate)}
              </p>
            </div>
            {statusBadge(batch.status)}
          </div>
          {canManage ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                disabled={batch.status === "active"}
                onClick={() => onStatusChange(batch.id, "active")}
                size="sm"
                type="button"
                variant="outline"
              >
                Active
              </Button>
              <Button
                disabled={batch.status === "depleted"}
                onClick={() => onStatusChange(batch.id, "depleted")}
                size="sm"
                type="button"
                variant="outline"
              >
                Depleted
              </Button>
              <Button
                disabled={batch.status === "expired"}
                onClick={() => onStatusChange(batch.id, "expired")}
                size="sm"
                type="button"
                variant="outline"
              >
                Expired
              </Button>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
