"use client";

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

export type SupplierPaymentsListProps = {
  onDelete?: ((payment: SupplierPayment) => void) | undefined;
  onEdit?: ((payment: SupplierPayment) => void) | undefined;
  /** Opens the payment's details; when given, the whole row is the target. */
  onView?: ((payment: SupplierPayment) => void) | undefined;
  payments: SupplierPayment[];
  showSupplier?: boolean;
};

export function formatSupplierPaymentCurrency(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

export function formatSupplierPaymentDay(value: string): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-AE", { dateStyle: "medium" }).format(new Date(value));
}

export function SupplierPaymentStatusBadge({
  status,
}: {
  status: SupplierPaymentStatus;
}): JSX.Element {
  if (status === "completed") {
    return <Badge variant="money">Completed</Badge>;
  }

  return <Badge variant="outline">Voided</Badge>;
}

/** Actions only. Viewing is the row's own click. A voided payment has none. */
export function SupplierPaymentActionsMenu({
  onDelete,
  onEdit,
  payment,
}: {
  onDelete: ((payment: SupplierPayment) => void) | undefined;
  onEdit: ((payment: SupplierPayment) => void) | undefined;
  payment: SupplierPayment;
}): JSX.Element | null {
  if (payment.paymentStatus !== "completed" || (!onDelete && !onEdit)) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={`Open actions for payment to ${payment.supplierName}`}
          size="icon"
          type="button"
          variant="ghost"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {onEdit ? (
          <DropdownMenuItem onSelect={() => onEdit(payment)}>
            <Pencil className="h-4 w-4" />
            Edit
          </DropdownMenuItem>
        ) : null}
        {onDelete ? (
          <DropdownMenuItem
            className="text-danger-text focus:text-danger-text"
            onSelect={() => onDelete(payment)}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function PurchaseSupplierPaymentsTable({
  onDelete,
  onEdit,
  onView,
  payments,
  showSupplier = true,
}: SupplierPaymentsListProps): JSX.Element {
  const showActions = onDelete !== undefined || onEdit !== undefined;

  return (
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
          <TableHead>Paid by</TableHead>
          {showActions ? (
            <TableHead>
              <span className="sr-only">Actions</span>
            </TableHead>
          ) : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {payments.map((payment) => (
          <TableRow
            className={onView ? "cursor-pointer" : undefined}
            key={payment.id}
            onClick={onView ? () => onView(payment) : undefined}
          >
            {showSupplier ? (
              <TableCell>
                {onView ? (
                  // The row opens the drawer; the supplier is also a button
                  // so the keyboard has a focusable target.
                  <button
                    className="rounded-sm text-left font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    onClick={(event) => {
                      event.stopPropagation();
                      onView(payment);
                    }}
                    type="button"
                  >
                    {payment.supplierName}
                  </button>
                ) : (
                  payment.supplierName
                )}
              </TableCell>
            ) : null}
            <TableCell>{payment.branchName}</TableCell>
            <TableCell className="tabular-nums">
              {formatSupplierPaymentDay(payment.paymentDate)}
            </TableCell>
            <TableCell>
              <span className="grid gap-0.5">
                <span className="font-medium">{payment.paymentMethodName}</span>
                {payment.paymentMethodType ? (
                  <span className="text-meta text-foreground-muted">
                    {payment.paymentMethodType.replace("_", " ")}
                  </span>
                ) : null}
              </span>
            </TableCell>
            <TableCell>{payment.paidThroughAccountName ?? "—"}</TableCell>
            <TableCell className="text-right font-medium tabular-nums">
              {formatSupplierPaymentCurrency(payment.amount)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatSupplierPaymentCurrency(payment.allocatedAmount)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatSupplierPaymentCurrency(payment.unappliedAmount)}
            </TableCell>
            <TableCell>
              <SupplierPaymentStatusBadge status={payment.paymentStatus} />
            </TableCell>
            <TableCell className="font-mono">{payment.referenceNumber ?? "—"}</TableCell>
            <TableCell>{payment.paidByUserName}</TableCell>
            {showActions ? (
              // The menu must not also open the drawer.
              <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
                <SupplierPaymentActionsMenu onDelete={onDelete} onEdit={onEdit} payment={payment} />
              </TableCell>
            ) : null}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
