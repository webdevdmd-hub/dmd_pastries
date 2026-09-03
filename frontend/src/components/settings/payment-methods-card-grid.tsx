"use client";

import type { JSX } from "react";

import {
  paymentMethodAccountState,
  PaymentMethodActionsMenu,
  type PaymentMethodsListProps,
  PaymentMethodStatusBadge,
  PaymentMethodVisibilityBadges,
} from "@/components/settings/payment-methods-table";
import { Card } from "@/components/ui/card";
import { formatLabel } from "@/lib/format/label";

/**
 * Payment methods as cards, for phones: a nine-column table has no honest
 * layout below md. Clicking a card opens the details drawer; the kebab stops
 * the click so it does not also open the drawer.
 */
export function PaymentMethodsCardGrid({
  canManage,
  methods,
  onDeactivate,
  onEdit,
  onStatusChange,
  onView,
}: PaymentMethodsListProps): JSX.Element {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {methods.map((method) => {
        const account = paymentMethodAccountState(method);

        return (
          <Card
            className="cursor-pointer overflow-hidden transition-shadow duration-fast ease-out hover:shadow-sm"
            key={method.id}
            onClick={() => onView(method)}
          >
            <div className="flex items-start justify-between gap-3 border-b border-workspace-border px-4 py-3">
              <button
                className="grid min-w-0 gap-0.5 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                onClick={(event) => {
                  event.stopPropagation();
                  onView(method);
                }}
                type="button"
              >
                <span className="truncate font-medium">{method.methodName}</span>
                <span className="truncate text-meta text-foreground-muted">
                  {formatLabel(method.methodType)}
                  {method.isDefault ? " · Default" : ""}
                </span>
              </button>
              <div
                className="flex shrink-0 items-center gap-2"
                onClick={(event) => event.stopPropagation()}
              >
                <PaymentMethodStatusBadge status={method.status} />
                <PaymentMethodActionsMenu
                  canManage={canManage}
                  method={method}
                  onDeactivate={onDeactivate}
                  onEdit={onEdit}
                  onStatusChange={onStatusChange}
                />
              </div>
            </div>

            <div className="grid gap-2 px-4 py-3 text-cell">
              <PaymentMethodVisibilityBadges method={method} />
              <span
                className={
                  account.tone === "danger"
                    ? "text-danger-text"
                    : account.tone === "muted"
                      ? "text-foreground-muted"
                      : undefined
                }
              >
                {account.tone === "normal" ? `Account: ${account.label}` : account.label}
              </span>
            </div>

            <div className="grid grid-cols-2 border-t border-workspace-border bg-brand-latte/30">
              <div className="border-r border-workspace-border px-4 py-3">
                <p className="text-meta text-foreground-muted">Split payment</p>
                <p className="mt-1 text-cell font-medium">
                  {method.allowSplitPayment ? "Allowed" : "No"}
                </p>
              </div>
              <div className="px-4 py-3">
                <p className="text-meta text-foreground-muted">Reference</p>
                <p className="mt-1 text-cell font-medium">
                  {method.requiresReference ? "Required" : "Optional"}
                </p>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
