"use client";

import { Pencil } from "lucide-react";
import Link from "next/link";
import type { JSX, ReactNode } from "react";
import { useState } from "react";

import {
  formatPaymentAccountMoney,
  PaymentAccountStatusBadge,
} from "@/components/accounting/payment-accounts-table";
import { type FormTab, FormTabs } from "@/components/shared/form-tabs";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ROUTES } from "@/constants/routes";
import { PAYMENT_ACCOUNT_TYPE_LABELS, type PaymentAccount } from "@/types/accounting";

type PaymentAccountDetailsDrawerProps = {
  account: PaymentAccount | null;
  canManage: boolean;
  /** Opens the edit form in the host's own modal flow. */
  onEdit?: ((account: PaymentAccount) => void) | undefined;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

type PaymentAccountDetailTabKey = "details" | "balance";

const TABPANEL_ID = "payment-account-detail-tabpanel";

function DetailRow({ label, value }: { label: string; value: ReactNode }): JSX.Element {
  return (
    <div className="grid gap-0.5 rounded-lg bg-muted px-3 py-2">
      <span className="text-meta text-foreground-muted">{label}</span>
      <span className="break-words text-cell font-medium tabular-nums">{value}</span>
    </div>
  );
}

function formatDateTime(value: string): string {
  return value ? new Date(value).toLocaleString("en-AE") : "—";
}

/**
 * One payment account in a sheet over the list. The row already carries the
 * whole record, so the sheet needs no fetch of its own.
 */
export function PaymentAccountDetailsDrawer({
  account,
  canManage,
  onEdit,
  onOpenChange,
  open,
}: PaymentAccountDetailsDrawerProps): JSX.Element {
  const fallbackTitle = (
    <SheetHeader className="sr-only">
      <SheetTitle>Payment account details</SheetTitle>
      <SheetDescription>Details of the selected payment account.</SheetDescription>
    </SheetHeader>
  );

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        {account ? (
          <PaymentAccountDetailsDrawerBody
            account={account}
            canManage={canManage}
            key={account.id}
            onEdit={onEdit}
          />
        ) : (
          fallbackTitle
        )}
      </SheetContent>
    </Sheet>
  );
}

function PaymentAccountDetailsDrawerBody({
  account,
  canManage,
  onEdit,
}: {
  account: PaymentAccount;
  canManage: boolean;
  onEdit: ((account: PaymentAccount) => void) | undefined;
}): JSX.Element {
  const [activeTab, setActiveTab] = useState<PaymentAccountDetailTabKey>("details");
  const tabs: FormTab<PaymentAccountDetailTabKey>[] = [
    { key: "details", label: "Details" },
    { key: "balance", label: "Balance" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <SheetHeader>
        <div className="flex flex-wrap items-center gap-3 pr-8">
          <SheetTitle className="text-page">{account.accountName}</SheetTitle>
          <PaymentAccountStatusBadge status={account.status} />
        </div>
        <SheetDescription>
          {PAYMENT_ACCOUNT_TYPE_LABELS[account.accountType]} ·{" "}
          {account.branchName || "Business-wide"}
        </SheetDescription>
        <p className="text-kpi tabular-nums">
          {formatPaymentAccountMoney(account.currentBalance)}{" "}
          <span className="text-cell text-foreground-muted">{account.balanceLabel}</span>
        </p>
        {canManage && onEdit ? (
          <div className="flex flex-wrap gap-2 pt-1">
            <Button onClick={() => onEdit(account)} size="sm" type="button" variant="outline">
              <Pencil className="h-4 w-4" />
              Edit account
            </Button>
          </div>
        ) : null}
      </SheetHeader>

      <FormTabs
        active={activeTab}
        aria-label="Payment account sections"
        onTabChange={setActiveTab}
        panelId={TABPANEL_ID}
        tabs={tabs}
      />

      <div id={TABPANEL_ID} role="tabpanel" tabIndex={-1}>
        {activeTab === "details" ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <DetailRow
              label="Account type"
              value={PAYMENT_ACCOUNT_TYPE_LABELS[account.accountType]}
            />
            <DetailRow label="Branch" value={account.branchName || "Business-wide"} />
            <div className="sm:col-span-2">
              <DetailRow
                label="Linked asset ledger"
                value={
                  <>
                    <span className="font-mono">{account.chartAccountCode}</span> ·{" "}
                    {account.chartAccountName}
                  </>
                }
              />
            </div>
            <DetailRow label="Status" value={account.status === "active" ? "Active" : "Inactive"} />
            <DetailRow
              label="Manual posting"
              value={account.chartAccountAllowManualPosting ? "Allowed" : "Not allowed"}
            />
            <div className="sm:col-span-2">
              <DetailRow label="Description" value={account.description || "No description"} />
            </div>
            <DetailRow label="Created" value={formatDateTime(account.createdAt)} />
            <DetailRow label="Updated" value={formatDateTime(account.updatedAt)} />
          </div>
        ) : null}

        {activeTab === "balance" ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <DetailRow
              label="Current balance"
              value={`${formatPaymentAccountMoney(account.currentBalance)} ${account.balanceLabel}`}
            />
            <DetailRow
              label="Opening balance"
              value={
                account.openingBalance !== 0
                  ? formatPaymentAccountMoney(account.openingBalance)
                  : "None entered"
              }
            />
            <DetailRow label="Opening balance as of" value={account.openingBalanceDate ?? "—"} />
            <DetailRow
              label="Opening journal"
              value={
                account.openingJournalEntryId ? (
                  <Link
                    className="font-mono hover:underline"
                    href={`${ROUTES.accountingJournalEntries}?search=${encodeURIComponent(account.openingJournalEntryId)}`}
                  >
                    View journal
                  </Link>
                ) : (
                  "—"
                )
              }
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
