"use client";

import {
  ArrowLeftRight,
  Landmark,
  LoaderCircle,
  MoreHorizontal,
  Plus,
  ReceiptText,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AccountingAccessDeniedCard } from "@/components/accounting/accounting-access-denied-card";
import { PageHeader } from "@/components/shared/page-header";
import type { SearchableComboboxOption } from "@/components/shared/searchable-combobox";
import { SearchableCombobox } from "@/components/shared/searchable-combobox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import {
  useAccountTransfers,
  useChartAccounts,
  useCreateAccountTransfer,
  useCreatePaymentAccount,
  useCreatePlatformSettlement,
  useDeletePaymentAccount,
  usePaymentAccounts,
  usePlatformSettlements,
  useUpdatePaymentAccount,
  useUpdatePaymentAccountStatus,
} from "@/hooks/use-accounting";
import { useBranches } from "@/hooks/use-branches";
import { usePermission } from "@/hooks/use-permission";
import { getErrorMessage } from "@/lib/api/client";
import {
  accountTransferSchema,
  paymentAccountSchema,
  platformSettlementSchema,
} from "@/lib/validators/accounting.schema";
import type {
  AccountTransferPayload,
  AccountTransfersFilters,
  ChartAccount,
  PaymentAccount,
  PaymentAccountPayload,
  PaymentAccountsFilters,
  PaymentAccountType,
  PlatformSettlementDeductionPayload,
  PlatformSettlementPayload,
  PlatformSettlementsFilters,
} from "@/types/accounting";
import type { Branch } from "@/types/branch";

const noBranchValue = "__all__";

const paymentAccountTypes: { label: string; value: PaymentAccountType }[] = [
  { label: "Cash", value: "cash" },
  { label: "Bank", value: "bank" },
  { label: "Card clearing", value: "card_clearing" },
  { label: "Platform clearing", value: "platform_clearing" },
  { label: "Wallet", value: "wallet" },
  { label: "Other", value: "other" },
];

const defaultPaymentAccountFilters: PaymentAccountsFilters = {
  accountType: "all",
  branchId: "",
  limit: 25,
  page: 1,
  search: "",
  sortBy: "account_name",
  sortOrder: "asc",
  status: "all",
};

const defaultTransferFilters: AccountTransfersFilters = {
  branchId: "",
  dateFrom: "",
  dateTo: "",
  limit: 25,
  page: 1,
  paymentAccountId: "",
  sortOrder: "desc",
};

const defaultSettlementFilters: PlatformSettlementsFilters = {
  branchId: "",
  dateFrom: "",
  dateTo: "",
  depositPaymentAccountId: "",
  limit: 25,
  page: 1,
  platformPaymentAccountId: "",
  sortOrder: "desc",
};

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

function money(value: number): string {
  return new Intl.NumberFormat("en-AE", {
    currency: "AED",
    style: "currency",
  }).format(value);
}

function formatDate(value: string): string {
  return value ? new Date(value).toLocaleDateString("en-AE") : "-";
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

function paymentAccountOptions(accounts: PaymentAccount[]): SearchableComboboxOption[] {
  return accounts
    .filter((account) => account.status === "active")
    .map((account) => ({
      value: account.id,
      label: account.accountName,
      description: `${account.accountType.replaceAll("_", " ")} / ${account.chartAccountName}`,
      keywords: [account.accountName, account.accountType, account.chartAccountName],
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

function JournalLink({ id }: { id: string | null }): JSX.Element | null {
  if (!id) return null;

  return (
    <Button asChild size="sm" variant="outline">
      <Link href={`${ROUTES.accountingJournalEntries}?search=${encodeURIComponent(id)}`}>
        View Journal
      </Link>
    </Button>
  );
}

function QueryError({ message, title }: { message: string; title: string }): JSX.Element {
  return (
    <Alert className="border-red-200 bg-red-50 text-red-950">
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

type PaymentAccountFormState = {
  accountName: string;
  accountType: PaymentAccountType;
  branchId: string;
  chartAccountId: string;
  description: string;
  status: "active" | "inactive";
};

function emptyPaymentAccountForm(): PaymentAccountFormState {
  return {
    accountName: "",
    accountType: "cash",
    branchId: noBranchValue,
    chartAccountId: "",
    description: "",
    status: "active",
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
  };
}

function toPaymentAccountPayload(form: PaymentAccountFormState): PaymentAccountPayload {
  return {
    accountName: form.accountName.trim(),
    accountType: form.accountType,
    branchId: form.branchId === noBranchValue ? null : form.branchId,
    chartAccountId: form.chartAccountId,
    description: form.description.trim(),
    status: form.status,
  };
}

function PaymentAccountDialog({
  account,
  branches,
  chartAccounts,
  open,
  submitting,
  onOpenChange,
  onSubmit,
}: {
  account: PaymentAccount | null;
  branches: Branch[];
  chartAccounts: ChartAccount[];
  open: boolean;
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: PaymentAccountPayload) => Promise<void>;
}): JSX.Element {
  const [form, setForm] = useState<PaymentAccountFormState>(emptyPaymentAccountForm);
  const chartOptions = useMemo(() => accountOptions(chartAccounts), [chartAccounts]);
  const branchesOptions = useMemo(() => branchOptions(branches), [branches]);

  const update = (patch: Partial<PaymentAccountFormState>): void => {
    setForm((current) => ({ ...current, ...patch }));
  };

  const submit = async (): Promise<void> => {
    const payload = toPaymentAccountPayload(form);
    const parsed = paymentAccountSchema.safeParse(payload);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Payment account payload is invalid.");
      return;
    }

    await onSubmit(payload);
  };

  useEffect(() => {
    if (open) setForm(paymentAccountToForm(account));
  }, [account, open]);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) setForm(paymentAccountToForm(account));
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{account ? "Edit payment account" : "Create payment account"}</DialogTitle>
          <DialogDescription>
            Link cash, bank, card clearing, and platform settlement accounts to active asset ledgers
            in Chart of Accounts.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label>Account name</Label>
            <Input
              value={form.accountName}
              onChange={(event) => update({ accountName: event.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label>Account type</Label>
            <Select
              value={form.accountType}
              onValueChange={(accountType) =>
                update({ accountType: accountType as PaymentAccountType })
              }
            >
              <SelectTrigger>
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
            <Label>Branch</Label>
            <SearchableCombobox
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
            <Label>Linked asset ledger</Label>
            <SearchableCombobox
              emptyMessage="No active Asset ledgers found. Create or activate an Asset account such as Cash, Bank, Petty Cash, Card Clearing, or Platform Settlement in Chart of Accounts."
              options={chartOptions}
              placeholder="Select active Asset ledger"
              searchPlaceholder="Search asset code or ledger..."
              value={form.chartAccountId}
              onValueChange={(chartAccountId) => update({ chartAccountId })}
            />
            <p className="text-xs text-brand-mocha">
              Only active Asset ledgers are shown because payment accounts hold money. Expense,
              income, liability, and equity ledgers cannot be linked here.
            </p>
          </div>
          <div className="grid gap-2">
            <Label>Status</Label>
            <Select
              value={form.status}
              onValueChange={(status) =>
                update({ status: status as PaymentAccountFormState["status"] })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2 md:col-span-2">
            <Label>Description</Label>
            <Input
              value={form.description}
              onChange={(event) => update({ description: event.target.value })}
            />
          </div>
        </div>

        <DialogFooter>
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

export function PaymentAccountsPageClient(): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const canView = hasAnyPermission([PERMISSIONS.accountingView]);
  const canManage = hasAnyPermission([PERMISSIONS.accountingAccountsManage]);
  const [filters, setFilters] = useState<PaymentAccountsFilters>(defaultPaymentAccountFilters);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<PaymentAccount | null>(null);
  const accountsQuery = usePaymentAccounts(filters, canView);
  const branchesQuery = useBranches(canView);
  const assetAccountsQuery = useChartAccounts(
    {
      accountGroup: "",
      accountType: "asset",
      limit: 100,
      page: 1,
      parentAccountId: "",
      search: "",
      sortBy: "account_code",
      sortOrder: "asc",
      status: "active",
    },
    canView,
  );
  const createMutation = useCreatePaymentAccount();
  const updateMutation = useUpdatePaymentAccount();
  const statusMutation = useUpdatePaymentAccountStatus();
  const deleteMutation = useDeletePaymentAccount();
  const submitting =
    createMutation.isPending ||
    updateMutation.isPending ||
    statusMutation.isPending ||
    deleteMutation.isPending;

  const openCreate = (): void => {
    setSelectedAccount(null);
    setDialogOpen(true);
  };

  const openEdit = (account: PaymentAccount): void => {
    setSelectedAccount(account);
    setDialogOpen(true);
  };

  const submitAccount = async (payload: PaymentAccountPayload): Promise<void> => {
    try {
      if (selectedAccount) {
        await updateMutation.mutateAsync({ id: selectedAccount.id, payload });
        toast.success("Payment account updated.");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("Payment account created.");
      }
      setDialogOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const updateStatus = async (account: PaymentAccount, status: PaymentAccount["status"]) => {
    try {
      await statusMutation.mutateAsync({ id: account.id, payload: { status } });
      toast.success(`Payment account marked ${status}.`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const deleteAccount = async (account: PaymentAccount) => {
    try {
      await deleteMutation.mutateAsync(account.id);
      toast.success("Payment account deleted.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  if (!canView) return <AccountingAccessDeniedCard />;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        title="Payment Accounts"
        description="Manage cash, bank, card clearing, and platform settlement accounts."
        actions={
          canManage ? (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Create account
            </Button>
          ) : null
        }
      />

      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_220px_180px]">
          <Input
            placeholder="Search account..."
            value={filters.search}
            onChange={(event) =>
              setFilters((current) => ({ ...current, page: 1, search: event.target.value }))
            }
          />
          <Select
            value={filters.accountType}
            onValueChange={(accountType) =>
              setFilters((current) => ({
                ...current,
                accountType: accountType as PaymentAccountsFilters["accountType"],
                page: 1,
              }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {paymentAccountTypes.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.status}
            onValueChange={(status) =>
              setFilters((current) => ({
                ...current,
                status: status as PaymentAccountsFilters["status"],
                page: 1,
              }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {accountsQuery.error ? (
        <QueryError
          title="Unable to load payment accounts"
          message={getErrorMessage(accountsQuery.error)}
        />
      ) : null}

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Chart Account</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accountsQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-brand-mocha">
                    Loading payment accounts...
                  </TableCell>
                </TableRow>
              ) : null}
              {(accountsQuery.data?.items ?? []).map((account) => (
                <TableRow key={account.id}>
                  <TableCell className="font-medium text-brand-espresso">
                    {account.accountName}
                  </TableCell>
                  <TableCell>{account.accountType.replaceAll("_", " ")}</TableCell>
                  <TableCell>
                    {account.chartAccountCode} - {account.chartAccountName}
                  </TableCell>
                  <TableCell>{account.branchName || "Business-wide"}</TableCell>
                  <TableCell>
                    {money(account.currentBalance)} {account.balanceLabel}
                  </TableCell>
                  <TableCell>
                    <Badge variant={account.status === "active" ? "secondary" : "default"}>
                      {account.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem disabled={!canManage} onSelect={() => openEdit(account)}>
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={!canManage || account.status === "active"}
                          onSelect={() => void updateStatus(account, "active")}
                        >
                          Mark active
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={!canManage || account.status === "inactive"}
                          onSelect={() => void updateStatus(account, "inactive")}
                        >
                          Mark inactive
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-700 focus:text-red-800"
                          disabled={!canManage}
                          onSelect={() => void deleteAccount(account)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {!accountsQuery.isLoading && (accountsQuery.data?.items ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-brand-mocha">
                    <Landmark className="mx-auto h-8 w-8" />
                    <p className="mt-3 font-medium text-brand-espresso">
                      No payment accounts found.
                    </p>
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <PaymentAccountDialog
        account={selectedAccount}
        branches={branchesQuery.data ?? []}
        chartAccounts={assetAccountsQuery.data?.items ?? []}
        open={dialogOpen}
        submitting={submitting}
        onOpenChange={setDialogOpen}
        onSubmit={submitAccount}
      />
    </div>
  );
}

type TransferFormState = {
  amount: string;
  branchId: string;
  fromPaymentAccountId: string;
  notes: string;
  referenceNumber: string;
  toPaymentAccountId: string;
  transferDate: string;
};

function emptyTransferForm(): TransferFormState {
  return {
    amount: "",
    branchId: noBranchValue,
    fromPaymentAccountId: "",
    notes: "",
    referenceNumber: "",
    toPaymentAccountId: "",
    transferDate: todayInputValue(),
  };
}

function transferPayload(form: TransferFormState): AccountTransferPayload {
  return {
    amount: Number(form.amount),
    branchId: form.branchId === noBranchValue ? null : form.branchId,
    fromPaymentAccountId: form.fromPaymentAccountId,
    notes: form.notes.trim(),
    referenceNumber: form.referenceNumber.trim(),
    toPaymentAccountId: form.toPaymentAccountId,
    transferDate: form.transferDate,
  };
}

function AccountTransferDialog({
  branches,
  open,
  paymentAccounts,
  submitting,
  onOpenChange,
  onSubmit,
}: {
  branches: Branch[];
  open: boolean;
  paymentAccounts: PaymentAccount[];
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: AccountTransferPayload) => Promise<void>;
}): JSX.Element {
  const [form, setForm] = useState<TransferFormState>(emptyTransferForm);
  const branchesOptions = useMemo(() => branchOptions(branches), [branches]);
  const accountSelectorOptions = useMemo(
    () => paymentAccountOptions(paymentAccounts),
    [paymentAccounts],
  );
  const update = (patch: Partial<TransferFormState>): void => {
    setForm((current) => ({ ...current, ...patch }));
  };
  const submit = async (): Promise<void> => {
    const payload = transferPayload(form);
    const parsed = accountTransferSchema.safeParse(payload);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Transfer payload is invalid.");
      return;
    }

    await onSubmit(payload);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) setForm(emptyTransferForm());
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create account transfer</DialogTitle>
          <DialogDescription>
            Move funds between payment accounts with accounting posting.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label>Branch</Label>
            <SearchableCombobox
              options={[
                { value: noBranchValue, label: "Business-wide transfer" },
                ...branchesOptions,
              ]}
              placeholder="Business-wide transfer"
              value={form.branchId}
              onValueChange={(branchId) => update({ branchId: branchId || noBranchValue })}
            />
          </div>
          <div className="grid gap-2">
            <Label>Transfer date</Label>
            <Input
              type="date"
              value={form.transferDate}
              onChange={(event) => update({ transferDate: event.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label>From account</Label>
            <SearchableCombobox
              emptyMessage="No active payment accounts found."
              options={accountSelectorOptions}
              placeholder="Select source account"
              value={form.fromPaymentAccountId}
              onValueChange={(fromPaymentAccountId) => update({ fromPaymentAccountId })}
            />
          </div>
          <div className="grid gap-2">
            <Label>To account</Label>
            <SearchableCombobox
              emptyMessage="No active payment accounts found."
              options={accountSelectorOptions}
              placeholder="Select target account"
              value={form.toPaymentAccountId}
              onValueChange={(toPaymentAccountId) => update({ toPaymentAccountId })}
            />
          </div>
          <div className="grid gap-2">
            <Label>Amount</Label>
            <Input
              min={0}
              step="0.01"
              type="number"
              value={form.amount}
              onChange={(event) => update({ amount: event.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label>Reference number</Label>
            <Input
              value={form.referenceNumber}
              onChange={(event) => update({ referenceNumber: event.target.value })}
            />
          </div>
          <div className="grid gap-2 md:col-span-2">
            <Label>Notes</Label>
            <Input value={form.notes} onChange={(event) => update({ notes: event.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={submitting} type="button" onClick={() => void submit()}>
            {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            Create transfer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AccountTransfersPageClient(): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const canView = hasAnyPermission([PERMISSIONS.accountingView]);
  const canManage = hasAnyPermission([PERMISSIONS.accountingJournalEntriesManage]);
  const [filters] = useState<AccountTransfersFilters>(defaultTransferFilters);
  const [dialogOpen, setDialogOpen] = useState(false);
  const transfersQuery = useAccountTransfers(filters, canView);
  const paymentAccountsQuery = usePaymentAccounts(defaultPaymentAccountFilters, canView);
  const branchesQuery = useBranches(canView);
  const createMutation = useCreateAccountTransfer();

  const submitTransfer = async (payload: AccountTransferPayload): Promise<void> => {
    try {
      await createMutation.mutateAsync(payload);
      toast.success("Account transfer created.");
      setDialogOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  if (!canView) return <AccountingAccessDeniedCard />;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        title="Account Transfers"
        description="Move funds between cash, bank, card clearing, and platform accounts."
        actions={
          canManage ? (
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Create transfer
            </Button>
          ) : null
        }
      />
      {transfersQuery.error ? (
        <QueryError
          title="Unable to load transfers"
          message={getErrorMessage(transfersQuery.error)}
        />
      ) : null}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Transfer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Journal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transfersQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center text-brand-mocha">
                    Loading transfers...
                  </TableCell>
                </TableRow>
              ) : null}
              {(transfersQuery.data?.items ?? []).map((transfer) => (
                <TableRow key={transfer.id}>
                  <TableCell>
                    <div className="font-medium text-brand-espresso">{transfer.transferNumber}</div>
                    <div className="text-xs text-brand-mocha">
                      {transfer.referenceNumber || "-"}
                    </div>
                  </TableCell>
                  <TableCell>{formatDate(transfer.transferDate)}</TableCell>
                  <TableCell>{transfer.fromPaymentAccountName}</TableCell>
                  <TableCell>{transfer.toPaymentAccountName}</TableCell>
                  <TableCell>{money(transfer.amount)}</TableCell>
                  <TableCell>
                    <JournalLink id={transfer.journalEntryId} />
                  </TableCell>
                </TableRow>
              ))}
              {!transfersQuery.isLoading && (transfersQuery.data?.items ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center text-brand-mocha">
                    <ArrowLeftRight className="mx-auto h-8 w-8" />
                    <p className="mt-3 font-medium text-brand-espresso">No transfers found.</p>
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <AccountTransferDialog
        branches={branchesQuery.data ?? []}
        open={dialogOpen}
        paymentAccounts={paymentAccountsQuery.data?.items ?? []}
        submitting={createMutation.isPending}
        onOpenChange={setDialogOpen}
        onSubmit={submitTransfer}
      />
    </div>
  );
}

type SettlementFormState = {
  branchId: string;
  deductionAmount: string;
  deductionDescription: string;
  deductionType: string;
  depositPaymentAccountId: string;
  expenseAccountId: string;
  grossAmount: string;
  netReceivedAmount: string;
  notes: string;
  platformPaymentAccountId: string;
  referenceNumber: string;
  settlementDate: string;
};

function emptySettlementForm(): SettlementFormState {
  return {
    branchId: noBranchValue,
    deductionAmount: "",
    deductionDescription: "",
    deductionType: "commission",
    depositPaymentAccountId: "",
    expenseAccountId: "",
    grossAmount: "",
    netReceivedAmount: "",
    notes: "",
    platformPaymentAccountId: "",
    referenceNumber: "",
    settlementDate: todayInputValue(),
  };
}

function settlementPayload(form: SettlementFormState): PlatformSettlementPayload {
  const deductions: PlatformSettlementDeductionPayload[] =
    Number(form.deductionAmount) > 0
      ? [
          {
            amount: Number(form.deductionAmount),
            deductionType: form.deductionType.trim(),
            description: form.deductionDescription.trim(),
            expenseAccountId: form.expenseAccountId,
          },
        ]
      : [];

  return {
    branchId: form.branchId === noBranchValue ? null : form.branchId,
    deductions,
    depositPaymentAccountId: form.depositPaymentAccountId,
    grossAmount: Number(form.grossAmount),
    netReceivedAmount: Number(form.netReceivedAmount),
    notes: form.notes.trim(),
    platformPaymentAccountId: form.platformPaymentAccountId,
    referenceNumber: form.referenceNumber.trim(),
    settlementDate: form.settlementDate,
  };
}

function PlatformSettlementDialog({
  branches,
  expenseAccounts,
  open,
  paymentAccounts,
  submitting,
  onOpenChange,
  onSubmit,
}: {
  branches: Branch[];
  expenseAccounts: ChartAccount[];
  open: boolean;
  paymentAccounts: PaymentAccount[];
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: PlatformSettlementPayload) => Promise<void>;
}): JSX.Element {
  const [form, setForm] = useState<SettlementFormState>(emptySettlementForm);
  const branchesOptions = useMemo(() => branchOptions(branches), [branches]);
  const accountSelectorOptions = useMemo(
    () => paymentAccountOptions(paymentAccounts),
    [paymentAccounts],
  );
  const expenseOptions = useMemo(() => accountOptions(expenseAccounts), [expenseAccounts]);
  const update = (patch: Partial<SettlementFormState>): void => {
    setForm((current) => ({ ...current, ...patch }));
  };
  const submit = async (): Promise<void> => {
    const payload = settlementPayload(form);
    const parsed = platformSettlementSchema.safeParse(payload);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Settlement payload is invalid.");
      return;
    }

    await onSubmit(payload);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) setForm(emptySettlementForm());
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create platform settlement</DialogTitle>
          <DialogDescription>
            Move platform clearing balance to bank/cash and record commission or settlement fees.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label>Branch</Label>
            <SearchableCombobox
              options={[
                { value: noBranchValue, label: "Business-wide settlement" },
                ...branchesOptions,
              ]}
              placeholder="Business-wide settlement"
              value={form.branchId}
              onValueChange={(branchId) => update({ branchId: branchId || noBranchValue })}
            />
          </div>
          <div className="grid gap-2">
            <Label>Settlement date</Label>
            <Input
              type="date"
              value={form.settlementDate}
              onChange={(event) => update({ settlementDate: event.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label>Platform account</Label>
            <SearchableCombobox
              options={accountSelectorOptions}
              placeholder="Select platform account"
              value={form.platformPaymentAccountId}
              onValueChange={(platformPaymentAccountId) => update({ platformPaymentAccountId })}
            />
          </div>
          <div className="grid gap-2">
            <Label>Deposit account</Label>
            <SearchableCombobox
              options={accountSelectorOptions}
              placeholder="Select deposit account"
              value={form.depositPaymentAccountId}
              onValueChange={(depositPaymentAccountId) => update({ depositPaymentAccountId })}
            />
          </div>
          <div className="grid gap-2">
            <Label>Gross amount</Label>
            <Input
              min={0}
              step="0.01"
              type="number"
              value={form.grossAmount}
              onChange={(event) => update({ grossAmount: event.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label>Net received</Label>
            <Input
              min={0}
              step="0.01"
              type="number"
              value={form.netReceivedAmount}
              onChange={(event) => update({ netReceivedAmount: event.target.value })}
            />
          </div>
          <div className="rounded-2xl border border-brand-cappuccino bg-brand-latte/50 p-4 md:col-span-2">
            <p className="font-medium text-brand-espresso">Optional deduction</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Deduction type</Label>
                <Input
                  value={form.deductionType}
                  onChange={(event) => update({ deductionType: event.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Deduction amount</Label>
                <Input
                  min={0}
                  step="0.01"
                  type="number"
                  value={form.deductionAmount}
                  onChange={(event) => update({ deductionAmount: event.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Expense account</Label>
                <SearchableCombobox
                  options={expenseOptions}
                  placeholder="Select expense account"
                  value={form.expenseAccountId}
                  onValueChange={(expenseAccountId) => update({ expenseAccountId })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Description</Label>
                <Input
                  value={form.deductionDescription}
                  onChange={(event) => update({ deductionDescription: event.target.value })}
                />
              </div>
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Reference number</Label>
            <Input
              value={form.referenceNumber}
              onChange={(event) => update({ referenceNumber: event.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label>Notes</Label>
            <Input value={form.notes} onChange={(event) => update({ notes: event.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={submitting} type="button" onClick={() => void submit()}>
            {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            Create settlement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PlatformSettlementsPageClient(): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const canView = hasAnyPermission([PERMISSIONS.accountingView]);
  const canManage = hasAnyPermission([PERMISSIONS.accountingJournalEntriesManage]);
  const [filters] = useState<PlatformSettlementsFilters>(defaultSettlementFilters);
  const [dialogOpen, setDialogOpen] = useState(false);
  const settlementsQuery = usePlatformSettlements(filters, canView);
  const paymentAccountsQuery = usePaymentAccounts(defaultPaymentAccountFilters, canView);
  const branchesQuery = useBranches(canView);
  const expenseAccountsQuery = useChartAccounts(
    {
      accountGroup: "",
      accountType: "expense",
      limit: 100,
      page: 1,
      parentAccountId: "",
      search: "",
      sortBy: "account_code",
      sortOrder: "asc",
      status: "active",
    },
    canView,
  );
  const createMutation = useCreatePlatformSettlement();

  const submitSettlement = async (payload: PlatformSettlementPayload): Promise<void> => {
    try {
      await createMutation.mutateAsync(payload);
      toast.success("Platform settlement created.");
      setDialogOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  if (!canView) return <AccountingAccessDeniedCard />;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        title="Platform Settlements"
        description="Settle delivery platform clearing accounts into bank or cash accounts."
        actions={
          canManage ? (
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Create settlement
            </Button>
          ) : null
        }
      />
      {settlementsQuery.error ? (
        <QueryError
          title="Unable to load platform settlements"
          message={getErrorMessage(settlementsQuery.error)}
        />
      ) : null}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Settlement</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead>Deposit</TableHead>
                <TableHead>Gross</TableHead>
                <TableHead>Deductions</TableHead>
                <TableHead>Net</TableHead>
                <TableHead>Journal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {settlementsQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-12 text-center text-brand-mocha">
                    Loading settlements...
                  </TableCell>
                </TableRow>
              ) : null}
              {(settlementsQuery.data?.items ?? []).map((settlement) => (
                <TableRow key={settlement.id}>
                  <TableCell>
                    <div className="font-medium text-brand-espresso">
                      {settlement.settlementNumber}
                    </div>
                    <div className="text-xs text-brand-mocha">
                      {settlement.referenceNumber || "-"}
                    </div>
                  </TableCell>
                  <TableCell>{formatDate(settlement.settlementDate)}</TableCell>
                  <TableCell>{settlement.platformPaymentAccountName}</TableCell>
                  <TableCell>{settlement.depositPaymentAccountName}</TableCell>
                  <TableCell>{money(settlement.grossAmount)}</TableCell>
                  <TableCell>{money(settlement.deductionsTotal)}</TableCell>
                  <TableCell>{money(settlement.netReceivedAmount)}</TableCell>
                  <TableCell>
                    <JournalLink id={settlement.journalEntryId} />
                  </TableCell>
                </TableRow>
              ))}
              {!settlementsQuery.isLoading && (settlementsQuery.data?.items ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-12 text-center text-brand-mocha">
                    <ReceiptText className="mx-auto h-8 w-8" />
                    <p className="mt-3 font-medium text-brand-espresso">
                      No platform settlements found.
                    </p>
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <PlatformSettlementDialog
        branches={branchesQuery.data ?? []}
        expenseAccounts={expenseAccountsQuery.data?.items ?? []}
        open={dialogOpen}
        paymentAccounts={paymentAccountsQuery.data?.items ?? []}
        submitting={createMutation.isPending}
        onOpenChange={setDialogOpen}
        onSubmit={submitSettlement}
      />
    </div>
  );
}
