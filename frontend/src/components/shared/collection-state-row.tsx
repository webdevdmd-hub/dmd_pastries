"use client";

import type { JSX, ReactNode } from "react";

import { TableCell, TableRow } from "@/components/ui/table";

/**
 * The E1 trio, rendered inside a `<TableBody>`.
 *
 * This is the component whose absence caused the problem. `EmptyState`,
 * `FilteredState` and `FailedState` are block elements, and a table body only
 * accepts rows — so every table in the app that wanted a zero-row state either
 * hand-rolled `<TableRow><TableCell colSpan={n}>` with its own markup and copy,
 * or gave up and rendered a header with nothing beneath it. Both happened.
 *
 * `colSpan` must match the header's column count, or the state renders inside
 * column one and the table keeps its remaining columns open beside it.
 *
 * `hover:bg-transparent` because a state is not a row: the row hover tint reads
 * as "this is selectable" on something there is nothing to select in.
 */
export function CollectionStateRow({
  children,
  colSpan,
}: {
  children: ReactNode;
  colSpan: number;
}): JSX.Element {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell className="p-3" colSpan={colSpan}>
        {children}
      </TableCell>
    </TableRow>
  );
}
