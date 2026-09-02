import { apiRequest } from "@/lib/api/client";
import type {
  AccountingAccountStatus,
  AccountingAccountType,
  AccountingBackfillFilters,
  AccountingBackfillPayload,
  AccountingBackfillReadinessIssue,
  AccountingBackfillReadinessResponse,
  AccountingBackfillReadinessTarget,
  AccountingBackfillResponse,
  AccountingBackfillTargetResult,
  AccountingNormalBalance,
  AccountingReconciliationFilters,
  AccountingReconciliationItem,
  AccountingReconciliationResponse,
  AccountingSettings,
  AccountingSetupReadinessResponse,
  AccountMapping,
  AccountMappingsResponse,
  AccountTransfer,
  AccountTransferPayload,
  AccountTransfersFilters,
  AccountTransfersResponse,
  BalanceSheetFilters,
  BalanceSheetItem,
  BalanceSheetResponse,
  BalanceSheetSection,
  ChartAccount,
  ChartAccountOpening,
  ChartAccountOpeningPayload,
  ChartAccountsFilters,
  ChartAccountsResponse,
  CounterpartyOpening,
  CounterpartyOpeningPayload,
  CreateChartAccountPayload,
  CreateJournalEntryPayload,
  FinancialYear,
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
  OpeningBalanceSummary,
  PaymentAccount,
  PaymentAccountPayload,
  PaymentAccountsFilters,
  PaymentAccountsResponse,
  PaymentAccountType,
  PlatformSettlement,
  PlatformSettlementDeduction,
  PlatformSettlementPayload,
  PlatformSettlementsFilters,
  PlatformSettlementsResponse,
  ProfitLossFilters,
  ProfitLossItem,
  ProfitLossResponse,
  ProfitLossSection,
  SeedPaymentAccountsResponse,
  TrialBalanceFilters,
  TrialBalanceItem,
  TrialBalanceResponse,
  UpdateAccountingSettingsPayload,
  UpdateAccountMappingsPayload,
  UpdateChartAccountPayload,
  UpdateChartAccountStatusPayload,
  UpdateJournalEntryPayload,
  UpdatePeriodLockPayload,
  YearEndCloseBranch,
  YearEndClosePreview,
  YearEndCloseResult,
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
  total_pages?: unknown;
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
  branch_id: string;
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
  account_code?: string;
  account_type?: string;
  normal_balance?: string;
  allow_manual_posting: boolean;
  description: string;
  is_control_account: boolean;
  parent_account_id: string | null;
};

type BackendPaymentAccountPayload = {
  account_name?: string;
  account_type?: PaymentAccountType;
  branch_id?: string | null;
  chart_account_id?: string;
  description?: string;
  status?: AccountingAccountStatus;
  opening_balance?: number;
  opening_balance_date?: string | null;
};

type BackendAccountTransferPayload = {
  amount: number;
  branch_id: string | null;
  from_payment_account_id: string;
  notes: string;
  reference_number: string;
  to_payment_account_id: string;
  transfer_date: string;
};

type BackendPlatformSettlementPayload = {
  branch_id: string | null;
  deductions: {
    amount: number;
    deduction_type: string;
    description: string;
    expense_account_id: string;
  }[];
  deposit_payment_account_id: string;
  gross_amount: number;
  net_received_amount: number;
  notes: string;
  platform_payment_account_id: string;
  reference_number: string;
  settlement_date: string;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function isUuid(value: string): boolean {
  return uuidPattern.test(value);
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

function isPaymentAccountType(value: unknown): value is PaymentAccountType {
  return (
    value === "cash" ||
    value === "bank" ||
    value === "card_clearing" ||
    value === "platform_clearing" ||
    value === "wallet" ||
    value === "store_credit" ||
    value === "other"
  );
}

function isJournalEntryStatus(value: unknown): value is JournalEntryStatus {
  return value === "draft" || value === "posted" || value === "reversed";
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function nullableNumberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
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
      totalPages: 1,
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
  const totalPages = numberValue(
    payload.total_pages,
    numberValue(pagination.total_pages, limit > 0 ? Math.ceil(total / limit) : 1),
  );

  return {
    items,
    limit,
    page,
    total,
    totalPages: Math.max(1, totalPages),
  };
}

function parsePaginatedResponse<TItem>(
  value: unknown,
  parser: (item: unknown) => TItem,
  errorMessage: string,
): { items: TItem[]; limit: number; page: number; total: number } {
  if (Array.isArray(value)) {
    return {
      items: value.map(parser),
      limit: value.length || 25,
      page: 1,
      total: value.length,
    };
  }

  if (!isObject(value)) {
    throw new Error(errorMessage);
  }

  const items = parseList(value, parser);
  const pagination = isObject(value.pagination) ? value.pagination : {};

  return {
    items,
    limit: numberValue(value.limit, numberValue(pagination.limit, items.length || 25)),
    page: numberValue(value.page, numberValue(pagination.page, 1)),
    total: numberValue(value.total, numberValue(pagination.total, items.length)),
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
    branchId: stringValue(value.branch_id),
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
    isHeader: booleanValue(value.is_header),
    hasPostings: booleanValue(value.has_postings),
    allowManualPosting: booleanValue(value.allow_manual_posting, true),
    status: isAccountStatus(value.status) ? value.status : "active",
    createdAt: stringValue(value.created_at),
    updatedAt: stringValue(value.updated_at),
  };
}

function parsePaymentAccount(value: unknown): PaymentAccount {
  if (!isObject(value)) {
    throw new Error("Backend payment account payload is invalid.");
  }

  return {
    id: stringValue(value.id),
    businessId: stringValue(value.business_id),
    branchId: optionalString(value.branch_id),
    branchName: stringValue(value.branch_name),
    accountName: stringValue(value.account_name, "Payment account"),
    accountType: isPaymentAccountType(value.account_type) ? value.account_type : "other",
    chartAccountId: stringValue(value.chart_account_id),
    chartAccountCode: stringValue(value.chart_account_code),
    chartAccountName: stringValue(value.chart_account_name, "Chart account"),
    chartAccountType: isAccountType(value.chart_account_type) ? value.chart_account_type : "asset",
    chartAccountAllowManualPosting: booleanValue(value.chart_account_allow_manual_posting, true),
    description: stringValue(value.description),
    currentBalance: numberValue(value.current_balance, 0),
    balanceLabel: stringValue(value.balance_label),
    openingBalance: numberValue(value.opening_balance, 0),
    openingBalanceDate: optionalString(value.opening_balance_date),
    openingJournalEntryId: optionalString(value.opening_journal_entry_id),
    status: isAccountStatus(value.status) ? value.status : "active",
    createdAt: stringValue(value.created_at),
    updatedAt: stringValue(value.updated_at),
  };
}

function parseSeedPaymentAccountsResponse(value: unknown): SeedPaymentAccountsResponse {
  if (!isObject(value)) {
    throw new Error("Backend seed payment accounts payload is invalid.");
  }

  return {
    createdPaymentAccounts: numberValue(value.created_payment_accounts, 0),
    linkedPaymentMethods: numberValue(value.linked_payment_methods, 0),
  };
}

function parseAccountTransfer(value: unknown): AccountTransfer {
  if (!isObject(value)) {
    throw new Error("Backend account transfer payload is invalid.");
  }

  return {
    id: stringValue(value.id),
    businessId: stringValue(value.business_id),
    branchId: optionalString(value.branch_id),
    branchName: stringValue(value.branch_name),
    transferNumber: stringValue(value.transfer_number, "Transfer"),
    transferDate: stringValue(value.transfer_date),
    fromPaymentAccountId: stringValue(value.from_payment_account_id),
    fromPaymentAccountName: stringValue(value.from_payment_account_name, "Source account"),
    toPaymentAccountId: stringValue(value.to_payment_account_id),
    toPaymentAccountName: stringValue(value.to_payment_account_name, "Target account"),
    amount: numberValue(value.amount, 0),
    referenceNumber: stringValue(value.reference_number),
    notes: stringValue(value.notes),
    status: stringValue(value.status, "posted"),
    journalEntryId: optionalString(value.journal_entry_id),
    createdByUserId: stringValue(value.created_by_user_id),
    createdAt: stringValue(value.created_at),
    updatedAt: stringValue(value.updated_at),
  };
}

function parsePlatformSettlementDeduction(value: unknown): PlatformSettlementDeduction {
  if (!isObject(value)) {
    throw new Error("Backend platform settlement deduction payload is invalid.");
  }

  return {
    id: stringValue(value.id),
    expenseAccountId: stringValue(value.expense_account_id),
    expenseAccountCode: stringValue(value.expense_account_code),
    expenseAccountName: stringValue(value.expense_account_name, "Expense account"),
    deductionType: stringValue(value.deduction_type, "fee"),
    description: stringValue(value.description),
    amount: numberValue(value.amount, 0),
  };
}

function parsePlatformSettlement(value: unknown): PlatformSettlement {
  if (!isObject(value)) {
    throw new Error("Backend platform settlement payload is invalid.");
  }

  return {
    id: stringValue(value.id),
    businessId: stringValue(value.business_id),
    branchId: optionalString(value.branch_id),
    branchName: stringValue(value.branch_name),
    settlementNumber: stringValue(value.settlement_number, "Settlement"),
    settlementDate: stringValue(value.settlement_date),
    platformPaymentAccountId: stringValue(value.platform_payment_account_id),
    platformPaymentAccountName: stringValue(
      value.platform_payment_account_name,
      "Platform account",
    ),
    depositPaymentAccountId: stringValue(value.deposit_payment_account_id),
    depositPaymentAccountName: stringValue(value.deposit_payment_account_name, "Deposit account"),
    grossAmount: numberValue(value.gross_amount, 0),
    deductionsTotal: numberValue(value.deductions_total, 0),
    netReceivedAmount: numberValue(value.net_received_amount, 0),
    deductions: Array.isArray(value.deductions)
      ? value.deductions.map(parsePlatformSettlementDeduction)
      : [],
    referenceNumber: stringValue(value.reference_number),
    notes: stringValue(value.notes),
    status: stringValue(value.status, "posted"),
    journalEntryId: optionalString(value.journal_entry_id),
    createdByUserId: stringValue(value.created_by_user_id),
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
    runningBalance: nullableNumberValue(value.running_balance),
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
    ledgerMode: value.ledger_mode === "account" ? "account" : "combined",
    showRunningBalance: value.show_running_balance === true,
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
    headerAccountCode: stringValue(value.header_account_code),
    headerAccountName: stringValue(value.header_account_name),
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
    headerAccountCode: stringValue(value.header_account_code),
    headerAccountName: stringValue(value.header_account_name),
    amount: numberValue(value.amount, 0),
    isCalculated: booleanValue(value.is_calculated),
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
    financialYearStartDate: stringValue(value.financial_year_start_date),
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

function parseAccountingSettings(value: unknown): AccountingSettings {
  if (!isObject(value)) {
    throw new Error("Backend accounting settings payload is invalid.");
  }

  return {
    financialYearStartMonth: numberValue(value.financial_year_start_month, 1),
    financialYearStartDay: numberValue(value.financial_year_start_day, 1),
    financialYearStartLabel: stringValue(value.financial_year_start_label, "January 1"),
    usesDefaultFinancialYear: booleanValue(value.uses_default_financial_year, true),
    booksClosedThrough: optionalString(value.books_closed_through) ?? null,
    booksLockUpdatedBy: optionalString(value.books_lock_updated_by) ?? null,
    booksLockUpdatedAt: optionalString(value.books_lock_updated_at) ?? null,
  };
}

function parseAccountMapping(value: unknown): AccountMapping {
  if (!isObject(value)) {
    throw new Error("Backend account mapping payload is invalid.");
  }

  const chartAccountId = optionalString(value.chart_account_id);

  return {
    mappingKey: stringValue(value.mapping_key, stringValue(value.key)),
    description: stringValue(value.description),
    chartAccountId,
    chartAccountCode: stringValue(value.chart_account_code),
    chartAccountName: stringValue(value.chart_account_name),
    chartAccountType: isAccountType(value.chart_account_type) ? value.chart_account_type : null,
    chartAccountGroup: stringValue(value.chart_account_group),
    isMapped: booleanValue(value.is_mapped, chartAccountId !== null),
    isRequired: booleanValue(value.is_required),
  };
}

function parseAccountMappingsResponse(value: unknown): AccountMappingsResponse {
  // The backend returns a bare array. isObject is true for arrays too, so the
  // wrapped-object branch must not be tried first or it looks for `mappings`
  // on the array, finds nothing, and rejects a perfectly good payload.
  const source =
    isObject(value) && !Array.isArray(value)
      ? (value.mappings ?? value.items ?? value.data)
      : value;

  if (Array.isArray(source)) {
    return {
      items: source.map(parseAccountMapping),
    };
  }

  if (isObject(source)) {
    return {
      items: Object.entries(source).map(([mappingKey, mappingValue]) => {
        if (isObject(mappingValue)) {
          return parseAccountMapping({
            mapping_key: mappingKey,
            ...mappingValue,
          });
        }

        return parseAccountMapping({
          chart_account_id: mappingValue,
          mapping_key: mappingKey,
        });
      }),
    };
  }

  throw new Error("Backend account mappings payload is invalid.");
}

function parseReconciliationItem(value: unknown, index = 0): AccountingReconciliationItem {
  if (!isObject(value)) {
    throw new Error("Backend reconciliation item payload is invalid.");
  }

  /*
   * The identity chain has to cover every shape the five reconciliation
   * endpoints actually return, because only ONE of them nests its rows under a
   * keyed object. /health-check sends `checks: [...]` keyed by `check_key`, and
   * /payment-accounts sends `items: [...]` keyed by `payment_account_id` —
   * neither carries `key` or `name`, so both collapsed onto the literal string
   * "check" for every row. Duplicate React keys on one card, and on the other a
   * list of three payment accounts all captioned "check".
   *
   * `index` is the last resort rather than the first, so a row keeps its
   * identity across a refetch that reorders the list.
   */
  const fallbackId = stringValue(
    value.key,
    stringValue(
      value.check_key,
      stringValue(value.payment_account_id, stringValue(value.name, `check-${String(index)}`)),
    ),
  );
  const status = stringValue(
    value.status,
    booleanValue(value.is_matched) ? "matched" : "unmatched",
  );
  const difference = numberValue(value.difference, 0);

  return {
    id: stringValue(value.id, fallbackId),
    label: stringValue(
      value.label,
      stringValue(
        value.name,
        stringValue(
          value.payment_account_name,
          stringValue(value.chart_account_name, fallbackId.replace(/[_-]/g, " ")),
        ),
      ),
    ),
    status,
    isMatched: booleanValue(
      value.is_matched,
      status.toLowerCase() === "matched" || difference === 0,
    ),
    difference,
    operationalAmount: numberValue(
      value.operational_amount,
      numberValue(value.source_amount, numberValue(value.document_amount, 0)),
    ),
    ledgerAmount: numberValue(value.ledger_amount, numberValue(value.accounting_amount, 0)),
    details: stringValue(value.details, stringValue(value.message, stringValue(value.notes))),
  };
}

function parseReconciliationItems(value: unknown): AccountingReconciliationItem[] {
  if (Array.isArray(value)) {
    return value.map(parseReconciliationItem);
  }

  if (!isObject(value)) {
    return [];
  }

  const directItems = value.items ?? value.checks ?? value.results;
  if (Array.isArray(directItems)) {
    return directItems.map(parseReconciliationItem);
  }

  return Object.entries(value)
    .filter(([, item]) => isObject(item))
    .map(([key, item]) =>
      parseReconciliationItem({
        key,
        ...(item as Record<string, unknown>),
      }),
    );
}

function parseReconciliationResponse(value: unknown): AccountingReconciliationResponse {
  if (!isObject(value)) {
    throw new Error("Backend reconciliation payload is invalid.");
  }

  return {
    asOfDate: stringValue(value.as_of_date),
    branchId: optionalString(value.branch_id),
    items: parseReconciliationItems(value),
  };
}

function parseBackfillReadinessIssue(value: unknown): AccountingBackfillReadinessIssue {
  if (!isObject(value)) {
    throw new Error("Backend backfill readiness issue payload is invalid.");
  }

  return {
    severity: stringValue(value.severity, "warning"),
    code: stringValue(value.check_key, stringValue(value.code)),
    message: stringValue(value.message, "Readiness issue"),
    target: stringValue(value.target),
    details: parseReadinessIssueDetails(value.details),
  };
}

function parseReadinessIssueDetails(value: unknown): AccountingBackfillReadinessIssue["details"] {
  if (!isObject(value)) {
    return {};
  }

  return Object.entries(value).reduce<AccountingBackfillReadinessIssue["details"]>(
    (details, [key, item]) => {
      if (
        typeof item === "string" ||
        typeof item === "number" ||
        typeof item === "boolean" ||
        item === null
      ) {
        details[key] = item;
      } else if (Array.isArray(item)) {
        details[key] = item
          .filter((entry): entry is string | number | boolean | null => {
            return (
              typeof entry === "string" ||
              typeof entry === "number" ||
              typeof entry === "boolean" ||
              entry === null
            );
          })
          .join(", ");
      }

      return details;
    },
    {},
  );
}

function readinessIssueBlocks(issue: AccountingBackfillReadinessIssue): boolean {
  return issue.severity === "error" || issue.severity === "blocking";
}

function parseBackfillReadinessTarget(value: unknown): AccountingBackfillReadinessTarget {
  if (!isObject(value)) {
    throw new Error("Backend backfill readiness target payload is invalid.");
  }

  return {
    target: stringValue(value.target, stringValue(value.key)),
    candidateCount: numberValue(value.candidate_count, numberValue(value.candidates, 0)),
    wouldPostCount: numberValue(value.would_post_count, numberValue(value.would_post, 0)),
    blockedCount: numberValue(value.blocked_count, numberValue(value.blocked, 0)),
  };
}

function parseBackfillReadinessTargets(value: unknown): AccountingBackfillReadinessTarget[] {
  if (Array.isArray(value)) {
    return value.map(parseBackfillReadinessTarget);
  }

  if (!isObject(value)) {
    return [];
  }

  return Object.entries(value).map(([key, target]) => {
    if (isObject(target)) {
      return parseBackfillReadinessTarget({
        key,
        ...target,
      });
    }

    return parseBackfillReadinessTarget({
      candidate_count: target,
      key,
    });
  });
}

function parseBackfillReadinessResponse(value: unknown): AccountingBackfillReadinessResponse {
  if (!isObject(value)) {
    throw new Error("Backend backfill readiness payload is invalid.");
  }

  const issues = Array.isArray(value.issues) ? value.issues.map(parseBackfillReadinessIssue) : [];

  return {
    ready: booleanValue(
      value.ready,
      issues.every((issue) => !readinessIssueBlocks(issue)),
    ),
    issues,
    targets: parseBackfillReadinessTargets(value.targets ?? value.target_counts),
  };
}

function parseAccountingSetupReadinessResponse(value: unknown): AccountingSetupReadinessResponse {
  if (!isObject(value)) {
    throw new Error("Backend accounting setup readiness payload is invalid.");
  }

  const issues = Array.isArray(value.issues) ? value.issues.map(parseBackfillReadinessIssue) : [];

  return {
    ready: booleanValue(
      value.ready,
      issues.every((issue) => !readinessIssueBlocks(issue)),
    ),
    issues,
    checkedAt: stringValue(value.checked_at),
  };
}

function parseBackfillTargetResult(value: unknown): AccountingBackfillTargetResult {
  if (!isObject(value)) {
    throw new Error("Backend backfill target result payload is invalid.");
  }

  const rawErrors = Array.isArray(value.errors) ? value.errors : [];

  return {
    target: stringValue(value.target, stringValue(value.key)),
    scannedCount: numberValue(value.scanned_count, numberValue(value.scanned, 0)),
    wouldPostCount: numberValue(value.would_post_count, numberValue(value.would_post, 0)),
    postedCount: numberValue(value.posted_count, numberValue(value.posted, 0)),
    skippedCount: numberValue(value.skipped_count, numberValue(value.skipped, 0)),
    failedCount: numberValue(value.failed_count, numberValue(value.failed, 0)),
    errors: rawErrors.map((error) => stringValue(error, "Backfill error")),
  };
}

function parseBackfillResponse(value: unknown): AccountingBackfillResponse {
  if (!isObject(value)) {
    throw new Error("Backend backfill payload is invalid.");
  }

  const source = value.results ?? value.targets ?? value.target_results;
  const results = Array.isArray(source)
    ? source.map(parseBackfillTargetResult)
    : parseBackfillReadinessTargets(source).map((target) =>
        parseBackfillTargetResult({
          target: target.target,
          would_post_count: target.wouldPostCount,
        }),
      );

  return {
    dryRun: booleanValue(value.dry_run, true),
    results,
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
    branch_id: payload.branchId ?? "",
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
    // Sent only when the dialog let the user change them, so an ordinary edit
    // of a posted account never trips the reclassification guards.
    ...(payload.accountCode === undefined ? {} : { account_code: payload.accountCode }),
    ...(payload.accountType === undefined ? {} : { account_type: payload.accountType }),
    ...(payload.normalBalance === undefined ? {} : { normal_balance: payload.normalBalance }),
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

function paymentAccountPayload(
  payload: PaymentAccountPayload | Partial<PaymentAccountPayload>,
): BackendPaymentAccountPayload {
  return {
    ...(payload.accountName !== undefined ? { account_name: payload.accountName } : {}),
    ...(payload.accountType !== undefined ? { account_type: payload.accountType } : {}),
    ...(payload.branchId !== undefined ? { branch_id: payload.branchId } : {}),
    ...(payload.chartAccountId !== undefined ? { chart_account_id: payload.chartAccountId } : {}),
    ...(payload.description !== undefined ? { description: payload.description } : {}),
    ...(payload.status !== undefined ? { status: payload.status } : {}),
    ...(payload.openingBalance !== undefined ? { opening_balance: payload.openingBalance } : {}),
    ...(payload.openingBalanceDate !== undefined
      ? { opening_balance_date: payload.openingBalanceDate }
      : {}),
  };
}

function accountTransferPayload(payload: AccountTransferPayload): BackendAccountTransferPayload {
  return {
    amount: payload.amount,
    branch_id: payload.branchId,
    from_payment_account_id: payload.fromPaymentAccountId,
    notes: payload.notes,
    reference_number: payload.referenceNumber,
    to_payment_account_id: payload.toPaymentAccountId,
    transfer_date: payload.transferDate,
  };
}

function platformSettlementPayload(
  payload: PlatformSettlementPayload,
): BackendPlatformSettlementPayload {
  return {
    branch_id: payload.branchId,
    deductions: payload.deductions.map((deduction) => ({
      amount: deduction.amount,
      deduction_type: deduction.deductionType,
      description: deduction.description,
      expense_account_id: deduction.expenseAccountId,
    })),
    deposit_payment_account_id: payload.depositPaymentAccountId,
    gross_amount: payload.grossAmount,
    net_received_amount: payload.netReceivedAmount,
    notes: payload.notes,
    platform_payment_account_id: payload.platformPaymentAccountId,
    reference_number: payload.referenceNumber,
    settlement_date: payload.settlementDate,
  };
}

function accountingSettingsPayload(payload: UpdateAccountingSettingsPayload): {
  financial_year_start_day: number;
  financial_year_start_month: number;
} {
  return {
    financial_year_start_day: payload.financialYearStartDay,
    financial_year_start_month: payload.financialYearStartMonth,
  };
}

function backfillQueryString(filters: AccountingBackfillFilters): string {
  const searchParams = new URLSearchParams();

  if (filters.branchId) {
    searchParams.set("branch_id", filters.branchId);
  }

  if (filters.dateFrom) {
    searchParams.set("date_from", filters.dateFrom);
  }

  if (filters.dateTo) {
    searchParams.set("date_to", filters.dateTo);
  }

  if (filters.limit > 0) {
    searchParams.set("limit", String(filters.limit));
  }

  filters.targets.forEach((target) => {
    searchParams.append("targets", target);
  });

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function backfillPayload(payload: AccountingBackfillPayload): {
  branch_id?: string;
  date_from?: string;
  date_to?: string;
  dry_run: boolean;
  limit: number;
  targets: string[];
} {
  return {
    ...(payload.branchId ? { branch_id: payload.branchId } : {}),
    ...(payload.dateFrom ? { date_from: payload.dateFrom } : {}),
    ...(payload.dateTo ? { date_to: payload.dateTo } : {}),
    dry_run: payload.dryRun,
    limit: payload.limit,
    targets: payload.targets,
  };
}

export async function getChartAccounts(
  filters: ChartAccountsFilters,
): Promise<ChartAccountsResponse> {
  const response = await apiRequest<ChartAccountsResponse>(
    `/api/v1/accounting/chart-of-accounts${toQueryString({
      account_group: filters.accountGroup,
      account_type: filters.accountType,
      branch_id: filters.branchId,
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

function sortChartAccounts(accounts: ChartAccount[]): ChartAccount[] {
  return [...accounts].sort((first, second) => {
    const codeComparison = first.accountCode.localeCompare(second.accountCode, undefined, {
      numeric: true,
      sensitivity: "base",
    });

    if (codeComparison !== 0) {
      return codeComparison;
    }

    return first.accountName.localeCompare(second.accountName, undefined, { sensitivity: "base" });
  });
}

export async function getAllChartAccounts(filters: ChartAccountsFilters): Promise<ChartAccount[]> {
  const pageLimit = 100;
  const firstPage = await getChartAccounts({ ...filters, limit: pageLimit, page: 1 });
  const remainingPages =
    firstPage.totalPages > 1
      ? await Promise.all(
          Array.from({ length: firstPage.totalPages - 1 }, async (_, index) =>
            getChartAccounts({ ...filters, limit: pageLimit, page: index + 2 }),
          ),
        )
      : [];
  const accountsById = new Map<string, ChartAccount>();

  [firstPage, ...remainingPages].forEach((page) => {
    page.items.forEach((account) => {
      accountsById.set(account.id, account);
    });
  });

  return sortChartAccounts(Array.from(accountsById.values()));
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

export async function getAccountingSettings(): Promise<AccountingSettings> {
  const response = await apiRequest<AccountingSettings>("/api/v1/accounting/settings", {
    authMode: "appwrite",
    parse: parseAccountingSettings,
  });

  return response.data;
}

export async function updateAccountingSettings(
  payload: UpdateAccountingSettingsPayload,
): Promise<AccountingSettings> {
  const response = await apiRequest<
    AccountingSettings,
    ReturnType<typeof accountingSettingsPayload>
  >("/api/v1/accounting/settings", {
    authMode: "appwrite",
    body: accountingSettingsPayload(payload),
    method: "PATCH",
    parse: parseAccountingSettings,
  });

  return response.data;
}

export async function updatePeriodLock(
  payload: UpdatePeriodLockPayload,
): Promise<AccountingSettings> {
  const response = await apiRequest<
    AccountingSettings,
    { closed_through: string | null; reason: string }
  >("/api/v1/accounting/period-lock", {
    authMode: "appwrite",
    body: {
      closed_through: payload.closedThrough,
      reason: payload.reason,
    },
    method: "PUT",
    parse: parseAccountingSettings,
  });

  return response.data;
}

function parseYearEndCloseBranch(value: unknown): YearEndCloseBranch {
  if (!isObject(value)) {
    throw new Error("Backend year-end close branch payload is invalid.");
  }

  return {
    branchId: stringValue(value.branch_id),
    branchName: stringValue(value.branch_name),
    journalEntryId: stringValue(value.journal_entry_id),
    entryNumber: stringValue(value.entry_number),
    netProfit: numberValue(value.net_profit, 0),
  };
}

function parseFinancialYear(value: unknown): FinancialYear {
  if (!isObject(value)) {
    throw new Error("Backend financial year payload is invalid.");
  }

  const status = stringValue(value.status, "open");

  return {
    financialYearStart: stringValue(value.financial_year_start),
    financialYearEnd: stringValue(value.financial_year_end),
    status: status === "closed" || status === "current" ? status : "open",
    branches: Array.isArray(value.branches) ? value.branches.map(parseYearEndCloseBranch) : [],
  };
}

function parseFinancialYears(value: unknown): FinancialYear[] {
  if (!isObject(value)) {
    throw new Error("Backend financial years payload is invalid.");
  }

  return Array.isArray(value.items) ? value.items.map(parseFinancialYear) : [];
}

function parseYearEndClosePreview(value: unknown): YearEndClosePreview {
  if (!isObject(value)) {
    throw new Error("Backend year-end close preview payload is invalid.");
  }

  return {
    financialYearStart: stringValue(value.financial_year_start),
    financialYearEnd: stringValue(value.financial_year_end),
    branches: Array.isArray(value.branches)
      ? value.branches.map((branch: unknown) => {
          if (!isObject(branch)) {
            throw new Error("Backend year-end close preview branch payload is invalid.");
          }

          return {
            branchId: stringValue(branch.branch_id),
            branchName: stringValue(branch.branch_name),
            netProfit: numberValue(branch.net_profit, 0),
            lineCount: numberValue(branch.line_count, 0),
          };
        })
      : [],
  };
}

function parseYearEndCloseResult(value: unknown): YearEndCloseResult {
  if (!isObject(value)) {
    throw new Error("Backend year-end close payload is invalid.");
  }

  return {
    financialYearStart: stringValue(value.financial_year_start),
    financialYearEnd: stringValue(value.financial_year_end),
    branches: Array.isArray(value.branches) ? value.branches.map(parseYearEndCloseBranch) : [],
  };
}

export async function getFinancialYears(): Promise<FinancialYear[]> {
  const response = await apiRequest<FinancialYear[]>("/api/v1/accounting/year-end-close", {
    authMode: "appwrite",
    parse: parseFinancialYears,
  });

  return response.data;
}

export async function getYearEndClosePreview(
  financialYearEndDate: string,
): Promise<YearEndClosePreview> {
  const response = await apiRequest<YearEndClosePreview>(
    `/api/v1/accounting/year-end-close/preview?financial_year_end_date=${encodeURIComponent(financialYearEndDate)}`,
    {
      authMode: "appwrite",
      parse: parseYearEndClosePreview,
    },
  );

  return response.data;
}

export async function closeFinancialYear(
  financialYearEndDate: string,
): Promise<YearEndCloseResult> {
  const response = await apiRequest<YearEndCloseResult, { financial_year_end_date: string }>(
    "/api/v1/accounting/year-end-close",
    {
      authMode: "appwrite",
      body: { financial_year_end_date: financialYearEndDate },
      method: "POST",
      parse: parseYearEndCloseResult,
    },
  );

  return response.data;
}

export async function reopenFinancialYear(
  financialYearEndDate: string,
): Promise<YearEndCloseResult> {
  const response = await apiRequest<YearEndCloseResult, { financial_year_end_date: string }>(
    "/api/v1/accounting/year-end-close/reopen",
    {
      authMode: "appwrite",
      body: { financial_year_end_date: financialYearEndDate },
      method: "POST",
      parse: parseYearEndCloseResult,
    },
  );

  return response.data;
}

export async function getAccountMappings(): Promise<AccountMappingsResponse> {
  const response = await apiRequest<AccountMappingsResponse>(
    "/api/v1/accounting/account-mappings",
    {
      authMode: "appwrite",
      parse: parseAccountMappingsResponse,
    },
  );

  return response.data;
}

export async function seedDefaultAccountMappings(): Promise<AccountMappingsResponse> {
  const response = await apiRequest<AccountMappingsResponse>(
    "/api/v1/accounting/account-mappings/seed-defaults",
    {
      authMode: "appwrite",
      method: "POST",
      parse: parseAccountMappingsResponse,
    },
  );

  return response.data;
}

export async function updateAccountMappings(
  payload: UpdateAccountMappingsPayload,
): Promise<AccountMappingsResponse> {
  const response = await apiRequest<AccountMappingsResponse, UpdateAccountMappingsPayload>(
    "/api/v1/accounting/account-mappings",
    {
      authMode: "appwrite",
      body: payload,
      method: "PATCH",
      parse: parseAccountMappingsResponse,
    },
  );

  return response.data;
}

export async function getAccountingReconciliationHealthCheck(
  filters: AccountingReconciliationFilters,
): Promise<AccountingReconciliationResponse> {
  const response = await apiRequest<AccountingReconciliationResponse>(
    `/api/v1/accounting/reconciliation/health-check${toQueryString({
      as_of_date: filters.asOfDate,
      branch_id: filters.branchId,
    })}`,
    {
      authMode: "appwrite",
      parse: parseReconciliationResponse,
    },
  );

  return response.data;
}

export async function getAccountingReconciliationInventory(
  filters: AccountingReconciliationFilters,
): Promise<AccountingReconciliationResponse> {
  const response = await apiRequest<AccountingReconciliationResponse>(
    `/api/v1/accounting/reconciliation/inventory${toQueryString({
      as_of_date: filters.asOfDate,
      branch_id: filters.branchId,
    })}`,
    {
      authMode: "appwrite",
      parse: parseReconciliationResponse,
    },
  );

  return response.data;
}

export async function getAccountingReconciliationAp(
  filters: AccountingReconciliationFilters,
): Promise<AccountingReconciliationResponse> {
  const response = await apiRequest<AccountingReconciliationResponse>(
    `/api/v1/accounting/reconciliation/ap${toQueryString({
      as_of_date: filters.asOfDate,
      branch_id: filters.branchId,
    })}`,
    {
      authMode: "appwrite",
      parse: parseReconciliationResponse,
    },
  );

  return response.data;
}

export async function getAccountingReconciliationAr(
  filters: AccountingReconciliationFilters,
): Promise<AccountingReconciliationResponse> {
  const response = await apiRequest<AccountingReconciliationResponse>(
    `/api/v1/accounting/reconciliation/ar${toQueryString({
      as_of_date: filters.asOfDate,
      branch_id: filters.branchId,
    })}`,
    {
      authMode: "appwrite",
      parse: parseReconciliationResponse,
    },
  );

  return response.data;
}

export async function getAccountingReconciliationPaymentAccounts(
  filters: AccountingReconciliationFilters,
): Promise<AccountingReconciliationResponse> {
  const response = await apiRequest<AccountingReconciliationResponse>(
    `/api/v1/accounting/reconciliation/payment-accounts${toQueryString({
      as_of_date: filters.asOfDate,
      branch_id: filters.branchId,
    })}`,
    {
      authMode: "appwrite",
      parse: parseReconciliationResponse,
    },
  );

  return response.data;
}

export async function getAccountingBackfillReadiness(
  filters: AccountingBackfillFilters,
): Promise<AccountingBackfillReadinessResponse> {
  const response = await apiRequest<AccountingBackfillReadinessResponse>(
    `/api/v1/accounting/backfill-journals/readiness${backfillQueryString(filters)}`,
    {
      authMode: "appwrite",
      parse: parseBackfillReadinessResponse,
    },
  );

  return response.data;
}

export async function getAccountingSetupReadiness(): Promise<AccountingSetupReadinessResponse> {
  const response = await apiRequest<AccountingSetupReadinessResponse>(
    "/api/v1/accounting/setup-readiness",
    {
      authMode: "appwrite",
      parse: parseAccountingSetupReadinessResponse,
    },
  );

  return response.data;
}

export async function runAccountingBackfill(
  payload: AccountingBackfillPayload,
): Promise<AccountingBackfillResponse> {
  const response = await apiRequest<AccountingBackfillResponse, ReturnType<typeof backfillPayload>>(
    "/api/v1/accounting/backfill-journals",
    {
      authMode: "appwrite",
      body: backfillPayload(payload),
      method: "POST",
      parse: parseBackfillResponse,
    },
  );

  return response.data;
}

export async function getJournalEntries(
  filters: JournalEntriesFilters,
): Promise<JournalEntriesResponse> {
  const response = await apiRequest<JournalEntriesResponse>(
    `/api/v1/accounting/journal-entries${toQueryString({
      branch_id: filters.branchId,
      date_from: filters.dateFrom,
      date_to: filters.dateTo,
      journal_origin: filters.journalOrigin,
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

export async function deleteJournalEntry(id: string): Promise<void> {
  await apiRequest<void>(`/api/v1/accounting/journal-entries/${id}`, {
    authMode: "appwrite",
    method: "DELETE",
    parse: () => undefined,
  });
}

export async function getPaymentAccounts(
  filters: PaymentAccountsFilters,
): Promise<PaymentAccountsResponse> {
  const response = await apiRequest<PaymentAccountsResponse>(
    `/api/v1/accounting/payment-accounts${toQueryString({
      account_type: filters.accountType,
      branch_id: filters.branchId,
      limit: filters.limit,
      page: filters.page,
      search: filters.search,
      sort_by: filters.sortBy,
      sort_order: filters.sortOrder,
      status: filters.status,
    })}`,
    {
      authMode: "appwrite",
      parse: (data) =>
        parsePaginatedResponse(
          data,
          parsePaymentAccount,
          "Backend payment accounts list payload is invalid.",
        ),
    },
  );

  return response.data;
}

export async function getPaymentAccountById(id: string): Promise<PaymentAccount> {
  const response = await apiRequest<PaymentAccount>(`/api/v1/accounting/payment-accounts/${id}`, {
    authMode: "appwrite",
    parse: parsePaymentAccount,
  });

  return response.data;
}

export async function createPaymentAccount(
  payload: PaymentAccountPayload,
): Promise<PaymentAccount> {
  const response = await apiRequest<PaymentAccount, BackendPaymentAccountPayload>(
    "/api/v1/accounting/payment-accounts",
    {
      authMode: "appwrite",
      body: paymentAccountPayload(payload),
      method: "POST",
      parse: parsePaymentAccount,
    },
  );

  return response.data;
}

export async function seedDefaultPaymentAccounts(): Promise<SeedPaymentAccountsResponse> {
  const response = await apiRequest<SeedPaymentAccountsResponse>(
    "/api/v1/accounting/payment-accounts/seed-defaults",
    {
      authMode: "appwrite",
      method: "POST",
      parse: parseSeedPaymentAccountsResponse,
    },
  );

  return response.data;
}

export async function updatePaymentAccount(
  id: string,
  payload: Partial<PaymentAccountPayload>,
): Promise<PaymentAccount> {
  const response = await apiRequest<PaymentAccount, BackendPaymentAccountPayload>(
    `/api/v1/accounting/payment-accounts/${id}`,
    {
      authMode: "appwrite",
      body: paymentAccountPayload(payload),
      method: "PATCH",
      parse: parsePaymentAccount,
    },
  );

  return response.data;
}

export async function updatePaymentAccountStatus(
  id: string,
  payload: UpdateChartAccountStatusPayload,
): Promise<PaymentAccount> {
  const response = await apiRequest<PaymentAccount, { status: AccountingAccountStatus }>(
    `/api/v1/accounting/payment-accounts/${id}/status`,
    {
      authMode: "appwrite",
      body: payload,
      method: "PATCH",
      parse: parsePaymentAccount,
    },
  );

  return response.data;
}

export async function deletePaymentAccount(id: string): Promise<void> {
  await apiRequest<void>(`/api/v1/accounting/payment-accounts/${id}`, {
    authMode: "appwrite",
    method: "DELETE",
    parse: () => undefined,
  });
}

export async function getAccountTransfers(
  filters: AccountTransfersFilters,
): Promise<AccountTransfersResponse> {
  const response = await apiRequest<AccountTransfersResponse>(
    `/api/v1/accounting/account-transfers${toQueryString({
      branch_id: filters.branchId,
      date_from: filters.dateFrom,
      date_to: filters.dateTo,
      limit: filters.limit,
      page: filters.page,
      payment_account_id: filters.paymentAccountId,
      sort_order: filters.sortOrder,
    })}`,
    {
      authMode: "appwrite",
      parse: (data) =>
        parsePaginatedResponse(
          data,
          parseAccountTransfer,
          "Backend account transfers list payload is invalid.",
        ),
    },
  );

  return response.data;
}

export async function getAccountTransferById(id: string): Promise<AccountTransfer> {
  const response = await apiRequest<AccountTransfer>(`/api/v1/accounting/account-transfers/${id}`, {
    authMode: "appwrite",
    parse: parseAccountTransfer,
  });

  return response.data;
}

export async function createAccountTransfer(
  payload: AccountTransferPayload,
): Promise<AccountTransfer> {
  const response = await apiRequest<AccountTransfer, BackendAccountTransferPayload>(
    "/api/v1/accounting/account-transfers",
    {
      authMode: "appwrite",
      body: accountTransferPayload(payload),
      method: "POST",
      parse: parseAccountTransfer,
    },
  );

  return response.data;
}

export async function getPlatformSettlements(
  filters: PlatformSettlementsFilters,
): Promise<PlatformSettlementsResponse> {
  const response = await apiRequest<PlatformSettlementsResponse>(
    `/api/v1/accounting/platform-settlements${toQueryString({
      branch_id: filters.branchId,
      date_from: filters.dateFrom,
      date_to: filters.dateTo,
      deposit_payment_account_id: filters.depositPaymentAccountId,
      limit: filters.limit,
      page: filters.page,
      platform_payment_account_id: filters.platformPaymentAccountId,
      sort_order: filters.sortOrder,
    })}`,
    {
      authMode: "appwrite",
      parse: (data) =>
        parsePaginatedResponse(
          data,
          parsePlatformSettlement,
          "Backend platform settlements list payload is invalid.",
        ),
    },
  );

  return response.data;
}

export async function getPlatformSettlementById(id: string): Promise<PlatformSettlement> {
  const response = await apiRequest<PlatformSettlement>(
    `/api/v1/accounting/platform-settlements/${id}`,
    {
      authMode: "appwrite",
      parse: parsePlatformSettlement,
    },
  );

  return response.data;
}

export async function createPlatformSettlement(
  payload: PlatformSettlementPayload,
): Promise<PlatformSettlement> {
  const response = await apiRequest<PlatformSettlement, BackendPlatformSettlementPayload>(
    "/api/v1/accounting/platform-settlements",
    {
      authMode: "appwrite",
      body: platformSettlementPayload(payload),
      method: "POST",
      parse: parsePlatformSettlement,
    },
  );

  return response.data;
}

export async function getGeneralLedgerReport(
  filters: GeneralLedgerFilters,
): Promise<GeneralLedgerResponse> {
  const accountId = filters.accountId.trim();
  if (accountId.length > 0 && !isUuid(accountId)) {
    throw new Error("General Ledger account filter must be a chart account ID.");
  }

  const response = await apiRequest<GeneralLedgerResponse>(
    `/api/v1/accounting/reports/general-ledger${toQueryString({
      account_id: accountId,
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

// --- Opening balances (Phase 6 / W1) ---------------------------------------

function parseChartAccountOpening(value: unknown): ChartAccountOpening {
  const row = (value ?? {}) as Record<string, unknown>;
  return {
    accountCode: stringValue(row.account_code),
    accountName: stringValue(row.account_name),
    accountType: stringValue(row.account_type),
    amount: numberValue(row.amount, 0),
    branchId: stringValue(row.branch_id),
    chartAccountId: stringValue(row.chart_account_id),
    id: stringValue(row.id),
    journalEntryId: optionalString(row.journal_entry_id),
    normalBalance: stringValue(row.normal_balance),
    openingDate: stringValue(row.opening_date),
  };
}

function parseCounterpartyOpening(value: unknown): CounterpartyOpening {
  const row = (value ?? {}) as Record<string, unknown>;
  return {
    amount: numberValue(row.amount, 0),
    branchId: stringValue(row.branch_id),
    id: stringValue(row.id),
    journalEntryId: optionalString(row.journal_entry_id),
    openingDate: stringValue(row.opening_date),
    partyId: stringValue(row.party_id),
    partyName: stringValue(row.party_name),
    partyType: stringValue(row.party_type) === "supplier" ? "supplier" : "customer",
  };
}

function parseOpeningBalanceSummary(value: unknown): OpeningBalanceSummary {
  const row = (value ?? {}) as Record<string, unknown>;
  return {
    branchId: stringValue(row.branch_id),
    chartAccountOpeningTotal: numberValue(row.chart_account_opening_total, 0),
    customerOpeningTotal: numberValue(row.customer_opening_total, 0),
    isBalanced: row.is_balanced === true,
    openingBalanceEquity: numberValue(row.opening_balance_equity, 0),
    paymentAccountOpeningTotal: numberValue(row.payment_account_opening_total, 0),
    supplierOpeningTotal: numberValue(row.supplier_opening_total, 0),
    unallocatedOpeningEquity: numberValue(row.unallocated_opening_equity, 0),
  };
}

function parseItems<TItem>(value: unknown, parse: (item: unknown) => TItem): TItem[] {
  const payload = (value ?? {}) as Record<string, unknown>;
  return Array.isArray(payload.items) ? payload.items.map(parse) : [];
}

export async function getChartAccountOpenings(branchId: string): Promise<ChartAccountOpening[]> {
  const response = await apiRequest<ChartAccountOpening[]>(
    `/api/v1/accounting/opening-balances/accounts${toQueryString({ branch_id: branchId })}`,
    { authMode: "appwrite", parse: (value) => parseItems(value, parseChartAccountOpening) },
  );
  return response.data;
}

export async function saveChartAccountOpening(
  payload: ChartAccountOpeningPayload,
): Promise<ChartAccountOpening> {
  const response = await apiRequest<
    ChartAccountOpening,
    { amount: number; chart_account_id: string; opening_date: string }
  >("/api/v1/accounting/opening-balances/accounts", {
    authMode: "appwrite",
    body: {
      amount: payload.amount,
      chart_account_id: payload.chartAccountId,
      opening_date: payload.openingDate,
    },
    method: "PUT",
    parse: parseChartAccountOpening,
  });
  return response.data;
}

export async function getCounterpartyOpenings(
  branchId: string,
  partyType: string,
): Promise<CounterpartyOpening[]> {
  const response = await apiRequest<CounterpartyOpening[]>(
    `/api/v1/accounting/opening-balances/counterparties${toQueryString({
      branch_id: branchId,
      party_type: partyType,
    })}`,
    { authMode: "appwrite", parse: (value) => parseItems(value, parseCounterpartyOpening) },
  );
  return response.data;
}

export async function saveCounterpartyOpening(
  payload: CounterpartyOpeningPayload,
): Promise<CounterpartyOpening> {
  const response = await apiRequest<
    CounterpartyOpening,
    { amount: number; opening_date: string; party_id: string; party_type: string }
  >("/api/v1/accounting/opening-balances/counterparties", {
    authMode: "appwrite",
    body: {
      amount: payload.amount,
      opening_date: payload.openingDate,
      party_id: payload.partyId,
      party_type: payload.partyType,
    },
    method: "PUT",
    parse: parseCounterpartyOpening,
  });
  return response.data;
}

export async function getOpeningBalanceSummary(branchId: string): Promise<OpeningBalanceSummary> {
  const response = await apiRequest<OpeningBalanceSummary>(
    `/api/v1/accounting/opening-balances/summary${toQueryString({ branch_id: branchId })}`,
    { authMode: "appwrite", parse: parseOpeningBalanceSummary },
  );
  return response.data;
}
