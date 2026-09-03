"use client";

import type { JSX } from "react";

import {
  formatPaymentAccountMoney,
  PaymentAccountActionsMenu,
  type PaymentAccountsListProps,
  PaymentAccountStatusBadge,
} from "@/components/accounting/payment-accounts-table";
import { Card } from "@/components/ui/card";
import { PAYMENT_ACCOUNT_TYPE_LABELS } from "@/types/accounting";

/**
 * Payment accounts as cards, for phones. Clicking a card opens the details
 * drawer; the kebab stops the click so it does not also open the drawer.
 */
export function PaymentAccountsCardGrid({
  accounts,
  canManage,
  onDelete,
  onEdit,
  onStatusChange,
  onView,
}: PaymentAccountsListProps): JSX.Element {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {accounts.map((account) => (
        <Card
          className="cursor-pointer overflow-hidden transition-shadow duration-fast ease-out hover:shadow-sm"
          key={account.id}
          onClick={() => onView(account)}
        >
          <div className="flex items-start justify-between gap-3 border-b border-workspace-border px-4 py-3">
            <button
              className="grid min-w-0 gap-0.5 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              onClick={(event) => {
                event.stopPropagation();
                onView(account);
              }}
              type="button"
            >
              <span className="truncate font-medium">{account.accountName}</span>
              <span className="truncate text-meta text-foreground-muted">
                {PAYMENT_ACCOUNT_TYPE_LABELS[account.accountType]} ·{" "}
                {account.branchName || "Business-wide"}
              </span>
            </button>
            <div
              className="flex shrink-0 items-center gap-2"
              onClick={(event) => event.stopPropagation()}
            >
              <PaymentAccountStatusBadge status={account.status} />
              <PaymentAccountActionsMenu
                account={account}
                canManage={canManage}
                onDelete={onDelete}
                onEdit={onEdit}
                onStatusChange={onStatusChange}
              />
            </div>
          </div>

          <div className="px-4 py-3 text-cell">
            <span className="font-mono">{account.chartAccountCode}</span> ·{" "}
            {account.chartAccountName}
          </div>

          <div className="grid grid-cols-2 border-t border-workspace-border bg-brand-latte/30">
            <div className="min-w-0 border-r border-workspace-border px-4 py-3">
              <p className="text-meta text-foreground-muted">Balance</p>
              <p className="mt-1 break-words text-cell font-medium tabular-nums">
                {formatPaymentAccountMoney(account.currentBalance)} {account.balanceLabel}
              </p>
            </div>
            <div className="min-w-0 px-4 py-3">
              <p className="text-meta text-foreground-muted">Opening</p>
              <p className="mt-1 break-words text-cell font-medium tabular-nums">
                {account.openingBalance !== 0
                  ? formatPaymentAccountMoney(account.openingBalance)
                  : "—"}
              </p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
