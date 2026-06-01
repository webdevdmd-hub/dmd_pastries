"use client";

import type { JSX } from "react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  chartAccountCreateSchema,
  chartAccountUpdateSchema,
} from "@/lib/validators/accounting.schema";
import type {
  AccountingAccountType,
  AccountingNormalBalance,
  ChartAccount,
  CreateChartAccountPayload,
  UpdateChartAccountPayload,
} from "@/types/accounting";

const noParentValue = "__none__";

const accountTypes: { label: string; value: AccountingAccountType }[] = [
  { label: "Asset", value: "asset" },
  { label: "Liability", value: "liability" },
  { label: "Equity", value: "equity" },
  { label: "Income", value: "income" },
  { label: "Cost of Goods Sold", value: "cogs" },
  { label: "Expense", value: "expense" },
];

const accountGroupsByType: Record<
  AccountingAccountType,
  readonly { label: string; value: string }[]
> = {
  asset: [
    { label: "Current Asset", value: "current_asset" },
    { label: "Other Current Asset", value: "other_current_asset" },
    { label: "Fixed Asset", value: "fixed_asset" },
    { label: "Non Current Asset", value: "non_current_asset" },
    { label: "Accumulated Depreciation", value: "accumulated_depreciation" },
    { label: "Contra Asset", value: "contra_asset" },
  ],
  cogs: [
    { label: "Direct Expense", value: "direct_expense" },
    { label: "Operating Expense", value: "operating_expense" },
  ],
  equity: [
    { label: "Equity", value: "equity" },
    { label: "Partner Capital", value: "partner_capital" },
  ],
  expense: [
    { label: "Direct Expense", value: "direct_expense" },
    { label: "Operating Expense", value: "operating_expense" },
    { label: "Admin Expense", value: "admin_expense" },
    { label: "Selling Expense", value: "selling_expense" },
    { label: "Finance Cost", value: "finance_cost" },
    { label: "Tax Expense", value: "tax_expense" },
  ],
  income: [
    { label: "Sales Income", value: "sales_income" },
    { label: "Service Income", value: "service_income" },
    { label: "Discount Income", value: "discount_income" },
    { label: "Other Income", value: "other_income" },
  ],
  liability: [
    { label: "Current Liability", value: "current_liability" },
    { label: "Other Current Liability", value: "other_current_liability" },
    { label: "Long Term Liability", value: "long_term_liability" },
    { label: "Other Liability", value: "other_liability" },
  ],
};

type FormState = CreateChartAccountPayload;

function getNormalBalanceForAccountType(
  accountType: AccountingAccountType,
): AccountingNormalBalance {
  return accountType === "asset" || accountType === "cogs" || accountType === "expense"
    ? "debit"
    : "credit";
}

function formatNormalBalanceLabel(normalBalance: AccountingNormalBalance): string {
  return normalBalance === "debit" ? "Debit" : "Credit";
}

function formatAccountGroupLabel(value: string): string {
  return value
    .split("_")
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

function emptyFormState(): FormState {
  return {
    accountCode: "",
    accountGroup: "",
    accountName: "",
    accountType: "expense",
    allowManualPosting: true,
    description: "",
    isControlAccount: false,
    parentAccountId: null,
  };
}

function formStateFromAccount(account: ChartAccount | null): FormState {
  if (!account) {
    return emptyFormState();
  }

  return {
    accountCode: account.accountCode,
    accountGroup: account.accountGroup,
    accountName: account.accountName,
    accountType: account.accountType,
    allowManualPosting: account.allowManualPosting,
    description: account.description,
    isControlAccount: account.isControlAccount,
    parentAccountId: account.parentAccountId,
  };
}

export function ChartAccountFormDialog({
  account,
  accounts,
  isSubmitting,
  onClose,
  onCreate,
  onUpdate,
  open,
}: {
  account: ChartAccount | null;
  accounts: ChartAccount[];
  isSubmitting: boolean;
  onClose: () => void;
  onCreate: (payload: CreateChartAccountPayload) => Promise<void>;
  onUpdate: (id: string, payload: UpdateChartAccountPayload) => Promise<void>;
  open: boolean;
}): JSX.Element {
  const [formState, setFormState] = useState<FormState>(emptyFormState());
  const [error, setError] = useState<string | null>(null);
  const isEditing = account !== null;
  const parentOptions = accounts.filter((option) => option.id !== account?.id);
  const defaultAccountGroupOptions = accountGroupsByType[formState.accountType];
  const displayNormalBalance =
    account?.normalBalance ?? getNormalBalanceForAccountType(formState.accountType);
  const accountGroupOptions =
    formState.accountGroup !== "" &&
    !defaultAccountGroupOptions.some((option) => option.value === formState.accountGroup)
      ? [
          {
            label: formatAccountGroupLabel(formState.accountGroup),
            value: formState.accountGroup,
          },
          ...defaultAccountGroupOptions,
        ]
      : defaultAccountGroupOptions;

  useEffect(() => {
    if (open) {
      setFormState(formStateFromAccount(account));
      setError(null);
    }
  }, [account, open]);

  const updateForm = (patch: Partial<FormState>): void => {
    setFormState((current) => ({ ...current, ...patch }));
  };

  const submitForm = async (): Promise<void> => {
    if (account) {
      const updateResult = chartAccountUpdateSchema.safeParse(formState);

      if (!updateResult.success) {
        setError(updateResult.error.issues[0]?.message ?? "Please check the account form.");
        return;
      }

      setError(null);
      await onUpdate(account.id, updateResult.data);
      return;
    }

    const createResult = chartAccountCreateSchema.safeParse(formState);

    if (!createResult.success) {
      setError(createResult.error.issues[0]?.message ?? "Please check the account form.");
      return;
    }

    setError(null);
    await onCreate(createResult.data);
  };

  return (
    <Dialog onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)} open={open}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit account" : "Create account"}</DialogTitle>
          <DialogDescription>
            Manage business-level Chart of Accounts. Branch accounting will be handled through
            future journal entries.
          </DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submitForm();
          }}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="accountCode">Account code</Label>
              <Input
                disabled={isEditing}
                id="accountCode"
                onChange={(event) => updateForm({ accountCode: event.target.value })}
                value={formState.accountCode}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="accountName">Account name</Label>
              <Input
                id="accountName"
                onChange={(event) => updateForm({ accountName: event.target.value })}
                value={formState.accountName}
              />
            </div>
            <div className="grid gap-2">
              <Label>Account type</Label>
              <Select
                disabled={isEditing}
                onValueChange={(accountType: AccountingAccountType) => {
                  const nextGroups = accountGroupsByType[accountType];

                  updateForm({
                    accountGroup: nextGroups.some(
                      (option) => option.value === formState.accountGroup,
                    )
                      ? formState.accountGroup
                      : "",
                    accountType,
                  });
                }}
                value={formState.accountType}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {accountTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Account group</Label>
              <Select
                onValueChange={(accountGroup) => updateForm({ accountGroup })}
                {...(formState.accountGroup !== "" ? { value: formState.accountGroup } : {})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select account group" />
                </SelectTrigger>
                <SelectContent>
                  {accountGroupOptions.map((group) => (
                    <SelectItem key={group.value} value={group.value}>
                      {group.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Normal balance</Label>
              <div className="rounded-xl border border-brand-cappuccino/70 bg-brand-latte/50 px-3 py-2.5 text-sm text-brand-espresso">
                <span className="font-medium">
                  {formatNormalBalanceLabel(displayNormalBalance)}
                </span>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Parent account</Label>
              <Select
                onValueChange={(parentAccountId) =>
                  updateForm({
                    parentAccountId: parentAccountId === noParentValue ? null : parentAccountId,
                  })
                }
                value={formState.parentAccountId ?? noParentValue}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No parent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={noParentValue}>No parent</SelectItem>
                  {parentOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.accountCode} - {option.accountName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              onChange={(event) => updateForm({ description: event.target.value })}
              placeholder="Optional account description"
              value={formState.description}
            />
          </div>

          <div className="grid gap-3 rounded-2xl border border-brand-cappuccino/60 bg-brand-latte/50 p-4 md:grid-cols-2">
            <label className="flex items-start gap-3">
              <Checkbox
                checked={formState.isControlAccount}
                onCheckedChange={(checked) => updateForm({ isControlAccount: checked === true })}
              />
              <span>
                <span className="block font-medium text-brand-espresso">Control account</span>
                <span className="text-sm text-brand-mocha">
                  Mark accounts used as system-level totals.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3">
              <Checkbox
                checked={formState.allowManualPosting}
                onCheckedChange={(checked) => updateForm({ allowManualPosting: checked === true })}
              />
              <span>
                <span className="block font-medium text-brand-espresso">Allow manual posting</span>
                <span className="text-sm text-brand-mocha">
                  Permit future manual journal posting to this account.
                </span>
              </span>
            </label>
          </div>

          {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}

          <DialogFooter>
            <Button onClick={onClose} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? "Saving..." : isEditing ? "Save account" : "Create account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
