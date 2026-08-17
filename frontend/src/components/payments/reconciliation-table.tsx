import type { JSX } from "react";

import { PaymentMethodBadge } from "@/components/payments/payment-method-badge";
import { PaymentStatusBadge } from "@/components/payments/payment-status-badge";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PaymentReconciliation } from "@/types/payment";

type ReconciliationTableProps = {
  reconciliations: PaymentReconciliation[];
};

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

function formatDate(value: string): string {
  return value ? new Date(value).toLocaleDateString("en-AE") : "Not set";
}

function differenceLabel(value: number): string {
  if (value === 0) return "Balanced";
  if (value > 0) return "Surplus";

  return "Shortage";
}

export function ReconciliationTable({ reconciliations }: ReconciliationTableProps): JSX.Element {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Branch</TableHead>
          <TableHead>Payment Method</TableHead>
          <TableHead>Expected</TableHead>
          <TableHead>Counted</TableHead>
          <TableHead>Difference</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Created By</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {reconciliations.map((reconciliation) => (
          <TableRow key={reconciliation.id}>
            <TableCell className="font-bold">
              {formatDate(reconciliation.reconciliationDate)}
            </TableCell>
            <TableCell>{reconciliation.branchName}</TableCell>
            <TableCell>
              <PaymentMethodBadge methodName={reconciliation.paymentMethodName} />
            </TableCell>
            <TableCell>{formatMoney(reconciliation.expectedAmount)}</TableCell>
            <TableCell>{formatMoney(reconciliation.countedAmount)}</TableCell>
            <TableCell>
              <div className="flex flex-col gap-1">
                <span className="font-medium">{formatMoney(reconciliation.differenceAmount)}</span>
                <Badge
                  className={
                    reconciliation.differenceAmount === 0
                      ? "border-money/30 bg-money-tint text-money-text"
                      : reconciliation.differenceAmount > 0
                        ? "border-warning/30 bg-warning-tint text-warning-text"
                        : "border-danger/30 bg-danger-tint text-danger-text"
                  }
                  variant="outline"
                >
                  {differenceLabel(reconciliation.differenceAmount)}
                </Badge>
              </div>
            </TableCell>
            <TableCell>
              <PaymentStatusBadge status={reconciliation.status} />
            </TableCell>
            <TableCell>{reconciliation.createdByUserName}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
