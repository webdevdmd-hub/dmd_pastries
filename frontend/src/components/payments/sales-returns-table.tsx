import { ExternalLink, RotateCcw, Undo2 } from "lucide-react";
import Link from "next/link";
import type { JSX } from "react";

import { SalesReturnStatusBadge } from "@/components/payments/sales-return-status-badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { SalesReturn } from "@/types/sales-return";

type SalesReturnsTableProps = {
  canManage: boolean;
  isCancelling: boolean;
  isPosting: boolean;
  isReversing: boolean;
  onCancel: (salesReturn: SalesReturn) => void;
  onPost: (salesReturn: SalesReturn) => void;
  onReverse: (salesReturn: SalesReturn) => void;
  returns: SalesReturn[];
  canReverse: boolean;
};

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

function formatDate(value: string): string {
  return value ? new Date(value).toLocaleDateString("en-AE") : "Not recorded";
}

export function SalesReturnsTable({
  canManage,
  canReverse,
  isCancelling,
  isPosting,
  isReversing,
  onCancel,
  onPost,
  onReverse,
  returns,
}: SalesReturnsTableProps): JSX.Element {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Credit Note</TableHead>
          <TableHead>Sale</TableHead>
          <TableHead>Customer</TableHead>
          <TableHead>Return Date</TableHead>
          <TableHead>Refund</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {returns.map((salesReturn) => (
          <TableRow key={salesReturn.id}>
            <TableCell>
              <span className="block font-bold text-brand-espresso">
                {salesReturn.returnNumber}
              </span>
              <span className="text-xs text-brand-mocha">{salesReturn.reason ?? "No reason"}</span>
              {salesReturn.reversalReturnNumber ? (
                <span className="mt-1 block text-xs text-sky-800">
                  Reversal: {salesReturn.reversalReturnNumber}
                </span>
              ) : null}
            </TableCell>
            <TableCell>
              <span className="block font-semibold text-brand-espresso">
                {salesReturn.saleNumber}
              </span>
              <span className="text-xs text-brand-mocha">{salesReturn.branchName}</span>
            </TableCell>
            <TableCell>{salesReturn.customerName ?? "Walk-in customer"}</TableCell>
            <TableCell>{formatDate(salesReturn.returnDate)}</TableCell>
            <TableCell>
              <span className="block font-semibold text-brand-espresso">
                {salesReturn.refundMode === "refund"
                  ? formatMoney(salesReturn.refundAmount)
                  : "No refund"}
              </span>
              <span className="text-xs capitalize text-brand-mocha">{salesReturn.refundMode}</span>
            </TableCell>
            <TableCell>
              <SalesReturnStatusBadge status={salesReturn.status} />
            </TableCell>
            <TableCell>
              <div className="flex justify-end gap-2">
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
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
