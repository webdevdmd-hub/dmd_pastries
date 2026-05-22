import { apiRequest } from "@/lib/api/client";
import type {
  AccountingAccountStatus,
  AccountingAccountType,
  AccountingNormalBalance,
  BalanceSheetFilters,
  BalanceSheetItem,
  BalanceSheetResponse,
  BalanceSheetSection,
  ChartAccount,
  ChartAccountsFilters,
  ChartAccountsResponse,
  CreateChartAccountPayload,
  CreateJournalEntryPayload,
  GeneralLedgerFilters,
  GeneralLedgerItem,
  GeneralLedgerResponse,
  JournalEntriesFilters,
  JournalEntriesResponse,
  JournalEntry,
  JournalEntryLine,
  JournalEntryStatus,
  LedgerDetailsFilters,
  LedgerDetailsResponse,
  LedgerDetailsTransaction,
  ProfitLossFilters,
  ProfitLossItem,
  ProfitLossResponse,
  ProfitLossSection,
  TrialBalanceFilters,
  TrialBalanceItem,
  TrialBalanceResponse,
  UpdateChartAccountPayload,
  UpdateChartAccountStatusPayload,
  UpdateJournalEntryPayload,
} from "@/types/accounting";

type BackendListResponse = {
  accounts?: unknown;
  chart_of_accounts?: unknown;
  data?: unknown;
  items?: unknown;
  limit?: unknown;
  page?: unknown;
  pagination?: unknown;
  total?: unknown;
};

type BackendJournalEntryPayload = {
  branch_id: string | null;
  entry_date: string;
  reference_number: string;
  source_type: "manual";
  source_id: string | null;
  narration: string;
  lines: {
    account_id: string;
    debit_amount: number;
    credit_amount: number;
    description: string;
  }[];
};

type BackendChartAccountPayload = {
  account_code: string;
  account_group: string;
  account_name: string;
  account_type: AccountingAccountType;
  allow_manual_posting: boolean;
  description: string;
  is_control_account: boolean;
  normal_balance: AccountingNormalBalance;
  parent_account_id: string | null;
};

type BackendChartAccountUpdatePayload = {
  account_group: string;
  account_name: string;
  allow_manual_posting: boolean;
  description: string;
  is_control_account: boolean;
  parent_account_id: string | null;
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

function booleanValue(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function isAccountType(value: unknown): value is AccountingAccountType {
  return (
    value === "asset" ||
    value === "liability" ||
    value === "equity" ||
    value === "income" ||
    value === "cogs" ||
    value === "expense"
  );
}

function isNormalBalance(value: unknown): value is AccountingNormalBalance {
  return value === "debit" || value === "credit";
}

function isAccountStatus(value: unknown): value is AccountingAccountStatus {
  return value === "active" || value === "inactive";
}

function isJournalEntryStatus(value: unknown): value is JournalEntryStatus {
  return value === "draft" || value === "posted" || value === "reversed";
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function parseList<TItem>(value: unknown, parser: (item: unknown) => TItem): TItem[] {
  if (Array.isArray(value)) {
    return value.map(parser);
  }

  if (isObject(value)) {
    const keys = ["items", "accounts", "chart_of_accounts", "data"];
    for (const key of keys) {
      const nextValue = value[key];
      if (Array.isArray(nextValue)) {
        return nextValue.map(parser);
      }
    }
  }

  throw new Error("Backend chart of accounts list payload is invalid.");
}

function parseChartAccountsResponse(value: unknown): ChartAccountsResponse {
  if (Array.isArray(value)) {
    return {
      items: value.map(parseChartAccount),
      limit: value.length || 25,
      page: 1,
      total: value.length,
    };
  }

  if (!isObject(value)) {
    throw new Error("Backend chart of accounts list payload is invalid.");
  }

  const payload = value as BackendListResponse;
  const items = parseList(value, parseChartAccount);
  const pagination = isObject(payload.pagination) ? payload.pagination : {};
  const total = numberValue(payload.total, numberValue(pagination.total, items.length));
  const page = numberValue(payload.page, numberValue(pagination.page, 1));
  const limit = numberValue(payload.limit, numberValue(pagination.limit, items.length || 25));

  return {
    items,
    limit,
    page,
    total,
  };
}

function toQueryString(
  params: Record<string, boolean | number | string | null | undefined>,
): string {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "" && value !== "all") {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function parseChartAccount(value: unknown): ChartAccount {
  if (!isObject(value)) {
    throw new Error("Backend chart account payload is invalid.");
  }

  return {
    id: stringValue(value.id),
    businessId: stringValue(value.business_id),
    parentAccountId: optionalString(value.parent_account_id),
    parentAccountName: stringValue(value.parent_account_name),
    accountCode: stringValue(value.account_code),
    accountName: stringValue(value.account_name, "Account"),
    accountType: isAccountType(value.account_type) ? value.account_type : "expense",
    accountGroup: stringValue(value.account_group),
    normalBalance: isNormalBalance(value.normal_balance) ? value.normal_balance : "debit",
    description: stringValue(value.description),
    isSystemAccount: booleanValue(value.is_system_account),
    isControlAccount: booleanValue(value.is_control_account),
    allowManualPosting: booleanValue(value.allow_manual_posting, true),
    status: isAccountStatus(value.status) ? value.status : "active",
    createdAt: stringValue(value.created_at),
    updatedAt: stringValue(value.updated_at),
  };
}

function parseJournalEntryLine(value: unknown): JournalEntryLine {
  if (!isObject(value)) {
    throw new Error("Backend journal entry line payload is invalid.");
  }

  return {
    id: stringValue(value.id),
    journalEntryId: stringValue(value.journal_entry_id),
    accountId: stringValue(value.account_id),
    accountCode: stringValue(value.account_code),
    accountName: stringValue(value.account_name, "Account"),
    accountType: isAccountType(value.account_type) ? value.account_type : "expense",
    lineNumber: numberValue(value.line_number, 0),
    debitAmount: numberValue(value.debit_amount, 0),
    creditAmount: numberValue(value.credit_amount, 0),
    description: stringValue(value.description),
  };
}

function parseJournalEntry(value: unknown): JournalEntry {
  if (!isObject(value)) {
    throw new Error("Backend journal entry payload is invalid.");
  }

  return {
    id: stringValue(value.id),
    businessId: stringValue(value.business_id),
    branchId: optionalString(value.branch_id),
    branchName: stringValue(value.branch_name),
    entryNumber: stringValue(value.entry_number),
    entryDate: stringValue(value.entry_date),
    referenceNumber: stringValue(value.reference_number),
    sourceType: stringValue(value.source_type, "manual"),
    sourceId: optionalString(value.source_id),
    narration: stringValue(value.narration),
    status: isJournalEntryStatus(value.status) ? value.status : "draft",
    totalDebit: numberValue(value.total_debit, 0),
    totalCredit: numberValue(value.total_credit, 0),
    postedAt: optionalString(value.posted_at),
    postedByUserId: optionalString(value.posted_by_user_id),
    reversedEntryId: optionalString(value.reversed_entry_id),
    reversedAt: optionalString(value.reversed_at),
    reversedByUserId: optionalString(value.reversed_by_user_id),
    lines: Array.isArray(value.lines) ? value.lines.map(parseJournalEntryLine) : [],
    createdAt: stringValue(value.created_at),
    updatedAt: stringValue(value.updated_at),
  };
}

function parseJournalEntriesResponse(value: unknown): JournalEntriesResponse {
  if (Array.isArray(value)) {
    return {
      items: value.map(parseJournalEntry),
      limit: value.length || 25,
      page: 1,
      total: value.length,
    };
  }

  if (!isObject(value)) {
    throw new Error("Backend journal entries list payload is invalid.");
  }

  const payload = value as BackendListResponse;
  const items = parseList(value, parseJournalEntry);
  const pagination = isObject(payload.pagination) ? payload.pagination : {};

  return {
    items,
    limit: numberValue(payload.limit, numberValue(pagination.limit, items.length || 25)),
    page: numberValue(payload.page, numberValue(pagination.page, 1)),
    total: numberValue(payload.total, numberValue(pagination.total, items.length)),
  };
}

function parseReportAccount(value: unknown) {
  if (!isObject(value)) {
    return null;
  }

  return {
    accountId: stringValue(value.account_id),
    accountCode: stringValue(value.account_code),
    accountName: stringValue(value.account_name, "Account"),
    accountType: isAccountType(value.account_type) ? value.account_type : "expense",
    normalBalance: isNormalBalance(value.normal_balance) ? value.normal_balance : "debit",
  };
}

function parseGeneralLedgerItem(value: unknown): GeneralLedgerItem {
  if (!isObject(value)) {
    throw new Error("Backend general ledger item payload is invalid.");
  }

  return {
    entryId: stringValue(value.entry_id),
    entryNumber: stringValue(value.entry_number),
    entryDate: stringValue(value.entry_date),
    branchId: optionalString(value.branch_id),
    branchName: stringValue(value.branch_name),
    accountId: stringValue(value.account_id),
    accountCode: stringValue(value.account_code),
    accountName: stringValue(value.account_name, "Account"),
    accountType: isAccountType(value.account_type) ? value.account_type : "expense",
    normalBalance: isNormalBalance(value.normal_balance) ? value.normal_balance : "debit",
    referenceNumber: stringValue(value.reference_number),
    narration: stringValue(value.narration),
    lineDescription: stringValue(value.line_description),
    debitAmount: numberValue(value.debit_amount, 0),
    creditAmount: numberValue(value.credit_amount, 0),
    runningBalance: numberValue(value.running_balance, 0),
  };
}

function parseGeneralLedgerResponse(value: unknown): GeneralLedgerResponse {
  if (!isObject(value)) {
    throw new Error("Backend general ledger payload is invalid.");
  }

  const pagination = isObject(value.pagination) ? value.pagination : {};
  const items = Array.isArray(value.items) ? value.items.map(parseGeneralLedgerItem) : [];

  return {
    account: parseReportAccount(value.account),
    openingBalance: numberValue(value.opening_balance, 0),
    periodDebit: numberValue(value.period_debit, 0),
    periodCredit: numberValue(value.period_credit, 0),
    closingBalance: numberValue(value.closing_balance, 0),
    items,
    page: numberValue(pagination.page, 1),
    limit: numberValue(pagination.limit, items.length || 20),
    total: numberValue(pagination.total, items.length),
    totalPages: numberValue(pagination.total_pages, 1),
  };
}

function parseTrialBalanceItem(value: unknown): TrialBalanceItem {
  if (!isObject(value)) {
    throw new Error("Backend trial balance item payload is invalid.");
  }

  return {
    accountId: stringValue(value.account_id),
    accountCode: stringValue(value.account_code),
    accountName: stringValue(value.account_name, "Account"),
    accountType: isAccountType(value.account_type) ? value.account_type : "expense",
    accountGroup: stringValue(value.account_group),
    normalBalance: isNormalBalance(value.normal_balance) ? value.normal_balance : "debit",
    openingBalance: numberValue(value.opening_balance, 0),
    periodDebit: numberValue(value.period_debit, 0),
    periodCredit: numberValue(value.period_credit, 0),
    closingDebit: numberValue(value.closing_debit, 0),
    closingCredit: numberValue(value.closing_credit, 0),
  };
}

function parseTrialBalanceResponse(value: unknown): TrialBalanceResponse {
  if (!isObject(value)) {
    throw new Error("Backend trial balance payload is invalid.");
  }

  return {
    dateFrom: stringValue(value.date_from),
    dateTo: stringValue(value.date_to),
    totalDebit: numberValue(value.total_debit, 0),
    totalCredit: numberValue(value.total_credit, 0),
    isBalanced: booleanValue(value.is_balanced),
    items: Array.isArray(value.items) ? value.items.map(parseTrialBalanceItem) : [],
  };
}

function parseProfitLossItem(value: unknown): ProfitLossItem {
  if (!isObject(value)) {
    throw new Error("Backend profit and loss item payload is invalid.");
  }

  return {
    accountId: stringValue(value.account_id),
    accountCode: stringValue(value.account_code),
    accountName: stringValue(value.account_name, "Account"),
    accountType: isAccountType(value.account_type) ? value.account_type : "income",
    accountGroup: stringValue(value.account_group),
    amount: numberValue(value.amount, 0),
  };
}

function parseProfitLossSection(value: unknown): ProfitLossSection {
  if (!isObject(value)) {
    return {
      items: [],
      total: 0,
    };
  }

  return {
    total: numberValue(value.total, 0),
    items: Array.isArray(value.items) ? value.items.map(parseProfitLossItem) : [],
  };
}

function parseProfitLossResponse(value: unknown): ProfitLossResponse {
  if (!isObject(value)) {
    throw new Error("Backend profit and loss payload is invalid.");
  }

  return {
    dateFrom: stringValue(value.date_from),
    dateTo: stringValue(value.date_to),
    income: parseProfitLossSection(value.income),
    cogs: parseProfitLossSection(value.cogs),
    grossProfit: numberValue(value.gross_profit, 0),
    operatingExpenses: parseProfitLossSection(value.operating_expenses),
    totalExpenses: numberValue(value.total_expenses, 0),
    netProfit: numberValue(value.net_profit, 0),
  };
}

function parseBalanceSheetItem(value: unknown): BalanceSheetItem {
  if (!isObject(value)) {
    throw new Error("Backend balance sheet item payload is invalid.");
  }

  return {
    accountId: stringValue(value.account_id),
    accountCode: stringValue(value.account_code),
    accountName: stringValue(value.account_name, "Account"),
    accountType: isAccountType(value.account_type) ? value.account_type : "asset",
    accountGroup: stringValue(value.account_group),
    amount: numberValue(value.amount, 0),
  };
}

function parseBalanceSheetSection(value: unknown): BalanceSheetSection {
  if (!isObject(value)) {
    return {
      items: [],
      total: 0,
    };
  }

  return {
    total: numberValue(value.total, 0),
    items: Array.isArray(value.items) ? value.items.map(parseBalanceSheetItem) : [],
  };
}

function parseBalanceSheetResponse(value: unknown): BalanceSheetResponse {
  if (!isObject(value)) {
    throw new Error("Backend balance sheet payload is invalid.");
  }

  return {
    asOfDate: stringValue(value.as_of_date),
    assets: parseBalanceSheetSection(value.assets),
    liabilities: parseBalanceSheetSection(value.liabilities),
    equity: parseBalanceSheetSection(value.equity),
    totalAssets: numberValue(value.total_assets, 0),
    totalLiabilities: numberValue(value.total_liabilities, 0),
    totalEquity: numberValue(value.total_equity, 0),
    totalLiabilitiesAndEquity: numberValue(value.total_liabilities_and_equity, 0),
    isBalanced: booleanValue(value.is_balanced),
    difference: numberValue(value.difference, 0),
  };
}

function parseLedgerDetailsTransaction(value: unknown): LedgerDetailsTransaction {
  if (!isObject(value)) {
    throw new Error("Backend ledger details transaction payload is invalid.");
  }

  return {
    ...parseGeneralLedgerItem(value),
    sourceType: stringValue(value.source_type),
    sourceId: optionalString(value.source_id),
  };
}

function parseLedgerDetailsResponse(value: unknown): LedgerDetailsResponse {
  if (!isObject(value)) {
    throw new Error("Backend ledger details payload is invalid.");
  }

  const summary = isObject(value.summary) ? value.summary : {};
  const pagination = isObject(value.pagination) ? value.pagination : {};
  const transactions = Array.isArray(value.transactions)
    ? value.transactions.map(parseLedgerDetailsTransaction)
    : [];

  return {
    account: parseChartAccount(value.account),
    summary: {
      openingBalance: numberValue(summary.opening_balance, 0),
      periodDebit: numberValue(summary.period_debit, 0),
      periodCredit: numberValue(summary.period_credit, 0),
      closingBalance: numberValue(summary.closing_balance, 0),
      balanceLabel: stringValue(summary.balance_label),
    },
    transactions,
    page: numberValue(pagination.page, 1),
    limit: numberValue(pagination.limit, transactions.length || 20),
    total: numberValue(pagination.total, transactions.length),
    totalPages: numberValue(pagination.total_pages, 1),
  };
}

function normalBalanceForAccountType(accountType: AccountingAccountType): AccountingNormalBalance {
  return accountType === "asset" || accountType === "cogs" || accountType === "expense"
    ? "debit"
    : "credit";
}

function createPayload(payload: CreateChartAccountPayload): BackendChartAccountPayload {
  return {
    account_code: payload.accountCode,
    account_group: payload.accountGroup,
    account_name: payload.accountName,
    account_type: payload.accountType,
    allow_manual_posting: payload.allowManualPosting,
    description: payload.description,
    is_control_account: payload.isControlAccount,
    normal_balance: normalBalanceForAccountType(payload.accountType),
    parent_account_id: payload.parentAccountId,
  };
}

function updatePayload(payload: UpdateChartAccountPayload): BackendChartAccountUpdatePayload {
  return {
    account_group: payload.accountGroup,
    account_name: payload.accountName,
    allow_manual_posting: payload.allowManualPosting,
    description: payload.description,
    is_control_account: payload.isControlAccount,
    parent_account_id: payload.parentAccountId,
  };
}

function journalEntryPayload(payload: CreateJournalEntryPayload): BackendJournalEntryPayload {
  return {
    branch_id: payload.branchId,
    entry_date: payload.entryDate,
    reference_number: payload.referenceNumber,
    source_type: payload.sourceType,
    source_id: payload.sourceId,
    narration: payload.narration,
    lines: payload.lines.map((line) => ({
      account_id: line.accountId,
      debit_amount: line.debitAmount,
      credit_amount: line.creditAmount,
      description: line.description,
    })),
  };
}

export async function getChartAccounts(
  filters: ChartAccountsFilters,
): Promise<ChartAccountsResponse> {
  const response = await apiRequest<ChartAccountsResponse>(
    `/api/v1/accounting/chart-of-accounts${toQueryString({
      account_group: filters.accountGroup,
      account_type: filters.accountType,
      limit: filters.limit,
      page: filters.page,
      parent_account_id: filters.parentAccountId,
      search: filters.search,
      sort_by: filters.sortBy,
      sort_order: filters.sortOrder,
      status: filters.status,
    })}`,
    {
      authMode: "appwrite",
      parse: parseChartAccountsResponse,
    },
  );

  return response.data;
}

export async function seedDefaultChartAccounts(): Promise<void> {
  const response = await apiRequest<void>("/api/v1/accounting/chart-of-accounts/seed-defaults", {
    authMode: "appwrite",
    method: "POST",
    parse: () => undefined,
  });

  return response.data;
}

export async function createChartAccount(
  payload: CreateChartAccountPayload,
): Promise<ChartAccount> {
  const response = await apiRequest<ChartAccount, BackendChartAccountPayload>(
    "/api/v1/accounting/chart-of-accounts",
    {
      authMode: "appwrite",
      body: createPayload(payload),
      method: "POST",
      parse: parseChartAccount,
    },
  );

  return response.data;
}

export async function getChartAccountById(id: string): Promise<ChartAccount> {
  const response = await apiRequest<ChartAccount>(`/api/v1/accounting/chart-of-accounts/${id}`, {
    authMode: "appwrite",
    parse: parseChartAccount,
  });

  return response.data;
}

export async function updateChartAccount(
  id: string,
  payload: UpdateChartAccountPayload,
): Promise<ChartAccount> {
  const response = await apiRequest<ChartAccount, BackendChartAccountUpdatePayload>(
    `/api/v1/accounting/chart-of-accounts/${id}`,
    {
      authMode: "appwrite",
      body: updatePayload(payload),
      method: "PATCH",
      parse: parseChartAccount,
    },
  );

  return response.data;
}

export async function updateChartAccountStatus(
  id: string,
  payload: UpdateChartAccountStatusPayload,
): Promise<ChartAccount> {
  const response = await apiRequest<ChartAccount, { status: AccountingAccountStatus }>(
    `/api/v1/accounting/chart-of-accounts/${id}/status`,
    {
      authMode: "appwrite",
      body: payload,
      method: "PATCH",
      parse: parseChartAccount,
    },
  );

  return response.data;
}

export async function deleteChartAccount(id: string): Promise<void> {
  await apiRequest<void>(`/api/v1/accounting/chart-of-accounts/${id}`, {
    authMode: "appwrite",
    method: "DELETE",
    parse: () => undefined,
  });
}

export async function getJournalEntries(
  filters: JournalEntriesFilters,
): Promise<JournalEntriesResponse> {
  const response = await apiRequest<JournalEntriesResponse>(
    `/api/v1/accounting/journal-entries${toQueryString({
      branch_id: filters.branchId,
      date_from: filters.dateFrom,
      date_to: filters.dateTo,
      limit: filters.limit,
      page: filters.page,
      search: filters.search,
      sort_by: filters.sortBy,
      sort_order: filters.sortOrder,
      source_type: filters.sourceType,
      status: filters.status,
    })}`,
    {
      authMode: "appwrite",
      parse: parseJournalEntriesResponse,
    },
  );

  return response.data;
}

export async function createJournalEntry(
  payload: CreateJournalEntryPayload,
): Promise<JournalEntry> {
  const response = await apiRequest<JournalEntry, BackendJournalEntryPayload>(
    "/api/v1/accounting/journal-entries",
    {
      authMode: "appwrite",
      body: journalEntryPayload(payload),
      method: "POST",
      parse: parseJournalEntry,
    },
  );

  return response.data;
}

export async function getJournalEntryById(id: string): Promise<JournalEntry> {
  const response = await apiRequest<JournalEntry>(`/api/v1/accounting/journal-entries/${id}`, {
    authMode: "appwrite",
    parse: parseJournalEntry,
  });

  return response.data;
}

export async function updateJournalEntry(
  id: string,
  payload: UpdateJournalEntryPayload,
): Promise<JournalEntry> {
  const response = await apiRequest<JournalEntry, BackendJournalEntryPayload>(
    `/api/v1/accounting/journal-entries/${id}`,
    {
      authMode: "appwrite",
      body: journalEntryPayload(payload),
      method: "PATCH",
      parse: parseJournalEntry,
    },
  );

  return response.data;
}

export async function postJournalEntry(id: string): Promise<JournalEntry> {
  const response = await apiRequest<JournalEntry>(`/api/v1/accounting/journal-entries/${id}/post`, {
    authMode: "appwrite",
    method: "POST",
    parse: parseJournalEntry,
  });

  return response.data;
}

export async function reverseJournalEntry(id: string): Promise<JournalEntry> {
  const response = await apiRequest<JournalEntry>(
    `/api/v1/accounting/journal-entries/${id}/reverse`,
    {
      authMode: "appwrite",
      method: "POST",
      parse: parseJournalEntry,
    },
  );

  return response.data;
}

export async function getGeneralLedgerReport(
  filters: GeneralLedgerFilters,
): Promise<GeneralLedgerResponse> {
  const response = await apiRequest<GeneralLedgerResponse>(
    `/api/v1/accounting/reports/general-ledger${toQueryString({
      account_id: filters.accountId,
      branch_id: filters.branchId,
      date_from: filters.dateFrom,
      date_to: filters.dateTo,
      limit: filters.limit,
      page: filters.page,
      sort_order: filters.sortOrder,
    })}`,
    {
      authMode: "appwrite",
      parse: parseGeneralLedgerResponse,
    },
  );

  return response.data;
}

export async function getTrialBalanceReport(
  filters: TrialBalanceFilters,
): Promise<TrialBalanceResponse> {
  const response = await apiRequest<TrialBalanceResponse>(
    `/api/v1/accounting/reports/trial-balance${toQueryString({
      branch_id: filters.branchId,
      date_from: filters.dateFrom,
      date_to: filters.dateTo,
      include_zero_balances: filters.includeZeroBalances,
    })}`,
    {
      authMode: "appwrite",
      parse: parseTrialBalanceResponse,
    },
  );

  return response.data;
}

export async function getProfitLossReport(filters: ProfitLossFilters): Promise<ProfitLossResponse> {
  const response = await apiRequest<ProfitLossResponse>(
    `/api/v1/accounting/reports/profit-loss${toQueryString({
      branch_id: filters.branchId,
      date_from: filters.dateFrom,
      date_to: filters.dateTo,
    })}`,
    {
      authMode: "appwrite",
      parse: parseProfitLossResponse,
    },
  );

  return response.data;
}

export async function getBalanceSheetReport(
  filters: BalanceSheetFilters,
): Promise<BalanceSheetResponse> {
  const response = await apiRequest<BalanceSheetResponse>(
    `/api/v1/accounting/reports/balance-sheet${toQueryString({
      as_of_date: filters.asOfDate,
      branch_id: filters.branchId,
    })}`,
    {
      authMode: "appwrite",
      parse: parseBalanceSheetResponse,
    },
  );

  return response.data;
}

export async function getLedgerDetails(
  filters: LedgerDetailsFilters,
): Promise<LedgerDetailsResponse> {
  const response = await apiRequest<LedgerDetailsResponse>(
    `/api/v1/accounting/chart-of-accounts/${filters.accountId}/ledger-details${toQueryString({
      branch_id: filters.branchId,
      date_from: filters.dateFrom,
      date_to: filters.dateTo,
      limit: filters.limit,
      page: filters.page,
      sort_order: filters.sortOrder,
    })}`,
    {
      authMode: "appwrite",
      parse: parseLedgerDetailsResponse,
    },
  );

  return response.data;
}
