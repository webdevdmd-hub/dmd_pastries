"use client";

import type { JSX } from "react";

import { ReceiptLayoutActionsMenu } from "@/components/settings/receipt-layout-actions-menu";
import {
  formatReceiptDate,
  receiptFieldOptions,
  ReceiptLayoutStatusBadge,
  receiptScopeLabel,
  receiptTypeLabels,
} from "@/components/settings/receipt-layout-shared";
import type { ReceiptLayoutsListProps } from "@/components/settings/receipt-layouts-table";
import { Card } from "@/components/ui/card";

/** Receipt layouts as cards, for phones. */
export function ReceiptLayoutsCardGrid({
  layouts,
  onView,
  ...actions
}: ReceiptLayoutsListProps): JSX.Element {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {layouts.map((layout) => {
        const shownCount = receiptFieldOptions.filter(
          (option) => layout.layoutConfig[option.key],
        ).length;

        return (
          <Card
            className="cursor-pointer overflow-hidden transition-shadow duration-fast ease-out hover:shadow-sm"
            key={layout.id}
            onClick={() => onView(layout)}
          >
            <div className="flex items-start justify-between gap-3 border-b border-workspace-border px-4 py-3">
              <div className="grid min-w-0 gap-1.5">
                <button
                  className="truncate rounded-sm text-left font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  onClick={(event) => {
                    event.stopPropagation();
                    onView(layout);
                  }}
                  type="button"
                >
                  {layout.layoutName}
                </button>
                <ReceiptLayoutStatusBadge layout={layout} />
              </div>
              <div onClick={(event) => event.stopPropagation()}>
                <ReceiptLayoutActionsMenu {...actions} layout={layout} />
              </div>
            </div>

            <p className="px-4 py-3 text-cell text-foreground-muted">
              {receiptTypeLabels[layout.receiptType]} · {receiptScopeLabel(layout)}
            </p>

            <div className="grid grid-cols-2 border-t border-workspace-border bg-brand-latte/30">
              <div className="min-w-0 border-r border-workspace-border px-4 py-3">
                <p className="text-meta text-foreground-muted">Printer</p>
                <p className="mt-1 break-words text-cell font-medium">
                  {layout.printerType ?? "Any printer"}
                </p>
                <p className="text-meta text-foreground-muted">
                  {layout.counterId ?? "Any counter"}
                </p>
              </div>
              <div className="min-w-0 px-4 py-3">
                <p className="text-meta text-foreground-muted">Printed fields</p>
                <p className="mt-1 text-cell font-medium tabular-nums">
                  {shownCount} of {receiptFieldOptions.length}
                </p>
              </div>
            </div>

            <p className="border-t border-workspace-border px-4 py-2 text-meta tabular-nums text-foreground-muted">
              Updated {formatReceiptDate(layout.updatedAt)}
            </p>
          </Card>
        );
      })}
    </div>
  );
}
