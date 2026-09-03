"use client";

import { LoaderCircle } from "lucide-react";
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { type FormTab, FormTabs } from "@/components/shared/form-tabs";
import type { SearchableComboboxOption } from "@/components/shared/searchable-combobox";
import { SearchableCombobox } from "@/components/shared/searchable-combobox";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { paymentAccountSchema } from "@/lib/validators/accounting.schema";
import {
  type ChartAccount,
  PAYMENT_ACCOUNT_TYPE_LABELS,
  type PaymentAccount,
  type PaymentAccountPayload,
  type PaymentAccountType,
} from "@/types/accounting";
import type { Branch } from "@/types/branch";

const noBranchValue = "__all__";

type PaymentAccountFormTabKey = "details" | "balance";

const FORM_TABPANEL_ID = "payment-account-form-tabpanel";

// Derived from the label map so it stays exhaustive by construction.
const paymentAccountTypes: { label: string; value: PaymentAccountType }[] = (
  Object.keys(PAYMENT_ACCOUNT_TYPE_LABELS) as PaymentAccountType[]
).map((value) => ({ label: PAYMENT_ACCOUNT_TYPE_LABELS[value], value }));

type PaymentAccountFormState = {
  accountName: string;
  accountType: PaymentAccountType;
  branchId: string;
  chartAccountId: string;
  description: string;
  status: "active" | "inactive";
  openingBalance: string;
  openingBalanceDate: string;
};

function emptyPaymentAccountForm(): PaymentAccountFormState {
  return {
    accountName: "",
    accountType: "cash",
    branchId: noBranchValue,
    chartAccountId: "",
    description: "",
    status: "active",
    openingBalance: "",
    openingBalanceDate: "",
  };
}

function paymentAccountToForm(account: PaymentAccount | null): PaymentAccountFormState {
  if (!account) return emptyPaymentAccountForm();

  return {
    accountName: account.accountName,
    accountType: account.accountType,
    branchId: account.branchId ?? noBranchValue,
    chartAccountId: account.chartAccountId,
    description: account.description,
    status: account.status,
    openingBalance: account.openingBalance === 0 ? "" : String(account.openingBalance),
    openingBalanceDate: account.openingBalanceDate ?? "",
  };
}

// Store-credit tenders ride the Customer Advance liability and are funded by
// credit grants, so the backend refuses an opening balance on them.
function supportsOpeningBalance(accountType: PaymentAccountType): boolean {
  return accountType !== "store_credit";
}

function toPaymentAccountPayload(form: PaymentAccountFormState): PaymentAccountPayload {
  const openingBalance = supportsOpeningBalance(form.accountType)
    ? Number(form.openingBalance.trim() || 0)
    : 0;

  return {
    accountName: form.accountName.trim(),
    accountType: form.accountType,
    branchId: form.branchId === noBranchValue ? null : form.branchId,
    chartAccountId: form.chartAccountId,
    description: form.description.trim(),
    status: form.status,
    openingBalance: Number.isFinite(openingBalance) ? openingBalance : 0,
    openingBalanceDate:
      openingBalance !== 0 && form.openingBalanceDate ? form.openingBalanceDate : null,
  };
}

function accountOptions(accounts: ChartAccount[]): SearchableComboboxOption[] {
  return accounts.map((account) => ({
    value: account.id,
    label: `${account.accountCode} - ${account.accountName}`,
    description: `${account.accountType.replace("_", " ")} / ${account.accountGroup.replaceAll("_", " ")}`,
    keywords: [account.accountCode, account.accountName, account.accountGroup, account.accountType],
    disabled: account.status !== "active",
  }));
}

function branchOptions(branches: Branch[]): SearchableComboboxOption[] {
  return branches.map((branch) => ({
    value: branch.id,
    label: branch.name,
    description: branch.code,
    keywords: [branch.name, branch.code],
  }));
}

/** The tab a validation issue belongs to, from the field it names. */
function tabForField(field: string | number | undefined): PaymentAccountFormTabKey {
  return field === "openingBalance" || field === "openingBalanceDate" ? "balance" : "details";
}

/**
 * Create or edit a payment account, in two tabs: what it is, and the money
 * already in it when the books start. One state holds every field, so
 * nothing typed on the other tab is lost. A failed check switches to the tab
 * holding the problem before the toast explains it.
 */
export function PaymentAccountDialog({
  account,
  branches,
  chartAccounts,
  onOpenChange,
  onSubmit,
  open,
  submitting,
}: {
  account: PaymentAccount | null;
  branches: Branch[];
  chartAccounts: ChartAccount[];
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: PaymentAccountPayload) => Promise<void>;
  open: boolean;
  submitting: boolean;
}): JSX.Element {
  const [form, setForm] = useState<PaymentAccountFormState>(emptyPaymentAccountForm);
  const [activeTab, setActiveTab] = useState<PaymentAccountFormTabKey>("details");
  const chartOptions = useMemo(() => accountOptions(chartAccounts), [chartAccounts]);
  const branchesOptions = useMemo(() => branchOptions(branches), [branches]);
  const canHoldOpeningBalance = supportsOpeningBalance(form.accountType);

  const update = (patch: Partial<PaymentAccountFormState>): void => {
    setForm((current) => ({ ...current, ...patch }));
  };

  const submit = async (): Promise<void> => {
    const payload = toPaymentAccountPayload(form);
    const parsed = paymentAccountSchema.safeParse(payload);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      setActiveTab(tabForField(issue?.path[0]));
      toast.error(issue?.message ?? "Payment account payload is invalid.");
      return;
    }

    await onSubmit(payload);
  };

  useEffect(() => {
    if (open) {
      setForm(paymentAccountToForm(account));
      // Every opening starts on Details, whichever tab the last one closed on.
      setActiveTab("details");
    }
  }, [account, open]);

  const tabs: FormTab<PaymentAccountFormTabKey>[] = [
    { key: "details", label: "Details" },
    { key: "balance", label: "Opening balance" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-6 pb-4 pt-6">
          <DialogTitle>{account ? "Edit payment account" : "Create payment account"}</DialogTitle>
          <DialogDescription>
            Link cash, bank, card clearing, and platform settlement accounts to active asset ledgers
            in Chart of Accounts.
          </DialogDescription>
        </DialogHeader>

        <div className="border-b border-border px-6 py-3">
          <FormTabs
            active={activeTab}
            aria-label="Payment account form sections"
            onTabChange={setActiveTab}
            panelId={FORM_TABPANEL_ID}
            tabs={tabs}
          />
        </div>

        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5"
          id={FORM_TABPANEL_ID}
          role="tabpanel"
          tabIndex={-1}
        >
          {activeTab === "details" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="payment-account-name">Account name</Label>
                <Input
                  id="payment-account-name"
                  value={form.accountName}
                  onChange={(event) => update({ accountName: event.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="payment-account-type">Account type</Label>
                <Select
                  value={form.accountType}
                  onValueChange={(accountType) =>
                    update({ accountType: accountType as PaymentAccountType })
                  }
                >
                  <SelectTrigger id="payment-account-type" aria-label="Account type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentAccountTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="payment-account-branch">Branch</Label>
                <SearchableCombobox
                  id="payment-account-branch"
                  emptyMessage="No branches found."
                  options={[
                    { value: noBranchValue, label: "Business-wide account" },
                    ...branchesOptions,
                  ]}
                  placeholder="Business-wide account"
                  searchPlaceholder="Search branch..."
                  value={form.branchId}
                  onValueChange={(branchId) => update({ branchId: branchId || noBranchValue })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="payment-account-status">Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(status) =>
                    update({ status: status as PaymentAccountFormState["status"] })
                  }
                >
                  <SelectTrigger id="payment-account-status" aria-label="Status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2 md:col-span-2">
                <Label htmlFor="payment-account-ledger">Linked asset ledger</Label>
                <SearchableCombobox
                  id="payment-account-ledger"
                  emptyMessage="No active Asset ledgers found. Create or activate an Asset account such as Cash, Bank, Petty Cash, Card Clearing, or Platform Settlement in Chart of Accounts."
                  options={chartOptions}
                  placeholder="Select active Asset ledger"
                  searchPlaceholder="Search asset code or ledger..."
                  value={form.chartAccountId}
                  onValueChange={(chartAccountId) => update({ chartAccountId })}
                />
                <p className="text-meta text-foreground-muted">
                  Only active Asset ledgers are shown because payment accounts hold money. Expense,
                  income, liability, and equity ledgers cannot be linked here.
                </p>
              </div>
              <div className="grid gap-2 md:col-span-2">
                <Label htmlFor="payment-account-description">Description</Label>
                <Input
                  id="payment-account-description"
                  value={form.description}
                  onChange={(event) => update({ description: event.target.value })}
                />
              </div>
            </div>
          ) : null}

          {activeTab === "balance" ? (
            canHoldOpeningBalance ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="payment-account-opening-balance">Opening balance</Label>
                  <Input
                    className="tabular-nums"
                    id="payment-account-opening-balance"
                    onChange={(event) => update({ openingBalance: event.target.value })}
                    placeholder="0.00"
                    step="0.01"
                    type="number"
                    value={form.openingBalance}
                  />
                  <p className="text-meta text-foreground-muted">
                    Money already in this account before the books start here. Posts against Opening
                    Balance Equity (3400).
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="payment-account-opening-balance-as-of">
                    Opening balance as of
                  </Label>
                  <Input
                    id="payment-account-opening-balance-as-of"
                    onChange={(event) => update({ openingBalanceDate: event.target.value })}
                    type="date"
                    value={form.openingBalanceDate}
                  />
                  <p className="text-meta text-foreground-muted">
                    Usually the financial-year start. Required when the opening balance is not zero.
                  </p>
                </div>
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-border p-4 text-cell text-foreground-muted">
                Store credit accounts are funded by credit grants and cannot carry an opening
                balance.
              </p>
            )
          ) : null}
        </div>

        <DialogFooter className="border-t border-border px-6 py-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={submitting} type="button" onClick={() => void submit()}>
            {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            {account ? "Save account" : "Create account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
