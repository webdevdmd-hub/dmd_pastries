"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AccessDeniedCard } from "@/components/purchasing/access-denied-card";
import { ExpenseDetailsDrawer } from "@/components/purchasing/expense-details-drawer";
import { ExpensesCardGrid } from "@/components/purchasing/expenses-card-grid";
import { ExpensesTable } from "@/components/purchasing/expenses-table";
import { ExpensesToolbar } from "@/components/purchasing/expenses-toolbar";
import { PurchaseEmptyState } from "@/components/purchasing/purchase-empty-state";
import { PurchaseErrorState } from "@/components/purchasing/purchase-error-state";
import { PurchaseTableSkeleton } from "@/components/purchasing/purchase-table-skeleton";
import { FilteredState } from "@/components/shared/collection-state";
import { FormTabs } from "@/components/shared/form-tabs";
import { NoBranchScopeCard } from "@/components/shared/no-branch-scope-card";
import { PageHeader } from "@/components/shared/page-header";
import { PaginationBar } from "@/components/shared/pagination-bar";
import type { SearchableComboboxOption } from "@/components/shared/searchable-combobox";
import { SearchableCombobox } from "@/components/shared/searchable-combobox";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type ExpenseFormTabKey = "expense" | "attribution" | "receipt";

const EXPENSE_FORM_TABPANEL_ID = "expense-form-tabpanel";

/**
 * Which tab holds a given control. Validation reports field ids, so a failed
 * submit can switch to the tab holding the first offender rather than focusing
 * something the operator cannot see.
 */
const EXPENSE_FIELD_TABS: Record<string, ExpenseFormTabKey> = {
  amount: "expense",
  expenseDate: "expense",
  "expenses-branch": "expense",
  "expenses-expense-account": "expense",
  "expenses-paid-through": "expense",
  "expenses-customer": "attribution",
  "expenses-vendor": "attribution",
  referenceNumber: "attribution",
  notes: "receipt",
  receiptFile: "receipt",
};

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
  const [activeTab, setActiveTab] = useState<ExpenseFormTabKey>("expense");
  const [tabErrorCounts, setTabErrorCounts] = useState<Record<ExpenseFormTabKey, number>>({
    attribution: 0,
    expense: 0,
    receipt: 0,
  });
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
      setActiveTab("expense");
      setTabErrorCounts({ attribution: 0, expense: 0, receipt: 0 });
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

  /**
   * Every failing field, collected in one pass and reported together.
   *
   * This used to be a chain of `if (…) { setError(…); return; }`, so a form
   * with three empty required fields told the operator about one of them,
   * then the next after they resubmitted. The id is here so submit can move
   * focus to the first offender: the message renders at the foot of the
   * dialog, which measured 394px below the field it names.
   */
  const collectValidationErrors = (
    payload: ReturnType<typeof buildPayload>,
  ): { fieldId: string; message: string }[] => {
    const found: { fieldId: string; message: string }[] = [];

    if (!payload.branchId) {
      found.push({ fieldId: "expenses-branch", message: "Branch is required." });
    }

    if (!payload.expenseDate) {
      found.push({ fieldId: "expenseDate", message: "Expense date is required." });
    }

    if (!payload.expenseAccountId) {
      found.push({ fieldId: "expenses-expense-account", message: "Expense account is required." });
    }

    if (!payload.paidThroughAccountId) {
      found.push({
        fieldId: "expenses-paid-through",
        message: "Paid through account is required.",
      });
    } else if (
      !paidThroughAccountOptions.some((option) => option.value === payload.paidThroughAccountId)
    ) {
      found.push({
        fieldId: "expenses-paid-through",
        message: "Select an active payment account available for this branch.",
      });
    }

    if (!Number.isFinite(payload.amount) || payload.amount <= 0) {
      found.push({ fieldId: "amount", message: "Amount must be greater than zero." });
    }

    return found;
  };

  const submitForm = async (): Promise<void> => {
    const payload = buildPayload(formState);

    const validationErrors = collectValidationErrors(payload);

    if (validationErrors.length > 0) {
      setError(validationErrors.map((item) => item.message).join(" "));

      // Badge each tab with how many of its fields are failing, so a problem
      // on a tab the operator is not looking at is still visible.
      const counts: Record<ExpenseFormTabKey, number> = {
        attribution: 0,
        expense: 0,
        receipt: 0,
      };
      validationErrors.forEach((item) => {
        const tab = EXPENSE_FIELD_TABS[item.fieldId] ?? "expense";
        counts[tab] += 1;
      });
      setTabErrorCounts(counts);

      // Switch to the tab holding the first offender before focusing it:
      // focusing a field on a hidden tab moves the caret nowhere visible.
      const firstFieldId = validationErrors[0]?.fieldId ?? "";
      const firstTab = EXPENSE_FIELD_TABS[firstFieldId] ?? "expense";
      setActiveTab(firstTab);
      // The field only exists in the DOM once its tab is showing, so focus
      // waits for the render that switching the tab causes.
      window.setTimeout(() => document.getElementById(firstFieldId)?.focus(), 0);
      return;
    }

    setError(null);
    setTabErrorCounts({ attribution: 0, expense: 0, receipt: 0 });

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

        {/* Three tabs on one form state, so nothing typed on one is lost on
            another. What was spent leads; who it is attributed to and the
            paperwork follow. */}
        <FormTabs
          active={activeTab}
          aria-label="Expense form sections"
          onTabChange={setActiveTab}
          panelId={EXPENSE_FORM_TABPANEL_ID}
          tabs={[
            { key: "expense", label: "Expense", badge: tabErrorCounts.expense },
            { key: "attribution", label: "Attribution", badge: tabErrorCounts.attribution },
            { key: "receipt", label: "Receipt", badge: tabErrorCounts.receipt },
          ]}
        />

        <form
          className="grid gap-4"
          id={EXPENSE_FORM_TABPANEL_ID}
          onSubmit={(event) => {
            event.preventDefault();
            void submitForm();
          }}
          role="tabpanel"
        >
          <div className={activeTab === "expense" ? "grid gap-4 md:grid-cols-2" : "hidden"}>
            <div className="grid gap-2">
              <Label htmlFor="expenses-branch">Branch</Label>
              <SearchableCombobox
                id="expenses-branch"
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
              <Label htmlFor="expenses-expense-account">Expense account</Label>
              <SearchableCombobox
                id="expenses-expense-account"
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
              <Label htmlFor="expenses-paid-through">Paid through</Label>
              <SearchableCombobox
                id="expenses-paid-through"
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
                <p className="text-xs text-danger-text">
                  Configure an active payment account for this branch before recording expenses.
                </p>
              ) : null}
            </div>
            {/* Amount belongs beside the accounts it moves between, not four
                fields below them next to the reference number. */}
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
          </div>

          <div className={activeTab === "attribution" ? "grid gap-4 md:grid-cols-2" : "hidden"}>
            <div className="grid gap-2">
              <Label htmlFor="expenses-vendor">Vendor</Label>
              <SearchableCombobox
                id="expenses-vendor"
                emptyMessage="No suppliers found."
                onValueChange={(supplierId) => updateForm({ supplierId })}
                options={supplierComboboxOptions}
                placeholder="Optional supplier"
                searchPlaceholder="Search supplier..."
                value={formState.supplierId}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="expenses-customer">Customer</Label>
              <SearchableCombobox
                id="expenses-customer"
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
              <Label htmlFor="referenceNumber">Reference number</Label>
              <Input
                id="referenceNumber"
                onChange={(event) => updateForm({ referenceNumber: event.target.value })}
                placeholder="REF-001"
                value={formState.referenceNumber}
              />
            </div>
            <label className="flex items-center gap-3 rounded-2xl border border-brand-cappuccino/70 bg-brand-latte/30 px-4 py-3 md:col-span-2">
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

          <div className={activeTab === "receipt" ? "grid gap-4" : "hidden"}>
            <div className="grid gap-2">
              <Label htmlFor="receiptFile">Receipt upload</Label>
              <Input
                id="receiptFile"
                onChange={(event) => setReceiptFile(event.target.files?.[0] ?? null)}
                type="file"
              />
              {formState.receiptFileId && !receiptFile ? (
                <p className="text-meta text-foreground-muted">
                  Current receipt file: {formState.receiptFileId}
                </p>
              ) : null}
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
          </div>

          {error ? (
            <p className="text-cell font-medium text-danger-text" role="alert">
              {error}
            </p>
          ) : null}

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
  // The record, not the id: the register rows already carry a full Expense,
  // so the drawer needs no fetch of its own.
  const [detailsExpense, setDetailsExpense] = useState<Expense | null>(null);
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
  // Branch is scope, not a filter: it always carries a value, so counting it
  // would make a genuinely empty register look like a narrow search. Paging and
  // page size are excluded too — page 3 of an empty result is still empty, not
  // filtered — and sort order reorders rows without removing any.
  const hasActiveFilters =
    filters.search.trim().length > 0 ||
    filters.status !== defaultFilters.status ||
    filters.supplierId.length > 0 ||
    filters.customerId.length > 0 ||
    filters.expenseAccountId.length > 0 ||
    filters.paidThroughAccountId.length > 0 ||
    filters.dateFrom.length > 0 ||
    filters.dateTo.length > 0;
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

  // A dialog on top of a sheet on top of the register is one layer too many,
  // so the drawer closes before either of these opens.
  const openEdit = (expense: Expense): void => {
    setDetailsExpense(null);
    setEditingExpense(expense);
    setFormOpen(true);
  };

  const askDelete = (expense: Expense): void => {
    setDetailsExpense(null);
    setDeleteTarget(expense);
  };

  const listHandlers = {
    canDelete,
    canEdit,
    expenses,
    onDelete: askDelete,
    onEdit: openEdit,
    onView: setDetailsExpense,
  };

  const pagination = (
    <PaginationBar
      isFetching={expensesQuery.isFetching}
      limit={filters.limit}
      noun={{ one: "expense", other: "expenses" }}
      onPageChange={(page) => updateFilters({ page }, false)}
      page={filters.page}
      total={totalExpenses}
      totalPages={totalPages}
    />
  );

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

      <ExpensesToolbar
        allowAllBranches={branchScope.canAccessAllBranches}
        branches={branchOptions}
        filters={filters}
        onFiltersChange={updateFilters}
        onReset={() => setFilters({ ...defaultFilters, branchId: branchScope.defaultBranchId })}
        resetBranchId={branchScope.defaultBranchId}
      />

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

      {/* Filtered and empty need opposite remedies. Offering "Record Expense" to
          someone whose date range simply excluded everything says the register is
          empty when it may hold a year of spending. DESIGN.md 8. */}
      {!expensesQuery.isLoading &&
      !expensesQuery.error &&
      expenses.length === 0 &&
      hasActiveFilters ? (
        <FilteredState
          noun="expenses"
          onClearFilters={() =>
            setFilters({
              ...defaultFilters,
              branchId: branchScope.defaultBranchId,
            })
          }
          query={filters.search.trim() || undefined}
        />
      ) : null}

      {!expensesQuery.isLoading &&
      !expensesQuery.error &&
      expenses.length === 0 &&
      !hasActiveFilters ? (
        <PurchaseEmptyState
          actionLabel={canCreate ? "Record Expense" : undefined}
          onAction={canCreate ? openCreate : undefined}
          title="No expenses found."
        />
      ) : null}

      {!expensesQuery.isLoading && !expensesQuery.error && expenses.length > 0 ? (
        <>
          <div className="grid gap-4 md:hidden">
            <ExpensesCardGrid {...listHandlers} />
            <Card className="overflow-hidden">{pagination}</Card>
          </div>
          <Card className="hidden overflow-hidden md:block">
            <CardContent className="p-0">
              <ExpensesTable {...listHandlers} />
              {pagination}
            </CardContent>
          </Card>
        </>
      ) : null}

      <ExpenseDetailsDrawer
        canDelete={canDelete}
        canEdit={canEdit}
        expense={detailsExpense}
        onDelete={askDelete}
        onEdit={openEdit}
        onOpenChange={(open) => (!open ? setDetailsExpense(null) : undefined)}
        open={detailsExpense !== null}
      />

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
              className="border-danger/30 text-danger-text hover:bg-danger-tint hover:text-danger-text"
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
