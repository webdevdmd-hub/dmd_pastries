"use client";

import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import type { JSX } from "react";

import { PurchaseReturnStatusBadge } from "@/components/purchasing/purchase-return-status-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ROUTES } from "@/constants/routes";
import type { PurchaseReturn } from "@/types/purchasing";

export type PurchaseReturnsListProps = {
  canCancel: boolean;
  canPost: boolean;
  canReverse: boolean;
  onCancel: (purchaseReturn: PurchaseReturn) => void;
  onPost: (purchaseReturn: PurchaseReturn) => void;
  onReverse: (purchaseReturn: PurchaseReturn) => void;
  /** Opens the note's details; the whole row is the target. */
  onView: (purchaseReturn: PurchaseReturn) => void;
  returns: PurchaseReturn[];
};

export function formatPurchaseReturnCurrency(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

export function formatPurchaseReturnDay(value: string | null): string {
  return value
    ? new Intl.DateTimeFormat("en-AE", { dateStyle: "medium" }).format(new Date(value))
    : "Not set";
}

export function nextStepForReturn(purchaseReturn: PurchaseReturn): string {
  if (purchaseReturn.status === "draft") {
    return "Review and post vendor credit";
  }

  if (purchaseReturn.status === "posted") {
    return purchaseReturn.openCreditAmount > 0 ? "Apply credit or reverse" : "Credit applied";
  }

  if (purchaseReturn.status === "reversed") {
    return "Reversed";
  }

  return "No action";
}

export function creditDisplayForReturn(purchaseReturn: PurchaseReturn): {
  helper: string | null;
  value: string;
} {
  if (purchaseReturn.status === "draft") {
    return {
      helper: "Open after posting",
      value: `Draft ${formatPurchaseReturnCurrency(purchaseReturn.returnTotal)}`,
    };
  }

  return {
    helper: null,
    value: formatPurchaseReturnCurrency(purchaseReturn.openCreditAmount),
  };
}

/**
 * Actions only. Viewing is the row's own click, so "View details" no longer
 * sits here; a reader with no rights sees no menu at all.
 */
export function PurchaseReturnActionsMenu({
  canCancel,
  canPost,
  canReverse,
  onCancel,
  onPost,
  onReverse,
  purchaseReturn,
}: Omit<PurchaseReturnsListProps, "onView" | "returns"> & {
  purchaseReturn: PurchaseReturn;
}): JSX.Element | null {
  if (!canPost && !canCancel && !canReverse) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={`Open actions for ${purchaseReturn.returnNumber}`}
          size="icon"
          type="button"
          variant="ghost"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canPost ? (
          <DropdownMenuItem
            disabled={purchaseReturn.status !== "draft"}
            onSelect={() => onPost(purchaseReturn)}
          >
            Post vendor credit
          </DropdownMenuItem>
        ) : null}
        {canCancel ? (
          <DropdownMenuItem
            disabled={purchaseReturn.status !== "draft"}
            onSelect={() => onCancel(purchaseReturn)}
          >
            Cancel draft
          </DropdownMenuItem>
        ) : null}
        {canReverse ? (
          <DropdownMenuItem
            disabled={purchaseReturn.status !== "posted"}
            onSelect={() => onReverse(purchaseReturn)}
          >
            Reverse vendor credit
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function PurchaseReturnsTable({
  canCancel,
  canPost,
  canReverse,
  onCancel,
  onPost,
  onReverse,
  onView,
  returns,
}: PurchaseReturnsListProps): JSX.Element {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Vendor credit</TableHead>
          <TableHead>Supplier</TableHead>
          <TableHead>Receipt</TableHead>
          <TableHead>Bill</TableHead>
          <TableHead>Return date</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead className="text-right">Open credit</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Next step</TableHead>
          <TableHead>
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {returns.map((purchaseReturn) => {
          const creditDisplay = creditDisplayForReturn(purchaseReturn);

          return (
            // The row opens the drawer; the number is also a button so the
            // keyboard has a focusable target for the same action.
            <TableRow
              className="cursor-pointer"
              key={purchaseReturn.id}
              onClick={() => onView(purchaseReturn)}
            >
              <TableCell>
                <button
                  className="rounded-sm font-mono font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  onClick={(event) => {
                    event.stopPropagation();
                    onView(purchaseReturn);
                  }}
                  type="button"
                >
                  {purchaseReturn.returnNumber}
                </button>
              </TableCell>
              <TableCell>{purchaseReturn.supplierName}</TableCell>
              {/* Cross-links stay links; they must not open the drawer. */}
              <TableCell onClick={(event) => event.stopPropagation()}>
                <Link
                  className="font-mono text-foreground-muted hover:text-foreground"
                  href={`${ROUTES.purchasingReceipts}/${purchaseReturn.purchaseReceiptId}`}
                >
                  {purchaseReturn.purchaseReceiptNumber}
                </Link>
              </TableCell>
              <TableCell className="font-mono">
                {purchaseReturn.purchaseInvoiceNumber ?? "—"}
              </TableCell>
              <TableCell className="tabular-nums">
                {formatPurchaseReturnDay(purchaseReturn.returnDate)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatPurchaseReturnCurrency(purchaseReturn.returnTotal)}
              </TableCell>
              <TableCell className="text-right">
                <span className="grid gap-0.5">
                  <span className="font-medium tabular-nums">{creditDisplay.value}</span>
                  {creditDisplay.helper ? (
                    <span className="text-meta text-foreground-muted">{creditDisplay.helper}</span>
                  ) : null}
                </span>
              </TableCell>
              <TableCell>
                <PurchaseReturnStatusBadge status={purchaseReturn.status} />
              </TableCell>
              <TableCell className="min-w-56 whitespace-normal text-foreground-muted">
                {nextStepForReturn(purchaseReturn)}
              </TableCell>
              {/* The menu must not also open the drawer. */}
              <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
                <PurchaseReturnActionsMenu
                  canCancel={canCancel}
                  canPost={canPost}
                  canReverse={canReverse}
                  onCancel={onCancel}
                  onPost={onPost}
                  onReverse={onReverse}
                  purchaseReturn={purchaseReturn}
                />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
