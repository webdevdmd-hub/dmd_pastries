import { ExternalLink, RotateCcw, Undo2 } from "lucide-react";
import Link from "next/link";
import type { JSX } from "react";

import { SalesReturnStatusBadge } from "@/components/payments/sales-return-status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { SalesReturn } from "@/types/sales-return";

type SalesReturnsCardGridProps = {
  canManage: boolean;
  canReverse: boolean;
  isCancelling: boolean;
  isPosting: boolean;
  isReversing: boolean;
  onCancel: (salesReturn: SalesReturn) => void;
  onPost: (salesReturn: SalesReturn) => void;
  onReverse: (salesReturn: SalesReturn) => void;
  returns: SalesReturn[];
};

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

function formatDate(value: string): string {
  return value ? new Date(value).toLocaleDateString("en-AE") : "Not recorded";
}

/** Credit notes as cards, for phones, with the same actions as the table. */
export function SalesReturnsCardGrid({
  canManage,
  canReverse,
  isCancelling,
  isPosting,
  isReversing,
  onCancel,
  onPost,
  onReverse,
  returns,
}: SalesReturnsCardGridProps): JSX.Element {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {returns.map((salesReturn) => (
        <Card className="overflow-hidden" key={salesReturn.id}>
          <div className="flex items-start justify-between gap-3 border-b border-workspace-border px-4 py-3">
            <div className="grid min-w-0 gap-0.5">
              <span className="truncate font-mono font-medium">{salesReturn.returnNumber}</span>
              <span className="truncate text-meta text-foreground-muted">
                {salesReturn.reason ?? "No reason"}
              </span>
              {salesReturn.reversalReturnNumber ? (
                <span className="text-meta text-info-text">
                  Reversal: {salesReturn.reversalReturnNumber}
                </span>
              ) : null}
            </div>
            <SalesReturnStatusBadge status={salesReturn.status} />
          </div>

          <div className="grid gap-1.5 px-4 py-3 text-cell">
            <span>
              <span className="font-mono font-medium">{salesReturn.saleNumber}</span>
              <span className="ml-2 text-meta text-foreground-muted">{salesReturn.branchName}</span>
            </span>
            <span className="text-foreground-muted">
              {salesReturn.customerName ?? "Walk-in customer"}
            </span>
          </div>

          <div className="grid grid-cols-2 border-t border-workspace-border bg-brand-latte/30">
            <div className="min-w-0 border-r border-workspace-border px-4 py-3">
              <p className="text-meta text-foreground-muted">Return date</p>
              <p className="mt-1 text-cell font-medium tabular-nums">
                {formatDate(salesReturn.returnDate)}
              </p>
            </div>
            <div className="min-w-0 px-4 py-3">
              <p className="text-meta text-foreground-muted">Refund</p>
              <p className="mt-1 text-cell font-medium tabular-nums">
                {salesReturn.refundMode === "refund"
                  ? formatMoney(salesReturn.refundAmount)
                  : "No refund"}
              </p>
              <p className="text-meta capitalize text-foreground-muted">
                {salesReturn.refundMode.replaceAll("_", " ")}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 border-t border-workspace-border px-4 py-3">
            <Button asChild size="sm" type="button" variant="outline">
              <Link href={`/payments/sales/${salesReturn.saleId}`}>
                <ExternalLink className="h-4 w-4" />
                Sale
              </Link>
            </Button>
            {canManage && salesReturn.status === "draft" ? (
              <>
                <Button
                  disabled={isPosting}
                  onClick={() => onPost(salesReturn)}
                  size="sm"
                  type="button"
                >
                  <RotateCcw className="h-4 w-4" />
                  Post
                </Button>
                <Button
                  disabled={isCancelling}
                  onClick={() => onCancel(salesReturn)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Cancel
                </Button>
              </>
            ) : null}
            {canReverse && salesReturn.status === "posted" ? (
              <Button
                disabled={isReversing}
                onClick={() => onReverse(salesReturn)}
                size="sm"
                type="button"
                variant="outline"
              >
                <Undo2 className="h-4 w-4" />
                Reverse
              </Button>
            ) : null}
          </div>
        </Card>
      ))}
    </div>
  );
}
