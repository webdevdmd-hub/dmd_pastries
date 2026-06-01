import Link from "next/link";
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
import { ROUTES } from "@/constants/routes";
import type { SupplierPayment, SupplierPaymentStatus } from "@/types/purchasing";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

function formatDate(value: string): string {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-AE", {
    dateStyle: "medium",
    timeStyle: "short",
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
            <TableHead>Invoice</TableHead>
            {showSupplier ? <TableHead>Supplier</TableHead> : null}
            <TableHead>Branch</TableHead>
            <TableHead>Method</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Reference</TableHead>
            <TableHead>Paid By</TableHead>
            <TableHead>Paid At</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.map((payment) => (
            <TableRow key={payment.id}>
              <TableCell className="font-semibold">
                <Link
                  className="text-brand-espresso underline-offset-4 hover:underline"
                  href={`${ROUTES.purchasingInvoices}/${payment.purchaseInvoiceId}`}
                >
                  {payment.invoiceNumber}
                </Link>
              </TableCell>
              {showSupplier ? <TableCell>{payment.supplierName}</TableCell> : null}
              <TableCell>{payment.branchName}</TableCell>
              <TableCell>
                <span className="font-medium text-brand-espresso">{payment.paymentMethodName}</span>
                {payment.paymentMethodType ? (
                  <span className="block text-xs text-brand-mocha">
                    {payment.paymentMethodType.replace("_", " ")}
                  </span>
                ) : null}
              </TableCell>
              <TableCell className="font-semibold">{formatCurrency(payment.amount)}</TableCell>
              <TableCell>{statusBadge(payment.paymentStatus)}</TableCell>
              <TableCell>{payment.referenceNumber ?? "-"}</TableCell>
              <TableCell>{payment.paidByUserName}</TableCell>
              <TableCell>{formatDate(payment.paidAt)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
