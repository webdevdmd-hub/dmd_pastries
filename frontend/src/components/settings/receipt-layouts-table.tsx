"use client";

import type { JSX } from "react";

import {
  type ReceiptLayoutActionHandlers,
  ReceiptLayoutActionsMenu,
} from "@/components/settings/receipt-layout-actions-menu";
import {
  formatReceiptDate,
  ReceiptLayoutStatusBadge,
  receiptScopeLabel,
  receiptTypeLabels,
} from "@/components/settings/receipt-layout-shared";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ReceiptLayout } from "@/types/settings";

export type ReceiptLayoutsListProps = ReceiptLayoutActionHandlers & {
  layouts: ReceiptLayout[];
  /** Opens the layout's details; the whole row is the target. */
  onView: (layout: ReceiptLayout) => void;
};

/**
 * Seven columns became five, so the card no longer needs overflow-x-auto.
 * Receipt type rides under the layout name, and printer and counter share one
 * cell -- they were already stacked inside a single column.
 */
export function ReceiptLayoutsTable({
  layouts,
  onView,
  ...actions
}: ReceiptLayoutsListProps): JSX.Element {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Layout</TableHead>
          <TableHead>Applies to</TableHead>
          <TableHead>Printer / counter</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Updated</TableHead>
          <TableHead>
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {layouts.map((layout) => (
          // The row opens the drawer; the name is also a button so the keyboard
          // has a focusable target for the same action.
          <TableRow className="cursor-pointer" key={layout.id} onClick={() => onView(layout)}>
            <TableCell>
              <button
                className="grid gap-0.5 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                onClick={(event) => {
                  event.stopPropagation();
                  onView(layout);
                }}
                type="button"
              >
                <span className="font-medium">{layout.layoutName}</span>
                <span className="text-meta text-foreground-muted">
                  {receiptTypeLabels[layout.receiptType]}
                </span>
              </button>
            </TableCell>
            <TableCell>{receiptScopeLabel(layout)}</TableCell>
            <TableCell>
              <div className="grid gap-0.5">
                <span>{layout.printerType ?? "Any printer"}</span>
                <span className="text-meta text-foreground-muted">
                  {layout.counterId ?? "Any counter"}
                </span>
              </div>
            </TableCell>
            <TableCell>
              <ReceiptLayoutStatusBadge layout={layout} />
            </TableCell>
            <TableCell className="tabular-nums text-foreground-muted">
              {formatReceiptDate(layout.updatedAt)}
            </TableCell>
            {/* The menu must not also open the drawer. */}
            <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
              <ReceiptLayoutActionsMenu {...actions} layout={layout} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
