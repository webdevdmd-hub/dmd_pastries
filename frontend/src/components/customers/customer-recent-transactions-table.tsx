import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CustomerTransaction, CustomerTransactionSource } from "@/types/customer";

function currency(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

function formatDate(value: string): string {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-AE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function sourceLabel(sourceType: CustomerTransactionSource): string {
  switch (sourceType) {
    case "bakery_order":
      return "Bakery order";
    case "bakery_payment":
      return "Bakery payment";
    case "pos_payment":
      return "POS payment";
    case "refund":
      return "Refund";
    case "sale_refund":
      return "Sale refund";
    case "pos_sale":
      return "POS sale";
  }
}

function amount(transaction: CustomerTransaction): string {
  const sign =
    transaction.sourceType === "refund" || transaction.sourceType === "sale_refund" ? "-" : "";
  return `${sign}${currency(transaction.amount)}`;
}

export function CustomerRecentTransactionsTable({
  transactions,
}: {
  transactions: CustomerTransaction[];
}): JSX.Element {
  return (
    <Card className="bg-white/80">
      <CardHeader>
        <CardTitle>Recent Transactions</CardTitle>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <p className="text-sm text-brand-mocha">No customer transactions found.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((transaction) => (
                  <TableRow key={`${transaction.sourceType}-${transaction.id}`}>
                    <TableCell>{formatDate(transaction.occurredAt)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{sourceLabel(transaction.sourceType)}</Badge>
                    </TableCell>
                    <TableCell>{transaction.sourceNumber || "-"}</TableCell>
                    <TableCell>{transaction.description || "-"}</TableCell>
                    <TableCell>{transaction.status || transaction.paymentStatus || "-"}</TableCell>
                    <TableCell className="text-right font-medium">
                      {amount(transaction)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
