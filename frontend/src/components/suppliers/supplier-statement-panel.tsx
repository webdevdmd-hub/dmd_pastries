"use client";

import type { JSX } from "react";

import {
  formatCurrency,
  formatDate,
  formatStatementBalance,
  PanelEmpty,
  PanelError,
  PanelSkeleton,
  statementDisplayRows,
} from "@/components/suppliers/supplier-purchasing-shared";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSupplierStatement } from "@/hooks/use-suppliers";
import { getErrorMessage } from "@/lib/api/client";

/**
 * The running supplier balance.
 *
 * Reflowed from seven columns to five. At a 1030px window the seven-column
 * table needed 768px inside a 619px container, which pushed Status entirely
 * out of view and clipped Balance -- the running balance being the one number
 * a statement exists to show. Date and Type now share the first cell with the
 * document number, which buys back the width without hiding anything.
 *
 * The four summary figures were 10.88px `font-bold`; both are outside the type
 * system (12px floor, weight 600 ceiling).
 */
export function SupplierStatementPanel({
  canView,
  supplierId,
}: {
  canView: boolean;
  supplierId: string;
}): JSX.Element {
  const statementQuery = useSupplierStatement(supplierId, {}, canView);

  if (statementQuery.isLoading) {
    return <PanelSkeleton />;
  }

  if (statementQuery.error) {
    return (
      <PanelError
        message={getErrorMessage(statementQuery.error)}
        noun="the statement"
        onRetry={() => {
          void statementQuery.refetch();
        }}
      />
    );
  }

  const statement = statementQuery.data;
  const rows = statementDisplayRows(statement?.items ?? []);

  const totals = [
    { label: "Opening balance", value: formatStatementBalance(statement?.openingBalance ?? 0) },
    { label: "Total debit", value: formatCurrency(statement?.totalDebit ?? 0) },
    { label: "Total credit", value: formatCurrency(statement?.totalCredit ?? 0) },
    { label: "Closing balance", value: formatStatementBalance(statement?.closingBalance ?? 0) },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {totals.map((total) => (
          <div className="rounded-xl bg-muted p-4" key={total.label}>
            <p className="text-meta text-foreground-muted">{total.label}</p>
            <p className="mt-1.5 text-title tabular-nums">{total.value}</p>
          </div>
        ))}
      </div>

      {rows.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entry</TableHead>
                <TableHead className="text-right">Debit</TableHead>
                <TableHead className="text-right">Credit</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.key}>
                  <TableCell>
                    <div className="grid gap-1">
                      <span>
                        {row.type}{" "}
                        <span className="font-mono text-foreground-muted">
                          {row.documentNumber}
                        </span>
                      </span>
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-meta tabular-nums text-foreground-muted">
                          {formatDate(row.date)}
                        </span>
                        {row.status}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right tabular-nums">
                    {row.debit > 0 ? (
                      formatCurrency(row.debit)
                    ) : (
                      <span className="text-foreground-muted">&mdash;</span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right tabular-nums">
                    {row.credit > 0 ? (
                      formatCurrency(row.credit)
                    ) : (
                      <span className="text-foreground-muted">&mdash;</span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right font-medium tabular-nums">
                    {formatCurrency(row.runningBalance)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="border-t border-border bg-muted hover:bg-muted">
                <TableCell className="font-medium">Statement total</TableCell>
                <TableCell className="whitespace-nowrap text-right font-medium tabular-nums">
                  {formatCurrency(statement?.totalDebit ?? 0)}
                </TableCell>
                <TableCell className="whitespace-nowrap text-right font-medium tabular-nums">
                  {formatCurrency(statement?.totalCredit ?? 0)}
                </TableCell>
                <TableCell className="whitespace-nowrap text-right font-medium tabular-nums">
                  {formatStatementBalance(statement?.closingBalance ?? 0)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      ) : (
        <PanelEmpty
          description="Bills, payments made and vendor credits post here as they happen, each carrying the running balance."
          title="No statement activity yet"
        />
      )}
    </div>
  );
}
