import { apiRequest } from "@/lib/api/client";
import type {
  CreateExpensePayload,
  Expense,
  ExpensesFilters,
  ExpensesResponse,
  ExpenseStatus,
  UpdateExpensePayload,
} from "@/types/expenses";

type BackendExpensePayload = {
  amount?: number;
  branch_id?: string;
  customer_id?: string | null;
  expense_account_id?: string;
  expense_date?: string;
  is_billable?: boolean;
  notes?: string | null;
  paid_through_account_id?: string;
  receipt_file_id?: string | null;
  reference_number?: string | null;
  supplier_id?: string | null;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function numberValue(value: unknown, fallback = 0): number {
  return typeof value === "number" ? value : fallback;
}

function booleanValue(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function statusValue(value: unknown): ExpenseStatus {
  return value === "voided" ? "voided" : "posted";
}

function toQueryString(params: Record<string, string | number | null | undefined>): string {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "" && value !== "all") {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function parseExpense(value: unknown): Expense {
  if (!isObject(value)) {
    throw new Error("Backend expense payload is invalid.");
  }

  return {
    amount: numberValue(value.amount),
    branchId: stringValue(value.branch_id),
    branchName: stringValue(value.branch_name, "Branch"),
    businessId: stringValue(value.business_id),
    createdAt: stringValue(value.created_at),
    createdByUserId: stringValue(value.created_by_user_id),
    createdByUserName: stringValue(value.created_by_user_name, "User"),
    customerId: optionalString(value.customer_id),
    customerName: optionalString(value.customer_name),
    expenseAccountCode: stringValue(value.expense_account_code),
    expenseAccountId: stringValue(value.expense_account_id),
    expenseAccountName: stringValue(value.expense_account_name, "Expense account"),
    expenseDate: stringValue(value.expense_date),
    expenseNumber: stringValue(value.expense_number, "Expense"),
    id: stringValue(value.id),
    isBillable: booleanValue(value.is_billable),
    journalEntryId: stringValue(value.journal_entry_id),
    notes: optionalString(value.notes),
    paidThroughAccountCode: stringValue(value.paid_through_account_code),
    paidThroughAccountId: stringValue(value.paid_through_account_id),
    paidThroughAccountName: stringValue(value.paid_through_account_name, "Paid through"),
    receiptFileId: optionalString(value.receipt_file_id),
    referenceNumber: optionalString(value.reference_number),
    reversalJournalEntryId: optionalString(value.reversal_journal_entry_id),
    status: statusValue(value.status),
    supplierId: optionalString(value.supplier_id),
    supplierName: optionalString(value.supplier_name),
    updatedAt: stringValue(value.updated_at),
  };
}

function listItems(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (isObject(value)) {
    for (const key of ["items", "expenses", "data"]) {
      const nextValue = value[key];
      if (Array.isArray(nextValue)) {
        return nextValue;
      }
    }
  }

  throw new Error("Backend expenses list payload is invalid.");
}

function parsePaginationNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function parseExpensesResponse(value: unknown): ExpensesResponse {
  if (Array.isArray(value)) {
    return {
      items: value.map(parseExpense),
      limit: value.length,
      page: 1,
      total: value.length,
    };
  }

  if (!isObject(value)) {
    throw new Error("Backend expenses list payload is invalid.");
  }

  const pagination = isObject(value.pagination) ? value.pagination : value;

  return {
    items: listItems(value).map(parseExpense),
    limit: parsePaginationNumber(pagination.limit, 25),
    page: parsePaginationNumber(pagination.page, 1),
    total: parsePaginationNumber(pagination.total, listItems(value).length),
  };
}

function expensePayload(
  payload: CreateExpensePayload | UpdateExpensePayload,
): BackendExpensePayload {
  const nextPayload: BackendExpensePayload = {};

  if (payload.amount !== undefined) nextPayload.amount = payload.amount;
  if (payload.branchId !== undefined) nextPayload.branch_id = payload.branchId;
  if (payload.customerId !== undefined) nextPayload.customer_id = payload.customerId;
  if (payload.expenseAccountId !== undefined) {
    nextPayload.expense_account_id = payload.expenseAccountId;
  }
  if (payload.expenseDate !== undefined) nextPayload.expense_date = payload.expenseDate;
  if (payload.isBillable !== undefined) nextPayload.is_billable = payload.isBillable;
  if (payload.notes !== undefined) nextPayload.notes = payload.notes;
  if (payload.paidThroughAccountId !== undefined) {
    nextPayload.paid_through_account_id = payload.paidThroughAccountId;
  }
  if (payload.receiptFileId !== undefined) nextPayload.receipt_file_id = payload.receiptFileId;
  if (payload.referenceNumber !== undefined) {
    nextPayload.reference_number = payload.referenceNumber;
  }
  if (payload.supplierId !== undefined) nextPayload.supplier_id = payload.supplierId;

  return nextPayload;
}

export async function getExpenses(filters: ExpensesFilters): Promise<ExpensesResponse> {
  const response = await apiRequest<ExpensesResponse>(
    `/api/v1/expenses${toQueryString({
      branch_id: filters.branchId,
      customer_id: filters.customerId,
      date_from: filters.dateFrom,
      date_to: filters.dateTo,
      expense_account_id: filters.expenseAccountId,
      limit: filters.limit,
      page: filters.page,
      paid_through_account_id: filters.paidThroughAccountId,
      search: filters.search,
      sort_by: filters.sortBy,
      sort_order: filters.sortOrder,
      status: filters.status,
      supplier_id: filters.supplierId,
    })}`,
    {
      authMode: "appwrite",
      parse: parseExpensesResponse,
    },
  );

  return response.data;
}

export async function getExpenseById(id: string): Promise<Expense> {
  const response = await apiRequest<Expense>(`/api/v1/expenses/${id}`, {
    authMode: "appwrite",
    parse: parseExpense,
  });

  return response.data;
}

export async function createExpense(payload: CreateExpensePayload): Promise<Expense> {
  const response = await apiRequest<Expense, BackendExpensePayload>("/api/v1/expenses", {
    authMode: "appwrite",
    body: expensePayload(payload),
    method: "POST",
    parse: parseExpense,
  });

  return response.data;
}

export async function updateExpense(id: string, payload: UpdateExpensePayload): Promise<Expense> {
  const response = await apiRequest<Expense, BackendExpensePayload>(`/api/v1/expenses/${id}`, {
    authMode: "appwrite",
    body: expensePayload(payload),
    method: "PATCH",
    parse: parseExpense,
  });

  return response.data;
}

export async function deleteExpense(id: string): Promise<void> {
  await apiRequest<void>(`/api/v1/expenses/${id}`, {
    authMode: "appwrite",
    method: "DELETE",
    parse: () => undefined,
  });
}
