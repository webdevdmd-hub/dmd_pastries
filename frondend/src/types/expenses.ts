export type ExpenseStatus = "posted" | "voided";

export type ExpenseSortBy =
  | "amount"
  | "created_at"
  | "expense_date"
  | "expense_number"
  | "status"
  | "updated_at";

export type Expense = {
  amount: number;
  branchId: string;
  branchName: string;
  businessId: string;
  createdAt: string;
  createdByUserId: string;
  createdByUserName: string;
  customerId: string | null;
  customerName: string | null;
  expenseAccountCode: string;
  expenseAccountId: string;
  expenseAccountName: string;
  expenseDate: string;
  expenseNumber: string;
  id: string;
  isBillable: boolean;
  journalEntryId: string;
  notes: string | null;
  paidThroughAccountCode: string;
  paidThroughAccountId: string;
  paidThroughAccountName: string;
  receiptFileId: string | null;
  referenceNumber: string | null;
  reversalJournalEntryId: string | null;
  status: ExpenseStatus;
  supplierId: string | null;
  supplierName: string | null;
  updatedAt: string;
};

export type ExpensesFilters = {
  branchId: string;
  customerId: string;
  dateFrom: string;
  dateTo: string;
  expenseAccountId: string;
  limit: number;
  page: number;
  paidThroughAccountId: string;
  search: string;
  sortBy: ExpenseSortBy;
  sortOrder: "asc" | "desc";
  status: ExpenseStatus | "all";
  supplierId: string;
};

export type ExpensesResponse = {
  items: Expense[];
  limit: number;
  page: number;
  total: number;
};

export type CreateExpensePayload = {
  amount: number;
  branchId: string;
  customerId: string | null;
  expenseAccountId: string;
  expenseDate: string;
  isBillable: boolean;
  notes: string | null;
  paidThroughAccountId: string;
  receiptFileId: string | null;
  referenceNumber: string | null;
  supplierId: string | null;
};

export type UpdateExpensePayload = Partial<CreateExpensePayload>;
