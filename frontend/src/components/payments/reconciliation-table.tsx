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

function differenceTone(value: number): "money" | "warning" | "danger" {
  if (value === 0) return "money";
  if (value > 0) return "warning";

  return "danger";
}

export function ReconciliationTable({ reconciliations }: ReconciliationTableProps): JSX.Element {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Branch</TableHead>
          <TableHead>Payment Method</TableHead>
          <TableHead className="text-right">Expected</TableHead>
          <TableHead className="text-right">Counted</TableHead>
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
            <TableCell className="text-right tabular-nums">
              {formatMoney(reconciliation.expectedAmount)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatMoney(reconciliation.countedAmount)}
            </TableCell>
            <TableCell className="text-right">
              <div className="flex flex-col items-end gap-1">
                <span className="font-medium tabular-nums">
                  {formatMoney(reconciliation.differenceAmount)}
                </span>
                {/* Balanced is the money accent; over needs a look; short is a
                    real problem. The semantic variants carry the dot, so the
                    verdict survives colour-blindness. */}
                <Badge variant={differenceTone(reconciliation.differenceAmount)}>
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
