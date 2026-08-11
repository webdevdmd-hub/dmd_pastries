"use client";

import { Eye, Pencil, Plus, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AccessDeniedCard } from "@/components/purchasing/access-denied-card";
import { PurchaseEmptyState } from "@/components/purchasing/purchase-empty-state";
import { PurchaseErrorState } from "@/components/purchasing/purchase-error-state";
import { PurchaseTableSkeleton } from "@/components/purchasing/purchase-table-skeleton";
import { NoBranchScopeCard } from "@/components/shared/no-branch-scope-card";
import { PageHeader } from "@/components/shared/page-header";
import type { SearchableComboboxOption } from "@/components/shared/searchable-combobox";
import { SearchableCombobox } from "@/components/shared/searchable-combobox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
import { useChartAccounts, usePaymentAccounts } from "@/hooks/use-accounting";
import { useBranchScope } from "@/hooks/use-branch-scope";
import { useCustomerLookup } from "@/hooks/use-customers";
import {
  useCreateExpense,
  useDeleteExpense,
  useExpenses,
  useUpdateExpense,
} from "@/hooks/use-expenses";
import { usePermission } from "@/hooks/use-permission";
import { usePurchasingBranches, usePurchasingSuppliers } from "@/hooks/use-purchasing";
import { ApiError, getErrorMessage } from "@/lib/api/client";
import { uploadStorageFile } from "@/lib/appwrite/storage";
import { isLedgerAllowedForContext, isPaymentAccountForBranch } from "@/lib/selectors/eligibility";
import type { AccountingAccountType, ChartAccount, PaymentAccount } from "@/types/accounting";
import type { Customer } from "@/types/customer";
import type {
  CreateExpensePayload,
  Expense,
  ExpensesFilters,
  UpdateExpensePayload,
} from "@/types/expenses";
import type { PurchasingSupplierOption } from "@/types/purchasing";

const defaultFilters: ExpensesFilters = {
  branchId: "",
  customerId: "",
  dateFrom: "",
  dateTo: "",
  expenseAccountId: "",
  limit: 25,
  page: 1,
  paidThroughAccountId: "",
  search: "",
  sortBy: "expense_date",
  sortOrder: "desc",
  status: "all",
  supplierId: "",
};

type ExpenseFormState = {
  amount: string;
  branchId: string;
  customerId: string;
  expenseAccountId: string;
  expenseDate: string;
  isBillable: boolean;
  notes: string;
  paidThroughAccountId: string;
  receiptFileId: string;
  referenceNumber: string;
  supplierId: string;
};

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

function emptyForm(defaultBranchId: string): ExpenseFormState {
  return {
    amount: "",
    branchId: defaultBranchId,
    customerId: "",
    expenseAccountId: "",
    expenseDate: todayInputValue(),
    isBillable: false,
    notes: "",
    paidThroughAccountId: "",
    receiptFileId: "",
    referenceNumber: "",
    supplierId: "",
  };
}

function formFromExpense(expense: Expense | null, defaultBranchId: string): ExpenseFormState {
  if (!expense) {
    return emptyForm(defaultBranchId);
  }

  return {
    amount: String(expense.amount),
    branchId: expense.branchId,
    customerId: expense.customerId ?? "",
    expenseAccountId: expense.expenseAccountId,
    expenseDate: expense.expenseDate,
    isBillable: expense.isBillable,
    notes: expense.notes ?? "",
    paidThroughAccountId: expense.paidThroughAccountId,
    receiptFileId: expense.receiptFileId ?? "",
    referenceNumber: expense.referenceNumber ?? "",
    supplierId: expense.supplierId ?? "",
  };
}

function money(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

function formatDate(value: string): string {
  return value
    ? new Intl.DateTimeFormat("en-AE", { dateStyle: "medium" }).format(new Date(value))
    : "-";
}

function textOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function accountOptions(
  accounts: ChartAccount[],
  types: AccountingAccountType[],
): SearchableComboboxOption[] {
  return accounts
    .filter(
      (account) =>
        isLedgerAllowedForContext(account, "expense_category_account") &&
        types.includes(account.accountType),
    )
    .map((account) => ({
      description: `${account.accountType} · ${account.accountGroup || "No group"}`,
      keywords: [
        account.accountCode,
        account.accountName,
        account.accountGroup,
        account.accountType,
      ],
      label: `${account.accountCode} - ${account.accountName}`,
      value: account.id,
    }));
}

function paidThroughOptions(
  accounts: PaymentAccount[],
  branchId: string,
): SearchableComboboxOption[] {
  return accounts
    .filter(
      (account) =>
        account.chartAccountId.length > 0 && isPaymentAccountForBranch(account, branchId),
    )
    .map((account) => ({
      description: [
        account.accountType.replaceAll("_", " "),
        account.branchName || "All branches",
        `${account.chartAccountCode} - ${account.chartAccountName}`,
      ].join(" - "),
      keywords: [
        account.accountName,
        account.accountType,
        account.branchName,
        account.chartAccountCode,
        account.chartAccountName,
      ],
      label: account.accountName,
      value: account.chartAccountId,
    }));
}

function uniqueAccounts(accounts: ChartAccount[]): ChartAccount[] {
  const accountMap = new Map<string, ChartAccount>();

  accounts.forEach((account) => {
    if (!accountMap.has(account.id)) {
      accountMap.set(account.id, account);
    }
  });

  return Array.from(accountMap.values());
}

function supplierOptions(suppliers: PurchasingSupplierOption[]): SearchableComboboxOption[] {
  return suppliers.map((supplier) => ({
    label: supplier.supplierName,
    value: supplier.id,
  }));
}

function customerOptions(customers: Customer[]): SearchableComboboxOption[] {
  return customers.map((customer) => ({
    description: [customer.phone, customer.email].filter(Boolean).join(" · "),
    keywords: [
      customer.customerCode,
      customer.fullName,
      customer.phone ?? "",
      customer.email ?? "",
    ],
    label: customer.fullName,
    value: customer.id,
  }));
}

function buildPayload(state: ExpenseFormState): CreateExpensePayload {
  return {
    amount: Number(state.amount),
    branchId: state.branchId,
    customerId: textOrNull(state.customerId),
    expenseAccountId: state.expenseAccountId,
    expenseDate: state.expenseDate,
    isBillable: state.isBillable,
    notes: textOrNull(state.notes),
    paidThroughAccountId: state.paidThroughAccountId,
    receiptFileId: textOrNull(state.receiptFileId),
    referenceNumber: textOrNull(state.referenceNumber),
    supplierId: textOrNull(state.supplierId),
  };
}

function ExpenseStatusBadge({ status }: { status: Expense["status"] }): JSX.Element {
  return (
    <Badge variant={status === "posted" ? "default" : "secondary"}>
      {status === "posted" ? "Posted" : "Voided"}
    </Badge>
  );
}

function ExpenseFormDialog({
  accountErrorMessage,
  expenseAccounts,
  branches,
  defaultBranchId,
  expense,
  isAccountLoading,
  isSubmitting,
  onClose,
  onCreate,
  onRetryAccounts,
  onUpdate,
  open,
  paymentAccounts,
  suppliers,
}: {
  accountErrorMessage: string | null;
  expenseAccounts: ChartAccount[];
  branches: { id: string; branchName: string }[];
  defaultBranchId: string;
  expense: Expense | null;
  isAccountLoading: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onCreate: (payload: CreateExpensePayload) => Promise<void>;
  onRetryAccounts: () => void;
  onUpdate: (id: string, payload: UpdateExpensePayload) => Promise<void>;
  open: boolean;
  paymentAccounts: PaymentAccount[];
  suppliers: PurchasingSupplierOption[];
}): JSX.Element {
  const [formState, setFormState] = useState<ExpenseFormState>(emptyForm(defaultBranchId));
  const [error, setError] = useState<string | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [knownCustomers, setKnownCustomers] = useState<Customer[]>([]);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);
  const customerLookupQuery = useCustomerLookup(customerSearch, open);
  const isEditing = expense !== null;
  const expenseAccountOptions = useMemo(
    () => accountOptions(expenseAccounts, ["expense", "cogs"]),
    [expenseAccounts],
  );
  const paidThroughAccountOptions = useMemo(
    () => paidThroughOptions(paymentAccounts, formState.branchId),
    [formState.branchId, paymentAccounts],
  );
  const hasNoPaidThroughOptions =
    !isAccountLoading && !accountErrorMessage && paidThroughAccountOptions.length === 0;
  const supplierComboboxOptions = useMemo(() => supplierOptions(suppliers), [suppliers]);
  const customerComboboxOptions = useMemo(() => customerOptions(knownCustomers), [knownCustomers]);

  useEffect(() => {
    if (open) {
      setFormState(formFromExpense(expense, defaultBranchId));
      setError(null);
      setCustomerSearch("");
      setReceiptFile(null);
      setKnownCustomers(
        expense?.customerId && expense.customerName
          ? [
              {
                addressLine1: null,
                addressLine2: null,
                businessId: "",
                city: null,
                country: null,
                createdAt: "",
                createdByUserId: null,
                customerCode: "",
                dateOfBirth: null,
                email: null,
                fullName: expense.customerName,
                gender: null,
                id: expense.customerId,
                lastPurchaseAt: null,
                notes: null,
                phone: null,
                postalCode: null,
                state: null,
                status: "active",
                tags: [],
                totalOrdersCount: null,
                totalSalesAmount: null,
                updatedAt: "",
                updatedByUserId: null,
              },
            ]
          : [],
      );
    }
  }, [defaultBranchId, expense, open]);

  useEffect(() => {
    if (customerLookupQuery.data) {
      setKnownCustomers((current) => {
        const merged = new Map<string, Customer>();
        current.forEach((customer) => merged.set(customer.id, customer));
        customerLookupQuery.data.forEach((customer) => merged.set(customer.id, customer));
        return Array.from(merged.values());
      });
    }
  }, [customerLookupQuery.data]);

  useEffect(() => {
    if (
      !open ||
      formState.paidThroughAccountId.length === 0 ||
      isAccountLoading ||
      accountErrorMessage
    ) {
      return;
    }

    const selectedIsValid = paidThroughAccountOptions.some(
      (option) => option.value === formState.paidThroughAccountId,
    );
    if (!selectedIsValid) {
      setFormState((current) => ({ ...current, paidThroughAccountId: "" }));
      setError("Select an active payment account available for this branch.");
    }
  }, [
    accountErrorMessage,
    formState.paidThroughAccountId,
    isAccountLoading,
    open,
    paidThroughAccountOptions,
  ]);

  const updateForm = (patch: Partial<ExpenseFormState>): void => {
    setFormState((current) => ({ ...current, ...patch }));
  };

  const submitForm = async (): Promise<void> => {
    const payload = buildPayload(formState);

    if (!payload.branchId) {
      setError("Branch is required.");
      return;
    }

    if (!payload.expenseDate) {
      setError("Expense date is required.");
      return;
    }

    if (!payload.expenseAccountId) {
      setError("Expense account is required.");
      return;
    }

    if (!payload.paidThroughAccountId) {
      setError("Paid through account is required.");
      return;
    }

    if (
      !paidThroughAccountOptions.some((option) => option.value === payload.paidThroughAccountId)
    ) {
      setError("Select an active payment account available for this branch.");
      return;
    }

    if (!Number.isFinite(payload.amount) || payload.amount <= 0) {
      setError("Amount must be greater than zero.");
      return;
    }

    setError(null);

    if (receiptFile) {
      try {
        setIsUploadingReceipt(true);
        payload.receiptFileId = await uploadStorageFile("documents", receiptFile);
      } catch (error) {
        setError(getErrorMessage(error));
        return;
      } finally {
        setIsUploadingReceipt(false);
      }
    }

    if (expense) {
      await onUpdate(expense.id, payload);
      return;
    }

    await onCreate(payload);
  };

  return (
    <Dialog onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)} open={open}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit expense" : "Record expense"}</DialogTitle>
          <DialogDescription>
            Expenses automatically post debit/credit accounting journals through the backend.
          </DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submitForm();
          }}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>Branch</Label>
              <SearchableCombobox
                emptyMessage="No branches found."
                onValueChange={(branchId) => updateForm({ branchId })}
                options={branches.map((branch) => ({
                  label: branch.branchName,
                  value: branch.id,
                }))}
                placeholder="Select branch"
                searchPlaceholder="Search branch..."
                value={formState.branchId}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="expenseDate">Expense date</Label>
              <Input
                id="expenseDate"
                onChange={(event) => updateForm({ expenseDate: event.target.value })}
                type="date"
                value={formState.expenseDate}
              />
            </div>
            <div className="grid gap-2">
              <Label>Expense account</Label>
              <SearchableCombobox
                emptyMessage="No active Expense or COGS accounts allow manual posting."
                errorMessage={accountErrorMessage}
                groupLabel="Expense accounts"
                isLoading={isAccountLoading}
                loadingMessage="Loading expense accounts..."
                onValueChange={(expenseAccountId) => updateForm({ expenseAccountId })}
                onRetry={onRetryAccounts}
                options={expenseAccountOptions}
                placeholder="Select expense account"
                searchPlaceholder="Search code or account..."
                value={formState.expenseAccountId}
              />
              <p className="text-xs text-brand-mocha">
                What cost category this expense belongs to.
              </p>
            </div>
            <div className="grid gap-2">
              <Label>Paid through</Label>
              <SearchableCombobox
                disabled={hasNoPaidThroughOptions}
                emptyMessage="No active payment accounts are available for this branch."
                errorMessage={accountErrorMessage}
                groupLabel="Payment accounts"
                isLoading={isAccountLoading}
                loadingMessage="Loading paid-through accounts..."
                onValueChange={(paidThroughAccountId) => updateForm({ paidThroughAccountId })}
                onRetry={onRetryAccounts}
                options={paidThroughAccountOptions}
                placeholder="Select paid-through account"
                searchPlaceholder="Search cash, bank, wallet..."
                value={formState.paidThroughAccountId}
              />
              <p className="text-xs text-brand-mocha">
                Cash, bank, wallet, or clearing payment account used to pay.
              </p>
              {hasNoPaidThroughOptions ? (
                <p className="text-xs text-red-700">
                  Configure an active payment account for this branch before recording expenses.
                </p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label>Vendor</Label>
              <SearchableCombobox
                emptyMessage="No suppliers found."
                onValueChange={(supplierId) => updateForm({ supplierId })}
                options={supplierComboboxOptions}
                placeholder="Optional supplier"
                searchPlaceholder="Search supplier..."
                value={formState.supplierId}
              />
            </div>
            <div className="grid gap-2">
              <Label>Customer</Label>
              <SearchableCombobox
                emptyMessage="Search by customer name, phone, or email."
                isLoading={customerLookupQuery.isFetching}
                onSearchChange={setCustomerSearch}
                onValueChange={(customerId) => updateForm({ customerId })}
                options={customerComboboxOptions}
                placeholder="Optional customer"
                searchPlaceholder="Type at least 2 characters..."
                searchValue={customerSearch}
                value={formState.customerId}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                min="0"
                onChange={(event) => updateForm({ amount: event.target.value })}
                placeholder="0.00"
                step="0.01"
                type="number"
                value={formState.amount}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="referenceNumber">Reference number</Label>
              <Input
                id="referenceNumber"
                onChange={(event) => updateForm({ referenceNumber: event.target.value })}
                placeholder="REF-001"
                value={formState.referenceNumber}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="receiptFile">Receipt upload</Label>
              <Input
                id="receiptFile"
                onChange={(event) => setReceiptFile(event.target.files?.[0] ?? null)}
                type="file"
              />
              {formState.receiptFileId && !receiptFile ? (
                <p className="text-xs text-brand-mocha">
                  Current receipt file: {formState.receiptFileId}
                </p>
              ) : null}
            </div>
            <label className="flex items-center gap-3 rounded-2xl border border-brand-cappuccino/70 bg-brand-latte/30 px-4 py-3">
              <Checkbox
                checked={formState.isBillable}
                onCheckedChange={(checked) => updateForm({ isBillable: checked === true })}
              />
              <span>
                <span className="block font-semibold text-brand-espresso">Billable expense</span>
                <span className="block text-sm text-brand-mocha">
                  Tag this expense against a customer for future tracking.
                </span>
              </span>
            </label>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="notes">Notes</Label>
            <Input
              id="notes"
              onChange={(event) => updateForm({ notes: event.target.value })}
              placeholder="Internal expense notes"
              value={formState.notes}
            />
          </div>

          {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}

          <DialogFooter>
            <Button onClick={onClose} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={isSubmitting || isUploadingReceipt} type="submit">
              {isSubmitting || isUploadingReceipt
                ? "Saving..."
                : isEditing
                  ? "Save expense"
                  : "Record expense"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type ExpensesPageClientProps = {
  initialCreateOpen?: boolean;
  redirectOnCreateClose?: boolean;
};

export function ExpensesPageClient({
  initialCreateOpen = false,
  redirectOnCreateClose = false,
}: ExpensesPageClientProps = {}): JSX.Element {
  const router = useRouter();
  const { hasAnyPermission } = usePermission();
  const branchScope = useBranchScope();
  const { normalizeBranchId } = branchScope;
  const canView = hasAnyPermission([
    PERMISSIONS.expensesView,
    PERMISSIONS.expensesManage,
    PERMISSIONS.purchasingView,
  ]);
  const canCreate = hasAnyPermission([PERMISSIONS.expensesCreate, PERMISSIONS.expensesManage]);
  const canEdit = hasAnyPermission([PERMISSIONS.expensesEdit, PERMISSIONS.expensesManage]);
  const canDelete = hasAnyPermission([PERMISSIONS.expensesDelete, PERMISSIONS.expensesManage]);
  const [filters, setFilters] = useState<ExpensesFilters>({
    ...defaultFilters,
    branchId: branchScope.defaultBranchId,
  });
  const [formOpen, setFormOpen] = useState(initialCreateOpen);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const expensesQuery = useExpenses(filters, canView && branchScope.hasBranchScope);
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
  const cogsAccountsQuery = useChartAccounts(
    {
      accountGroup: "",
      accountType: "cogs",
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
  const paymentAccountsQuery = usePaymentAccounts(
    {
      accountType: "all",
      branchId: "",
      limit: 500,
      page: 1,
      search: "",
      sortBy: "account_name",
      sortOrder: "asc",
      status: "active",
    },
    canView,
  );
  const suppliersQuery = usePurchasingSuppliers("", canView);
  const branchesQuery = usePurchasingBranches(canView);
  const createMutation = useCreateExpense();
  const updateMutation = useUpdateExpense();
  const deleteMutation = useDeleteExpense();
  const isPermissionDenied =
    expensesQuery.error instanceof ApiError && expensesQuery.error.status === 403;
  const branchOptions = useMemo(
    () =>
      (branchesQuery.data ?? []).filter(
        (branch) => branchScope.canAccessAllBranches || branchScope.isBranchAllowed(branch.id),
      ),
    [branchScope, branchesQuery.data],
  );
  const expenses = expensesQuery.data?.items ?? [];
  const totalExpenses = expensesQuery.data?.total ?? expenses.length;
  const totalPages = Math.max(1, Math.ceil(totalExpenses / filters.limit));
  const expenseAccountList = useMemo(
    () =>
      uniqueAccounts([
        ...(expenseAccountsQuery.data?.items ?? []),
        ...(cogsAccountsQuery.data?.items ?? []),
      ]),
    [cogsAccountsQuery.data?.items, expenseAccountsQuery.data?.items],
  );
  const paymentAccountList = paymentAccountsQuery.data?.items ?? [];
  const isAccountLoading =
    expenseAccountsQuery.isLoading || cogsAccountsQuery.isLoading || paymentAccountsQuery.isLoading;
  const accountQueryError =
    expenseAccountsQuery.error ?? cogsAccountsQuery.error ?? paymentAccountsQuery.error;
  const accountErrorMessage = accountQueryError ? getErrorMessage(accountQueryError) : null;
  const retryAccountQueries = (): void => {
    void expenseAccountsQuery.refetch();
    void cogsAccountsQuery.refetch();
    void paymentAccountsQuery.refetch();
  };

  useEffect(() => {
    setFilters((currentFilters) => {
      const branchId = normalizeBranchId(currentFilters.branchId);
      return branchId === currentFilters.branchId
        ? currentFilters
        : { ...currentFilters, branchId };
    });
  }, [normalizeBranchId]);

  useEffect(() => {
    if (initialCreateOpen && canCreate) {
      setEditingExpense(null);
      setFormOpen(true);
    }
  }, [canCreate, initialCreateOpen]);

  if (!canView) {
    return <AccessDeniedCard message="You need `expenses.view` to view Expenses." />;
  }

  if (initialCreateOpen && !canCreate) {
    return <AccessDeniedCard message="You need `expenses.create` to record expenses." />;
  }

  if (!branchScope.hasBranchScope) {
    return <NoBranchScopeCard />;
  }

  const updateFilters = (patch: Partial<ExpensesFilters>, resetPage = true): void => {
    setFilters((current) => ({
      ...current,
      ...patch,
      ...(resetPage ? { page: 1 } : {}),
    }));
  };

  const openCreate = (): void => {
    setEditingExpense(null);
    setFormOpen(true);
  };

  const handleCreate = async (payload: CreateExpensePayload): Promise<void> => {
    try {
      await createMutation.mutateAsync(payload);
      toast.success("Expense recorded.");
      setFormOpen(false);
      if (redirectOnCreateClose) {
        router.replace(ROUTES.expenses);
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleUpdate = async (id: string, payload: UpdateExpensePayload): Promise<void> => {
    try {
      await updateMutation.mutateAsync({ id, payload });
      toast.success("Expense updated.");
      setFormOpen(false);
      setEditingExpense(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const confirmDelete = async (): Promise<void> => {
    if (!deleteTarget) return;

    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toast.success("Expense permanently deleted.");
      setDeleteTarget(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        actions={
          canCreate ? (
            <Button onClick={openCreate} type="button">
              <Plus className="h-4 w-4" />
              Record Expense
            </Button>
          ) : undefined
        }
        description="Track supplier, customer, and operating expenses with automatic accounting journals."
        title="Expenses"
      />

      <div className="grid gap-3 rounded-2xl border border-brand-cappuccino/60 bg-white/80 p-4 lg:grid-cols-[1.5fr_repeat(5,minmax(0,1fr))]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-mocha" />
          <Input
            aria-label="Search expenses"
            className="pl-9"
            onChange={(event) => updateFilters({ search: event.target.value })}
            placeholder="Search expense, reference, vendor..."
            value={filters.search}
          />
        </div>
        <Select
          onValueChange={(status: ExpensesFilters["status"]) => updateFilters({ status })}
          value={filters.status}
        >
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="posted">Posted</SelectItem>
            <SelectItem value="voided">Voided</SelectItem>
          </SelectContent>
        </Select>
        <Select
          onValueChange={(branchId) => updateFilters({ branchId })}
          value={filters.branchId || "all"}
        >
          <SelectTrigger>
            <SelectValue placeholder="Branch" />
          </SelectTrigger>
          <SelectContent>
            {branchScope.canAccessAllBranches ? (
              <SelectItem value="all">All branches</SelectItem>
            ) : null}
            {branchOptions.map((branch) => (
              <SelectItem key={branch.id} value={branch.id}>
                {branch.branchName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          aria-label="Date from"
          onChange={(event) => updateFilters({ dateFrom: event.target.value })}
          type="date"
          value={filters.dateFrom}
        />
        <Input
          aria-label="Date to"
          onChange={(event) => updateFilters({ dateTo: event.target.value })}
          type="date"
          value={filters.dateTo}
        />
        <Button
          onClick={() =>
            setFilters({
              ...defaultFilters,
              branchId: branchScope.defaultBranchId,
            })
          }
          type="button"
          variant="outline"
        >
          Reset
        </Button>
      </div>

      {expensesQuery.isLoading ? <PurchaseTableSkeleton /> : null}

      {!expensesQuery.isLoading && expensesQuery.error ? (
        isPermissionDenied ? (
          <AccessDeniedCard message="The backend denied access to expenses." />
        ) : (
          <PurchaseErrorState
            description={getErrorMessage(expensesQuery.error)}
            onRetry={() => {
              void expensesQuery.refetch();
            }}
          />
        )
      ) : null}

      {!expensesQuery.isLoading && !expensesQuery.error && expenses.length === 0 ? (
        <PurchaseEmptyState
          actionLabel={canCreate ? "Record Expense" : undefined}
          onAction={canCreate ? openCreate : undefined}
          title="No expenses found."
        />
      ) : null}

      {!expensesQuery.isLoading && !expensesQuery.error && expenses.length > 0 ? (
        <Card className="overflow-hidden border-brand-cappuccino/70 bg-white/85">
          <CardContent className="overflow-hidden p-0">
            <div className="flex flex-col gap-2 border-b border-brand-cappuccino/70 bg-white/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-brand-espresso">Expense register</p>
                <p className="text-xs text-brand-mocha">
                  Showing {expenses.length} of {totalExpenses} expenses
                </p>
              </div>
              <p className="text-xs text-brand-mocha">
                Page {filters.page} of {totalPages}
              </p>
            </div>
            <div className="overflow-x-auto bg-white/75">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Expense</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Paid Through</TableHead>
                    <TableHead>Vendor/Customer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell>
                        <Link
                          className="font-bold text-brand-espresso"
                          href={`${ROUTES.expenses}/${expense.id}`}
                        >
                          {expense.expenseNumber}
                        </Link>
                        <span className="block max-w-52 truncate text-xs text-brand-mocha">
                          {expense.referenceNumber ?? expense.notes ?? "No reference"}
                        </span>
                      </TableCell>
                      <TableCell>{formatDate(expense.expenseDate)}</TableCell>
                      <TableCell>{expense.branchName}</TableCell>
                      <TableCell>{expense.expenseAccountName}</TableCell>
                      <TableCell>{expense.paidThroughAccountName}</TableCell>
                      <TableCell>
                        {expense.supplierName ?? expense.customerName ?? (
                          <span className="text-brand-mocha">Not tagged</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <ExpenseStatusBadge status={expense.status} />
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {money(expense.amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" type="button" variant="ghost">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuLabel>Expense actions</DropdownMenuLabel>
                            <DropdownMenuItem asChild>
                              <Link href={`${ROUTES.expenses}/${expense.id}`}>
                                <Eye className="h-4 w-4" />
                                View details
                              </Link>
                            </DropdownMenuItem>
                            {canEdit ? (
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditingExpense(expense);
                                  setFormOpen(true);
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                                Edit expense
                              </DropdownMenuItem>
                            ) : null}
                            {canDelete ? (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-red-700 focus:text-red-800"
                                  onClick={() => setDeleteTarget(expense)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Delete permanently
                                </DropdownMenuItem>
                              </>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex flex-col gap-3 border-t border-brand-cappuccino/70 bg-white/80 px-4 py-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-brand-mocha">Rows per page</span>
                <Select
                  onValueChange={(value) => updateFilters({ limit: Number(value) })}
                  value={String(filters.limit)}
                >
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between gap-3 md:justify-end">
                <Button
                  disabled={filters.page <= 1 || expensesQuery.isFetching}
                  onClick={() => updateFilters({ page: Math.max(1, filters.page - 1) }, false)}
                  type="button"
                  variant="outline"
                >
                  Previous
                </Button>
                <span className="min-w-28 text-center text-sm text-brand-mocha">
                  {filters.page} / {totalPages}
                </span>
                <Button
                  disabled={filters.page >= totalPages || expensesQuery.isFetching}
                  onClick={() => updateFilters({ page: filters.page + 1 }, false)}
                  type="button"
                  variant="outline"
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <ExpenseFormDialog
        accountErrorMessage={accountErrorMessage}
        branches={branchOptions}
        defaultBranchId={branchScope.defaultBranchId}
        expense={editingExpense}
        expenseAccounts={expenseAccountList}
        isAccountLoading={isAccountLoading}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
        onClose={() => {
          setEditingExpense(null);
          setFormOpen(false);
          if (redirectOnCreateClose) {
            router.replace(ROUTES.expenses);
          }
        }}
        onCreate={handleCreate}
        onRetryAccounts={retryAccountQueries}
        onUpdate={handleUpdate}
        open={formOpen}
        paymentAccounts={paymentAccountList}
        suppliers={suppliersQuery.data ?? []}
      />

      <Dialog
        onOpenChange={(open) => (!open ? setDeleteTarget(null) : undefined)}
        open={deleteTarget !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete expense permanently?</DialogTitle>
            <DialogDescription>
              This removes the expense and backend-generated journal entries. This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setDeleteTarget(null)} type="button" variant="outline">
              Cancel
            </Button>
            <Button
              className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
              disabled={deleteMutation.isPending}
              onClick={() => void confirmDelete()}
              type="button"
              variant="outline"
            >
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
