export type InventoryReportItemType = "product" | "product_variant" | "ingredient" | "packaging";

export type InventoryReportSortOrder = "asc" | "desc";

export type InventoryReportFilters = {
  asOfDate?: string;
  branchId?: string;
  dateFrom?: string;
  dateTo?: string;
  expiryState?: "expired" | "expires_today" | "expiring_soon";
  itemType?: InventoryReportItemType;
  limit?: number;
  page?: number;
  sortBy?: string;
  sortOrder?: InventoryReportSortOrder;
  status?: string;
  timezone?: string;
};

export type InventoryReportPagination = {
  limit: number;
  page: number;
  total: number;
  totalPages: number;
};

export type InventorySummary = {
  activeInventoryItems: number;
  expiringSoonCount: number;
  expiryTrackedCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalInventoryItems: number;
  totalStockValue: number;
};

export type CurrentStockRow = {
  availableQuantity: number;
  branchId: string;
  branchName: string;
  currentQuantity: number;
  inventoryItemId: string;
  isLowStock: boolean;
  isOutOfStock: boolean;
  itemCode: string;
  itemName: string;
  itemType: string;
  reorderLevel: number;
  reservedQuantity: number;
  status: string;
  unitSymbol: string;
};

export type StockValuationRow = {
  branchName: string;
  currentQuantity: number;
  inventoryItemId: string;
  itemName: string;
  itemType: string;
  stockValue: number;
  unitCost: number;
  unitSymbol: string;
};

export type LowStockRow = {
  availableQuantity: number;
  branchName: string;
  inventoryItemId: string;
  itemName: string;
  reorderLevel: number;
  shortageQuantity: number;
  unitSymbol: string;
};

export type ExpiryReportRow = {
  batchId: string;
  batchNumber: string;
  branchName: string;
  daysRemaining: number;
  expiryDate: string;
  expiryState: string;
  expiryStateLabel: string;
  inventoryItemId: string;
  itemName: string;
  quantity: number;
  receivedDate: string;
  status: string;
  unitSymbol: string;
};

export type InventoryMovementReportRow = {
  afterQuantity: number;
  beforeQuantity: number;
  branchName: string;
  createdBy: string;
  date: string;
  itemName: string;
  itemType: string;
  movementDirection: string;
  movementId: string;
  movementType: string;
  quantity: number;
  referenceNumber: string;
  unitSymbol: string;
};

export type WastageReportItem = {
  branchName: string;
  createdAt: string;
  itemName: string;
  itemType: string;
  quantity: number;
  reason: string;
  unitSymbol: string;
};

export type WastageReport = {
  items: WastageReportItem[];
  totalWastageQuantity: number;
  wastageValue: number;
};

export type PackagingStockRow = {
  availableQuantity: number;
  branchName: string;
  categoryName: string;
  costPerUnit: number;
  currentQuantity: number;
  isLowStock: boolean;
  packagingItemId: string;
  packagingName: string;
  reorderLevel: number;
  stockValue: number;
  unitSymbol: string;
};

export type InventoryAuditRow = {
  branchName: string;
  calculatedQuantityFromMovements: number;
  currentQuantity: number;
  difference: number;
  inventoryItemId: string;
  isBalanced: boolean;
  itemName: string;
};

export type InventoryAccountingReconciliationStatus = "matched" | "mismatch";
export type InventoryAccountingReconciliationReasonKey =
  | "matched"
  | "missing_cost"
  | "linked_unposted_journal"
  | "linked_journal_missing_inventory_line"
  | "purchase_return_missing_journal"
  | "pos_cogs_missing_journal"
  | "manufacturing_missing_journal"
  | "adjustment_missing_journal"
  | "pending_bill_posting"
  | "missing_journal"
  | "transfer_location_value_mismatch"
  | "operational_stock_ledger_mismatch"
  | "stock_ledger_accounting_mismatch"
  | "inventory_accounting_mismatch";

export type InventoryAccountingReconciliationRow = {
  accountingInventoryValue: number;
  branchId: string;
  branchName: string;
  differenceAmount: number;
  inventoryItemId: string;
  inventoryLedgerValue: number;
  itemName: string;
  itemType: string;
  lastTransactionAt: string;
  lastTransactionId: string;
  lastTransactionReference: string;
  lastTransactionType: string;
  operationalInventoryValue: number;
  operationalQuantity: number;
  pendingAccountingCount: number;
  pendingAccountingValue: number;
  possibleReason: string;
  possibleReasonKey: InventoryAccountingReconciliationReasonKey;
  productId: string | null;
  productVariantId: string | null;
  status: InventoryAccountingReconciliationStatus;
  stockLocationId: string | null;
  stockLocationName: string;
};

export type InventoryAccountingUnassignedLine = {
  branchId: string | null;
  branchName: string;
  creditAmount: number;
  debitAmount: number;
  journalEntryDate: string;
  journalEntryId: string;
  journalEntryNumber: string;
  lineDescription: string;
  narration: string;
  reasonLabel: string;
  referenceNumber: string;
  signedInventoryAmount: number;
  sourceId: string | null;
  sourceType: string;
};

export type InventoryAccountingReconciliationReport = {
  asOfDate: string;
  branchId: string;
  generalLedgerInventoryBalance: number;
  items: InventoryAccountingReconciliationRow[];
  matchedCount: number;
  mismatchCount: number;
  pagination: InventoryReportPagination;
  totalAccountingInventoryValue: number;
  totalInventoryLedgerValue: number;
  totalOperationalValue: number;
  unassignedAccountingLineCount: number;
  unassignedAccountingLines: InventoryAccountingUnassignedLine[];
  unassignedAccountingDifference: number;
};

export type InventoryTrendDataset = {
  data: number[];
  label: string;
};

export type InventoryTrendChart = {
  datasets: InventoryTrendDataset[];
  labels: string[];
};
