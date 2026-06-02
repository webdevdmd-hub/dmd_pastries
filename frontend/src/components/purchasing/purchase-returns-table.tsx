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

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

function formatDate(value: string | null): string {
  return value
    ? new Intl.DateTimeFormat("en-AE", { dateStyle: "medium" }).format(new Date(value))
    : "Not set";
}

function nextStepForReturn(purchaseReturn: PurchaseReturn): string {
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

export function PurchaseReturnsTable({
  canCancel,
  canPost,
  canReverse,
  onCancel,
  onPost,
  onReverse,
  returns,
}: {
  canCancel: boolean;
  canPost: boolean;
  canReverse: boolean;
  onCancel: (purchaseReturn: PurchaseReturn) => void;
  onPost: (purchaseReturn: PurchaseReturn) => void;
  onReverse: (purchaseReturn: PurchaseReturn) => void;
  returns: PurchaseReturn[];
}): JSX.Element {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Vendor Credit</TableHead>
          <TableHead>Supplier</TableHead>
          <TableHead>Receipt</TableHead>
          <TableHead>Invoice</TableHead>
          <TableHead>Return Date</TableHead>
          <TableHead>Total</TableHead>
          <TableHead>Open Credit</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Next Step</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {returns.map((purchaseReturn) => (
          <TableRow key={purchaseReturn.id}>
            <TableCell>
              <Link
                className="font-semibold text-brand-espresso"
                href={`${ROUTES.purchasingReturns}/${purchaseReturn.id}`}
              >
                {purchaseReturn.returnNumber}
              </Link>
            </TableCell>
            <TableCell>{purchaseReturn.supplierName}</TableCell>
            <TableCell>
              <Link
                className="text-brand-mocha hover:text-brand-espresso"
                href={`${ROUTES.purchasingReceipts}/${purchaseReturn.purchaseReceiptId}`}
              >
                {purchaseReturn.purchaseReceiptNumber}
              </Link>
            </TableCell>
            <TableCell>{purchaseReturn.purchaseInvoiceNumber}</TableCell>
            <TableCell>{formatDate(purchaseReturn.returnDate)}</TableCell>
            <TableCell>{formatCurrency(purchaseReturn.returnTotal)}</TableCell>
            <TableCell>{formatCurrency(purchaseReturn.openCreditAmount)}</TableCell>
            <TableCell>
              <PurchaseReturnStatusBadge status={purchaseReturn.status} />
            </TableCell>
            <TableCell>
              <span className="text-sm font-medium text-brand-mocha">
                {nextStepForReturn(purchaseReturn)}
              </span>
            </TableCell>
            <TableCell>
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
                  <DropdownMenuItem asChild>
                    <Link href={`${ROUTES.purchasingReturns}/${purchaseReturn.id}`}>
                      View details
                    </Link>
                  </DropdownMenuItem>
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
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
