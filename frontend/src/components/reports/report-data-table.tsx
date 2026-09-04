"use client";

import type { JSX, ReactNode } from "react";

import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils/cn";

export type ReportColumn<Row> = {
  align?: "right" | undefined;
  cell: (row: Row) => ReactNode;
  header: ReactNode;
  key: string;
  /**
   * The card's heading. Exactly one column should carry this; it is the thing
   * you would read first if the row had only one line.
   */
  primary?: boolean | undefined;
  /** Sits under the heading on a card, muted. Typically a code or a branch. */
  secondary?: boolean | undefined;
  /** A badge or similar that reads without a label on a card. */
  unlabelledOnCard?: boolean | undefined;
};

/**
 * A card subtitle is worth a line only if it says something. A missing SKU or
 * reference formats as "-" in a table column, where the header explains it;
 * under a card's heading the same dash is just a stray mark.
 */
function hasSubtitle(value: ReactNode): boolean {
  if (typeof value !== "string") {
    return true;
  }

  const text = value.replaceAll("-", " ").trim();

  return text.length > 0;
}

/**
 * A report table that survives a phone.
 *
 * Report tables run to ten columns. Inside the shared Table wrapper they get
 * `overflow-auto`, so on a 375px screen the current-stock report rendered 910px
 * of table in a 302px window: you could read Item and Branch, and every number
 * the report exists for sat off-screen behind a horizontal scroll.
 *
 * From md this is the same table as before. Below it, each row becomes a card
 * whose cells are labelled with their own column headers, so nothing is hidden
 * and nothing needs scrolling sideways.
 */
export function ReportDataTable<Row>({
  columns,
  frameClassName,
  headerClassName,
  rowKey,
  rows,
}: {
  columns: ReportColumn<Row>[];
  /** Framing for the desktop table only; the cards below md have their own. */
  frameClassName?: string | undefined;
  headerClassName?: string | undefined;
  rowKey: (row: Row, index: number) => string;
  rows: Row[];
}): JSX.Element {
  const primary = columns.find((column) => column.primary);
  const secondary = columns.find((column) => column.secondary);
  const rest = columns.filter((column) => !column.primary && !column.secondary);

  return (
    <>
      <div className={cn("hidden md:block", frameClassName)}>
        <Table>
          <TableHeader className={headerClassName}>
            <TableRow>
              {columns.map((column) => (
                <TableHead
                  className={column.align === "right" ? "text-right" : undefined}
                  key={column.key}
                >
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => (
              <TableRow key={rowKey(row, index)}>
                {columns.map((column) => (
                  <TableCell
                    className={column.align === "right" ? "text-right" : undefined}
                    key={column.key}
                  >
                    {column.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="grid gap-3 p-4 md:hidden">
        {rows.map((row, index) => (
          <Card className="overflow-hidden" key={rowKey(row, index)}>
            {primary ? (
              <div className="grid gap-0.5 border-b border-workspace-border px-4 py-3">
                <div className="text-cell font-medium">{primary.cell(row)}</div>
                {secondary && hasSubtitle(secondary.cell(row)) ? (
                  <div className="text-meta text-foreground-muted">{secondary.cell(row)}</div>
                ) : null}
              </div>
            ) : null}

            <dl className="grid gap-2 px-4 py-3">
              {rest.map((column) => (
                <div className="flex items-baseline justify-between gap-4" key={column.key}>
                  {/* Every cell keeps its own column header as its label, so a
                      card says what a number is without the header row. */}
                  <dt className="shrink-0 text-meta text-foreground-muted">
                    {column.unlabelledOnCard ? null : column.header}
                  </dt>
                  <dd className="min-w-0 break-words text-right text-cell">{column.cell(row)}</dd>
                </div>
              ))}
            </dl>
          </Card>
        ))}
      </div>
    </>
  );
}
