import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";
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
    return <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800">Completed</Badge>;
  }

  if (status === "failed") {
    return <Badge className="border-red-200 bg-red-50 text-red-800">Failed</Badge>;
  }

  return <Badge className="border-amber-200 bg-amber-50 text-amber-800">Pending</Badge>;
}

export function PurchaseSupplierPaymentsTable({
  payments,
  showSupplier = true,
}: {
  payments: SupplierPayment[];
  showSupplier?: boolean;
}): JSX.Element {
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
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
