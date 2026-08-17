import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";
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
import type { SupplierPayment, SupplierPaymentStatus } from "@/types/purchasing";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

function formatDate(value: string): string {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-AE", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function statusBadge(status: SupplierPaymentStatus): JSX.Element {
  if (status === "completed") {
    return <Badge className="border-money/30 bg-money-tint text-money-text">Completed</Badge>;
  }

  return <Badge className="border-border bg-muted text-foreground-muted">Voided</Badge>;
}

export function PurchaseSupplierPaymentsTable({
  onDelete,
  onEdit,
  payments,
  showSupplier = true,
}: {
  onDelete?: (payment: SupplierPayment) => void;
  onEdit?: (payment: SupplierPayment) => void;
  payments: SupplierPayment[];
  showSupplier?: boolean;
}): JSX.Element {
  const showActions = onDelete !== undefined || onEdit !== undefined;

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {showSupplier ? <TableHead>Supplier</TableHead> : null}
            <TableHead>Branch</TableHead>
            <TableHead>Payment date</TableHead>
            <TableHead>Method</TableHead>
            <TableHead>Paid through</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="text-right">Allocated</TableHead>
            <TableHead className="text-right">Advance</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Reference</TableHead>
            <TableHead>Paid By</TableHead>
            {showActions ? <TableHead className="text-right">Actions</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.map((payment) => (
            <TableRow key={payment.id}>
              {showSupplier ? <TableCell>{payment.supplierName}</TableCell> : null}
              <TableCell>{payment.branchName}</TableCell>
              <TableCell>{formatDate(payment.paymentDate)}</TableCell>
              <TableCell>
                <span className="font-medium text-brand-espresso">{payment.paymentMethodName}</span>
                {payment.paymentMethodType ? (
                  <span className="block text-xs text-brand-mocha">
                    {payment.paymentMethodType.replace("_", " ")}
                  </span>
                ) : null}
              </TableCell>
              <TableCell>{payment.paidThroughAccountName ?? "-"}</TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {formatCurrency(payment.amount)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCurrency(payment.allocatedAmount)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCurrency(payment.unappliedAmount)}
              </TableCell>
              <TableCell>{statusBadge(payment.paymentStatus)}</TableCell>
              <TableCell>{payment.referenceNumber ?? "-"}</TableCell>
              <TableCell>{payment.paidByUserName}</TableCell>
              {showActions ? (
                <TableCell className="text-right">
                  {payment.paymentStatus === "completed" ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          aria-label="Payment actions"
                          size="icon"
                          type="button"
                          variant="ghost"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {onEdit ? (
                          <DropdownMenuItem onClick={() => onEdit(payment)}>
                            <Pencil className="h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                        ) : null}
                        {onDelete ? (
                          <DropdownMenuItem
                            className="text-danger-text focus:text-danger-text"
                            onClick={() => onDelete(payment)}
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <span className="text-sm text-brand-mocha">-</span>
                  )}
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
