export type AccountingAccountType =
  | "asset"
  | "liability"
  | "equity"
  | "income"
  | "cogs"
  | "expense";

export type AccountingAccountStatus = "active" | "inactive";

export type AccountingNormalBalance = "debit" | "credit";

export type ChartAccount = {
  id: string;
  businessId: string;
  branchId: string;
  parentAccountId: string | null;
  parentAccountName: string;
  accountCode: string;
  accountName: string;
  accountType: AccountingAccountType;
  accountGroup: string;
  normalBalance: AccountingNormalBalance;
  description: string;
  isSystemAccount: boolean;
  isControlAccount: boolean;
  /** Grouping row: subtotals its children on statements, never posted to. */
  isHeader: boolean;
  /** True once the account carries journal lines; locks its classification. */
  hasPostings: boolean;
  allowManualPosting: boolean;
  status: AccountingAccountStatus;
  createdAt: string;
  updatedAt: string;
};

export type ChartAccountsFilters = {
  branchId?: string;
  accountGroup: string;
  accountType: AccountingAccountType | "all";
  limit: number;
  page: number;
  parentAccountId: string;
  search: string;
  sortBy: string;
  sortOrder: "asc" | "desc";
  status: AccountingAccountStatus | "all";
};

export type ChartAccountsResponse = {
  items: ChartAccount[];
  limit: number;
  page: number;
  total: number;
  totalPages: number;
};

export type CreateChartAccountPayload = {
  branchId?: string;
  allowManualPosting: boolean;
  accountCode: string;
  accountGroup: string;
  accountName: string;
  accountType: AccountingAccountType;
  description: string;
  isControlAccount: boolean;
  parentAccountId: string | null;
};

export type UpdateChartAccountPayload = {
  allowManualPosting: boolean;
  accountGroup: string;
  accountName: string;
  /** Classification. Only accepted while the account has no postings. */
  accountCode?: string | undefined;
  accountType?: AccountingAccountType | undefined;
  normalBalance?: AccountingNormalBalance | undefined;
  description: string;
  isControlAccount: boolean;
  parentAccountId: string | null;
};

export type UpdateChartAccountStatusPayload = {
  status: AccountingAccountStatus;
};

export type JournalEntryStatus = "draft" | "posted" | "reversed";

export type JournalEntryLine = {
  id: string;
  journalEntryId: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: AccountingAccountType;
  lineNumber: number;
  debitAmount: number;
  creditAmount: number;
  description: string;
};

export type JournalEntry = {
  id: string;
  businessId: string;
  branchId: string | null;
  branchName: string;
  entryNumber: string;
  entryDate: string;
  referenceNumber: string;
  sourceType: string;
  sourceId: string | null;
  narration: string;
  status: JournalEntryStatus;
  totalDebit: number;
  totalCredit: number;
  postedAt: string | null;
  postedByUserId: string | null;
  reversedEntryId: string | null;
  reversedAt: string | null;
  reversedByUserId: string | null;
  lines: JournalEntryLine[];
  createdAt: string;
  updatedAt: string;
};

export type JournalEntriesFilters = {
  branchId: string;
  dateFrom: string;
  dateTo: string;
  journalOrigin: "all" | "manual" | "system";
  limit: number;
  page: number;
  search: string;
  sortBy: string;
  sortOrder: "asc" | "desc";
  sourceType: string;
  status: JournalEntryStatus | "all";
};

export type JournalEntriesResponse = {
  items: JournalEntry[];
  limit: number;
  page: number;
  total: number;
};

export type JournalEntryLinePayload = {
  accountId: string;
  creditAmount: number;
  debitAmount: number;
  description: string;
};

export type CreateJournalEntryPayload = {
  branchId: string | null;
  entryDate: string;
  referenceNumber: string;
  sourceType: "manual";
  sourceId: string | null;
  narration: string;
  lines: JournalEntryLinePayload[];
};

export type UpdateJournalEntryPayload = CreateJournalEntryPayload;

export type AccountingReportAccount = {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: AccountingAccountType;
  normalBalance: AccountingNormalBalance;
};

export type GeneralLedgerFilters = {
  accountId: string;
  branchId: string;
  dateFrom: string;
  dateTo: string;
  limit: number;
  page: number;
  sortOrder: "asc" | "desc";
};

export type GeneralLedgerItem = {
  entryId: string;
  entryNumber: string;
  entryDate: string;
  branchId: string | null;
  branchName: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: AccountingAccountType;
  normalBalance: AccountingNormalBalance;
  referenceNumber: string;
  narration: string;
  lineDescription: string;
  debitAmount: number;
  creditAmount: number;
  runningBalance: number | null;
};

export type GeneralLedgerResponse = {
  account: AccountingReportAccount | null;
  ledgerMode: "combined" | "account";
  showRunningBalance: boolean;
  openingBalance: number;
  periodDebit: number;
  periodCredit: number;
  closingBalance: number;
  items: GeneralLedgerItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type TrialBalanceFilters = {
  branchId: string;
  dateFrom: string;
  dateTo: string;
  includeZeroBalances: boolean;
};

export type TrialBalanceItem = {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: AccountingAccountType;
  accountGroup: string;
  normalBalance: AccountingNormalBalance;
  openingBalance: number;
  periodDebit: number;
  periodCredit: number;
  closingDebit: number;
  closingCredit: number;
};

export type TrialBalanceResponse = {
  dateFrom: string;
  dateTo: string;
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
  items: TrialBalanceItem[];
};

export type ProfitLossFilters = {
  branchId: string;
  dateFrom: string;
  dateTo: string;
};

export type ProfitLossItem = {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: AccountingAccountType;
  accountGroup: string;
  /** Grouping row this account rolls up into; empty when uncategorized. */
  headerAccountCode: string;
  headerAccountName: string;
  amount: number;
};

export type ProfitLossSection = {
  total: number;
  items: ProfitLossItem[];
};

export type ProfitLossResponse = {
  dateFrom: string;
  dateTo: string;
  income: ProfitLossSection;
  cogs: ProfitLossSection;
  grossProfit: number;
  operatingExpenses: ProfitLossSection;
  totalExpenses: number;
  netProfit: number;
};

export type BalanceSheetFilters = {
  asOfDate: string;
  branchId: string;
};

export type BalanceSheetItem = {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: AccountingAccountType;
  accountGroup: string;
  /** Grouping row this account rolls up into; empty when uncategorized. */
  headerAccountCode: string;
  headerAccountName: string;
  amount: number;
  isCalculated: boolean;
};

export type BalanceSheetSection = {
  total: number;
  items: BalanceSheetItem[];
};

export type BalanceSheetResponse = {
  asOfDate: string;
  financialYearStartDate: string;
  assets: BalanceSheetSection;
  liabilities: BalanceSheetSection;
  equity: BalanceSheetSection;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  totalLiabilitiesAndEquity: number;
  isBalanced: boolean;
  difference: number;
};

export type LedgerDetailsFilters = {
  accountId: string;
  branchId: string;
  dateFrom: string;
  dateTo: string;
  limit: number;
  page: number;
  sortOrder: "asc" | "desc";
};

export type LedgerDetailsSummary = {
  openingBalance: number;
  periodDebit: number;
  periodCredit: number;
  closingBalance: number;
  balanceLabel: string;
};

export type LedgerDetailsTransaction = GeneralLedgerItem & {
  sourceType: string;
  sourceId: string | null;
};

export type LedgerDetailsResponse = {
  account: ChartAccount;
  summary: LedgerDetailsSummary;
  transactions: LedgerDetailsTransaction[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type AccountingSettings = {
  financialYearStartMonth: number;
  financialYearStartDay: number;
  financialYearStartLabel: string;
  usesDefaultFinancialYear: boolean;
  booksClosedThrough: string | null;
  booksLockUpdatedBy: string | null;
  booksLockUpdatedAt: string | null;
};

export type UpdateAccountingSettingsPayload = {
  financialYearStartMonth: number;
  financialYearStartDay: number;
};

export type UpdatePeriodLockPayload = {
  closedThrough: string | null;
  reason: string;
};

export type YearEndCloseBranch = {
  branchId: string;
  branchName: string;
  journalEntryId: string;
  entryNumber: string;
  netProfit: number;
};

export type FinancialYearStatus = "closed" | "open" | "current";

export type FinancialYear = {
  financialYearStart: string;
  financialYearEnd: string;
  status: FinancialYearStatus;
  branches: YearEndCloseBranch[];
};

export type YearEndClosePreviewBranch = {
  branchId: string;
  branchName: string;
  netProfit: number;
  lineCount: number;
};

export type YearEndClosePreview = {
  financialYearStart: string;
  financialYearEnd: string;
  branches: YearEndClosePreviewBranch[];
};

export type YearEndCloseResult = {
  financialYearStart: string;
  financialYearEnd: string;
  branches: YearEndCloseBranch[];
};

export type AccountMapping = {
  mappingKey: string;
  description: string;
  chartAccountId: string | null;
  chartAccountCode: string;
  chartAccountName: string;
  chartAccountType: AccountingAccountType | null;
  chartAccountGroup: string;
  isMapped: boolean;
  isRequired: boolean;
};

export type AccountMappingsResponse = {
  items: AccountMapping[];
};

export type UpdateAccountMappingsPayload = {
  mappings: Record<string, string>;
};

export type AccountingReconciliationFilters = {
  asOfDate: string;
  branchId: string;
};

export type AccountingReconciliationItem = {
  id: string;
  label: string;
  status: string;
  isMatched: boolean;
  difference: number;
  operationalAmount: number;
  ledgerAmount: number;
  details: string;
};

export type AccountingReconciliationResponse = {
  asOfDate: string;
  branchId: string | null;
  items: AccountingReconciliationItem[];
};

export type AccountingBackfillTarget =
  | "bakery_order_payments"
  | "bakery_orders"
  | "expenses"
  | "manufacturing_batches"
  | "payment_refunds"
  | "pos_sale_payments"
  | "pos_sales"
  | "purchase_invoices"
  | "purchase_returns"
  | "sale_movement_costs"
  | "sales_returns"
  | "stock_movements"
  | "supplier_payments";

export type AccountingBackfillFilters = {
  branchId: string;
  dateFrom: string;
  dateTo: string;
  limit: number;
  targets: AccountingBackfillTarget[];
};

export type AccountingReadinessIssueDetails = Record<string, string | number | boolean | null>;

export type AccountingBackfillReadinessIssue = {
  severity: string;
  code: string;
  message: string;
  target: string;
  details: AccountingReadinessIssueDetails;
};

export type AccountingBackfillReadinessTarget = {
  target: string;
  candidateCount: number;
  wouldPostCount: number;
  blockedCount: number;
};

export type AccountingBackfillReadinessResponse = {
  ready: boolean;
  issues: AccountingBackfillReadinessIssue[];
  targets: AccountingBackfillReadinessTarget[];
};

export type AccountingSetupReadinessResponse = {
  ready: boolean;
  issues: AccountingBackfillReadinessIssue[];
  checkedAt: string;
};

export type AccountingBackfillPayload = AccountingBackfillFilters & {
  dryRun: boolean;
};

export type AccountingBackfillTargetResult = {
  target: string;
  scannedCount: number;
  wouldPostCount: number;
  postedCount: number;
  skippedCount: number;
  failedCount: number;
  errors: string[];
};

export type AccountingBackfillResponse = {
  dryRun: boolean;
  results: AccountingBackfillTargetResult[];
};

export type PaymentAccountType =
  | "cash"
  | "bank"
  | "card_clearing"
  | "platform_clearing"
  | "wallet"
  | "store_credit"
  | "other";

export const PAYMENT_ACCOUNT_TYPE_LABELS: Record<PaymentAccountType, string> = {
  cash: "Cash",
  bank: "Bank",
  card_clearing: "Card Clearing",
  platform_clearing: "Platform Clearing",
  wallet: "Wallet",
  store_credit: "Store Credit",
  other: "Other",
};

export type PaymentAccount = {
  id: string;
  businessId: string;
  branchId: string | null;
  branchName: string;
  accountName: string;
  accountType: PaymentAccountType;
  chartAccountId: string;
  chartAccountCode: string;
  chartAccountName: string;
  chartAccountType: AccountingAccountType;
  chartAccountAllowManualPosting: boolean;
  description: string;
  currentBalance: number;
  balanceLabel: string;
  openingBalance: number;
  openingBalanceDate: string | null;
  openingJournalEntryId: string | null;
  status: AccountingAccountStatus;
  createdAt: string;
  updatedAt: string;
};

export type PaymentAccountsFilters = {
  accountType: PaymentAccountType | "all";
  branchId: string;
  limit: number;
  page: number;
  search: string;
  sortBy: string;
  sortOrder: "asc" | "desc";
  status: AccountingAccountStatus | "all";
};

export type PaymentAccountsResponse = {
  items: PaymentAccount[];
  limit: number;
  page: number;
  total: number;
};

export type SeedPaymentAccountsResponse = {
  createdPaymentAccounts: number;
  linkedPaymentMethods: number;
};

export type PaymentAccountPayload = {
  accountName: string;
  accountType: PaymentAccountType;
  branchId: string | null;
  chartAccountId: string;
  description: string;
  status: AccountingAccountStatus;
  openingBalance: number;
  openingBalanceDate: string | null;
};

export type AccountTransfer = {
  id: string;
  businessId: string;
  branchId: string | null;
  branchName: string;
  transferNumber: string;
  transferDate: string;
  fromPaymentAccountId: string;
  fromPaymentAccountName: string;
  toPaymentAccountId: string;
  toPaymentAccountName: string;
  amount: number;
  referenceNumber: string;
  notes: string;
  status: string;
  journalEntryId: string | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
};

export type AccountTransfersFilters = {
  branchId: string;
  dateFrom: string;
  dateTo: string;
  limit: number;
  page: number;
  paymentAccountId: string;
  sortOrder: "asc" | "desc";
};

export type AccountTransfersResponse = {
  items: AccountTransfer[];
  limit: number;
  page: number;
  total: number;
};

export type AccountTransferPayload = {
  amount: number;
  branchId: string | null;
  fromPaymentAccountId: string;
  notes: string;
  referenceNumber: string;
  toPaymentAccountId: string;
  transferDate: string;
};

export type PlatformSettlementDeductionPayload = {
  amount: number;
  deductionType: string;
  description: string;
  expenseAccountId: string;
};

export type PlatformSettlementDeduction = PlatformSettlementDeductionPayload & {
  id: string;
  expenseAccountCode: string;
  expenseAccountName: string;
};

export type PlatformSettlement = {
  id: string;
  businessId: string;
  branchId: string | null;
  branchName: string;
  settlementNumber: string;
  settlementDate: string;
  platformPaymentAccountId: string;
  platformPaymentAccountName: string;
  depositPaymentAccountId: string;
  depositPaymentAccountName: string;
  grossAmount: number;
  deductionsTotal: number;
  netReceivedAmount: number;
  deductions: PlatformSettlementDeduction[];
  referenceNumber: string;
  notes: string;
  status: string;
  journalEntryId: string | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
};

export type PlatformSettlementsFilters = {
  branchId: string;
  dateFrom: string;
  dateTo: string;
  depositPaymentAccountId: string;
  limit: number;
  page: number;
  platformPaymentAccountId: string;
  sortOrder: "asc" | "desc";
};

export type PlatformSettlementsResponse = {
  items: PlatformSettlement[];
  limit: number;
  page: number;
  total: number;
};

export type PlatformSettlementPayload = {
  branchId: string | null;
  deductions: PlatformSettlementDeductionPayload[];
  depositPaymentAccountId: string;
  grossAmount: number;
  netReceivedAmount: number;
  notes: string;
  platformPaymentAccountId: string;
  referenceNumber: string;
  settlementDate: string;
};

/**
 * Opening balances (Phase 6 / W1).
 *
 * Every opening books against 3400 Opening Balance Equity, so once the whole
 * opening trial balance is entered 3400 nets to zero. `unallocatedOpeningEquity`
 * is what is left — the figure an operator works down at go-live.
 */
export type ChartAccountOpening = {
  accountCode: string;
  accountName: string;
  accountType: string;
  amount: number;
  branchId: string;
  chartAccountId: string;
  id: string;
  journalEntryId: string | null;
  normalBalance: string;
  openingDate: string;
};

export type CounterpartyOpening = {
  amount: number;
  branchId: string;
  id: string;
  journalEntryId: string | null;
  openingDate: string;
  partyId: string;
  partyName: string;
  partyType: "customer" | "supplier";
};

export type OpeningBalanceSummary = {
  branchId: string;
  chartAccountOpeningTotal: number;
  customerOpeningTotal: number;
  isBalanced: boolean;
  openingBalanceEquity: number;
  paymentAccountOpeningTotal: number;
  supplierOpeningTotal: number;
  unallocatedOpeningEquity: number;
};

export type ChartAccountOpeningPayload = {
  amount: number;
  chartAccountId: string;
  openingDate: string;
};

export type CounterpartyOpeningPayload = {
  amount: number;
  openingDate: string;
  partyId: string;
  partyType: "customer" | "supplier";
};
