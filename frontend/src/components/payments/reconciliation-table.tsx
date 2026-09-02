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
          <TableHead className="whitespace-nowrap">Date</TableHead>
          <TableHead className="whitespace-nowrap">Branch</TableHead>
          <TableHead className="whitespace-nowrap">Payment Method</TableHead>
          <TableHead className="whitespace-nowrap text-right">Expected</TableHead>
          <TableHead className="whitespace-nowrap text-right">Counted</TableHead>
          <TableHead className="whitespace-nowrap">Difference</TableHead>
          <TableHead className="whitespace-nowrap">Status</TableHead>
          <TableHead className="whitespace-nowrap">Created By</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {reconciliations.map((reconciliation) => (
          <TableRow key={reconciliation.id}>
            <TableCell className="whitespace-nowrap font-bold">
              {formatDate(reconciliation.reconciliationDate)}
            </TableCell>
            <TableCell className="whitespace-nowrap">{reconciliation.branchName}</TableCell>
            <TableCell className="whitespace-nowrap">
              <PaymentMethodBadge methodName={reconciliation.paymentMethodName} />
            </TableCell>
            <TableCell className="whitespace-nowrap text-right tabular-nums">
              {formatMoney(reconciliation.expectedAmount)}
            </TableCell>
            <TableCell className="whitespace-nowrap text-right tabular-nums">
              {formatMoney(reconciliation.countedAmount)}
            </TableCell>
            <TableCell className="whitespace-nowrap text-right">
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
            <TableCell className="whitespace-nowrap">
              <PaymentStatusBadge status={reconciliation.status} />
            </TableCell>
            <TableCell className="whitespace-nowrap">{reconciliation.createdByUserName}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
