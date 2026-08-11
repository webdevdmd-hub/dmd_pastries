import { apiRequest } from "@/lib/api/client";
import type {
  CurrentStockRow,
  ExpiryReportRow,
  InventoryAccountingReconciliationReport,
  InventoryAccountingReconciliationRow,
  InventoryAccountingReconciliationStatus,
  InventoryAccountingUnassignedLine,
  InventoryAuditRow,
  InventoryMovementReportRow,
  InventoryReportFilters,
  InventoryReportPagination,
  InventorySummary,
  InventoryTrendChart,
  LowStockRow,
  PackagingStockRow,
  StockValuationRow,
  WastageReport,
  WastageReportItem,
} from "@/types/inventory-reports";

type BackendInventorySummary = {
  active_inventory_items?: number;
  expiring_soon_count?: number;
  expiry_tracked_count?: number;
  low_stock_count?: number;
  out_of_stock_count?: number;
  total_inventory_items?: number;
  total_stock_value?: number;
};

type BackendCurrentStockRow = {
  available_quantity?: number;
  branch_id?: string;
  branch_name?: string;
  current_quantity?: number;
  inventory_item_id?: string;
  is_low_stock?: boolean;
  is_out_of_stock?: boolean;
  item_code?: string;
  item_name?: string;
  item_type?: string;
  reorder_level?: number;
  reserved_quantity?: number;
  status?: string;
  unit_symbol?: string;
};

type BackendStockValuationRow = {
  branch_name?: string;
  current_quantity?: number;
  inventory_item_id?: string;
  item_name?: string;
  item_type?: string;
  stock_value?: number;
  unit_cost?: number;
  unit_symbol?: string;
};

type BackendLowStockRow = {
  available_quantity?: number;
  branch_name?: string;
  inventory_item_id?: string;
  item_name?: string;
  reorder_level?: number;
  shortage_quantity?: number;
  unit_symbol?: string;
};

type BackendExpiryReportRow = {
  batch_id?: string;
  batch_number?: string;
  branch_name?: string;
  days_remaining?: number;
  expiry_date?: string;
  expiry_state?: string;
  expiry_state_label?: string;
  inventory_item_id?: string;
  item_name?: string;
  quantity?: number;
  received_date?: string;
  status?: string;
  unit_symbol?: string;
};

type BackendInventoryMovementReportRow = {
  after_quantity?: number;
  before_quantity?: number;
  branch_name?: string;
  created_by?: string;
  date?: string;
  item_name?: string;
  item_type?: string;
  movement_direction?: string;
  movement_id?: string;
  movement_type?: string;
  quantity?: number;
  reference_number?: string;
  unit_symbol?: string;
};

type BackendWastageReportItem = {
  branch_name?: string;
  created_at?: string;
  item_name?: string;
  item_type?: string;
  quantity?: number;
  reason?: string;
  unit_symbol?: string;
};

type BackendWastageReport = {
  items?: unknown;
  total_wastage_quantity?: number;
  wastage_value?: number;
};

type BackendPackagingStockRow = {
  available_quantity?: number;
  branch_name?: string;
  category_name?: string;
  cost_per_unit?: number;
  current_quantity?: number;
  is_low_stock?: boolean;
  packaging_item_id?: string;
  packaging_name?: string;
  reorder_level?: number;
  stock_value?: number;
  unit_symbol?: string;
};

type BackendInventoryAuditRow = {
  branch_name?: string;
  calculated_quantity_from_movements?: number;
  current_quantity?: number;
  difference?: number;
  inventory_item_id?: string;
  is_balanced?: boolean;
  item_name?: string;
};

type BackendPagination = {
  limit?: number;
  page?: number;
  total?: number;
  total_pages?: number;
};

type BackendInventoryAccountingReconciliationRow = {
  accounting_inventory_value?: number;
  branch_id?: string;
  branch_name?: string;
  difference_amount?: number;
  inventory_item_id?: string;
  inventory_ledger_value?: number;
  item_name?: string;
  item_type?: string;
  last_transaction_at?: string;
  last_transaction_id?: string | null;
  last_transaction_reference?: string;
  last_transaction_type?: string;
  operational_inventory_value?: number;
  operational_quantity?: number;
  pending_accounting_count?: number;
  pending_accounting_value?: number;
  possible_reason?: string;
  possible_reason_key?: string;
  product_id?: string | null;
  product_variant_id?: string | null;
  status?: string;
  stock_location_id?: string | null;
  stock_location_name?: string;
};

type BackendInventoryAccountingUnassignedLine = {
  branch_id?: string | null;
  branch_name?: string;
  credit_amount?: number;
  debit_amount?: number;
  journal_entry_date?: string;
  journal_entry_id?: string;
  journal_entry_number?: string;
  line_description?: string;
  narration?: string;
  reason_label?: string;
  reference_number?: string;
  signed_inventory_amount?: number;
  source_id?: string | null;
  source_type?: string;
};

type BackendInventoryAccountingReconciliationReport = {
  as_of_date?: string;
  branch_id?: string;
  general_ledger_inventory_balance?: number;
  items?: unknown;
  matched_count?: number;
  mismatch_count?: number;
  pagination?: unknown;
  total_accounting_inventory_value?: number;
  total_inventory_ledger_value?: number;
  total_operational_value?: number;
  unassigned_accounting_line_count?: number;
  unassigned_accounting_lines?: unknown;
  unassigned_accounting_difference?: number;
};

type BackendTrend = {
  datasets?: unknown;
  labels?: unknown;
};

type BackendTrendDataset = {
  data?: unknown;
  label?: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function numberOrZero(value: unknown): number {
  return typeof value === "number" ? value : 0;
}

function stringOrEmpty(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function booleanOrFalse(value: unknown): boolean {
  return typeof value === "boolean" ? value : false;
}

function listSource(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value;
  }

  if (!isObject(value)) {
    return [];
  }

  if (Array.isArray(value.items)) {
    return value.items;
  }

  if (Array.isArray(value.rows)) {
    return value.rows;
  }

  return [];
}

function parseList<TItem>(value: unknown, parser: (item: unknown) => TItem): TItem[] {
  const source = listSource(value);

  return Array.isArray(source) ? source.map(parser) : [];
}

function toSearchParams(filters: InventoryReportFilters): string {
  const params = new URLSearchParams();
  const entries: [string, number | string | undefined][] = [
    ["as_of_date", filters.asOfDate],
    ["branch_id", filters.branchId],
    ["item_type", filters.itemType],
    ["date_from", filters.dateFrom],
    ["date_to", filters.dateTo],
    ["expiry_state", filters.expiryState],
    ["status", filters.status],
    ["timezone", filters.timezone],
    ["page", filters.page],
    ["limit", filters.limit],
    ["sort_by", filters.sortBy],
    ["sort_order", filters.sortOrder],
  ];

  entries.forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  });

  const query = params.toString();

  return query ? `?${query}` : "";
}

function parseInventorySummary(value: unknown): InventorySummary {
  const row = isObject(value) ? (value as BackendInventorySummary) : {};

  return {
    activeInventoryItems: numberOrZero(row.active_inventory_items),
    expiringSoonCount: numberOrZero(row.expiring_soon_count),
    expiryTrackedCount: numberOrZero(row.expiry_tracked_count),
    lowStockCount: numberOrZero(row.low_stock_count),
    outOfStockCount: numberOrZero(row.out_of_stock_count),
    totalInventoryItems: numberOrZero(row.total_inventory_items),
    totalStockValue: numberOrZero(row.total_stock_value),
  };
}

function parseCurrentStockRow(value: unknown): CurrentStockRow {
  const row = isObject(value) ? (value as BackendCurrentStockRow) : {};

  return {
    availableQuantity: numberOrZero(row.available_quantity),
    branchId: stringOrEmpty(row.branch_id),
    branchName: stringOrEmpty(row.branch_name),
    currentQuantity: numberOrZero(row.current_quantity),
    inventoryItemId: stringOrEmpty(row.inventory_item_id),
    isLowStock: booleanOrFalse(row.is_low_stock),
    isOutOfStock: booleanOrFalse(row.is_out_of_stock),
    itemCode: stringOrEmpty(row.item_code),
    itemName: stringOrEmpty(row.item_name),
    itemType: stringOrEmpty(row.item_type),
    reorderLevel: numberOrZero(row.reorder_level),
    reservedQuantity: numberOrZero(row.reserved_quantity),
    status: stringOrEmpty(row.status),
    unitSymbol: stringOrEmpty(row.unit_symbol),
  };
}

function parseStockValuationRow(value: unknown): StockValuationRow {
  const row = isObject(value) ? (value as BackendStockValuationRow) : {};

  return {
    branchName: stringOrEmpty(row.branch_name),
    currentQuantity: numberOrZero(row.current_quantity),
    inventoryItemId: stringOrEmpty(row.inventory_item_id),
    itemName: stringOrEmpty(row.item_name),
    itemType: stringOrEmpty(row.item_type),
    stockValue: numberOrZero(row.stock_value),
    unitCost: numberOrZero(row.unit_cost),
    unitSymbol: stringOrEmpty(row.unit_symbol),
  };
}

function parseLowStockRow(value: unknown): LowStockRow {
  const row = isObject(value) ? (value as BackendLowStockRow) : {};

  return {
    availableQuantity: numberOrZero(row.available_quantity),
    branchName: stringOrEmpty(row.branch_name),
    inventoryItemId: stringOrEmpty(row.inventory_item_id),
    itemName: stringOrEmpty(row.item_name),
    reorderLevel: numberOrZero(row.reorder_level),
    shortageQuantity: numberOrZero(row.shortage_quantity),
    unitSymbol: stringOrEmpty(row.unit_symbol),
  };
}

function parseExpiryReportRow(value: unknown): ExpiryReportRow {
  const row = isObject(value) ? (value as BackendExpiryReportRow) : {};

  return {
    batchId: stringOrEmpty(row.batch_id),
    batchNumber: stringOrEmpty(row.batch_number),
    branchName: stringOrEmpty(row.branch_name),
    daysRemaining: numberOrZero(row.days_remaining),
    expiryDate: stringOrEmpty(row.expiry_date),
    expiryState: stringOrEmpty(row.expiry_state),
    expiryStateLabel: stringOrEmpty(row.expiry_state_label),
    inventoryItemId: stringOrEmpty(row.inventory_item_id),
    itemName: stringOrEmpty(row.item_name),
    quantity: numberOrZero(row.quantity),
    receivedDate: stringOrEmpty(row.received_date),
    status: stringOrEmpty(row.status),
    unitSymbol: stringOrEmpty(row.unit_symbol),
  };
}

function parseInventoryMovementRow(value: unknown): InventoryMovementReportRow {
  const row = isObject(value) ? (value as BackendInventoryMovementReportRow) : {};

  return {
    afterQuantity: numberOrZero(row.after_quantity),
    beforeQuantity: numberOrZero(row.before_quantity),
    branchName: stringOrEmpty(row.branch_name),
    createdBy: stringOrEmpty(row.created_by),
    date: stringOrEmpty(row.date),
    itemName: stringOrEmpty(row.item_name),
    itemType: stringOrEmpty(row.item_type),
    movementDirection: stringOrEmpty(row.movement_direction),
    movementId: stringOrEmpty(row.movement_id),
    movementType: stringOrEmpty(row.movement_type),
    quantity: numberOrZero(row.quantity),
    referenceNumber: stringOrEmpty(row.reference_number),
    unitSymbol: stringOrEmpty(row.unit_symbol),
  };
}

function parseWastageReportItem(value: unknown): WastageReportItem {
  const row = isObject(value) ? (value as BackendWastageReportItem) : {};

  return {
    branchName: stringOrEmpty(row.branch_name),
    createdAt: stringOrEmpty(row.created_at),
    itemName: stringOrEmpty(row.item_name),
    itemType: stringOrEmpty(row.item_type),
    quantity: numberOrZero(row.quantity),
    reason: stringOrEmpty(row.reason),
    unitSymbol: stringOrEmpty(row.unit_symbol),
  };
}

function parseWastageReport(value: unknown): WastageReport {
  const row = isObject(value) ? (value as BackendWastageReport) : {};

  return {
    items: parseList(row.items, parseWastageReportItem),
    totalWastageQuantity: numberOrZero(row.total_wastage_quantity),
    wastageValue: numberOrZero(row.wastage_value),
  };
}

function parsePackagingStockRow(value: unknown): PackagingStockRow {
  const row = isObject(value) ? (value as BackendPackagingStockRow) : {};

  return {
    availableQuantity: numberOrZero(row.available_quantity),
    branchName: stringOrEmpty(row.branch_name),
    categoryName: stringOrEmpty(row.category_name),
    costPerUnit: numberOrZero(row.cost_per_unit),
    currentQuantity: numberOrZero(row.current_quantity),
    isLowStock: booleanOrFalse(row.is_low_stock),
    packagingItemId: stringOrEmpty(row.packaging_item_id),
    packagingName: stringOrEmpty(row.packaging_name),
    reorderLevel: numberOrZero(row.reorder_level),
    stockValue: numberOrZero(row.stock_value),
    unitSymbol: stringOrEmpty(row.unit_symbol),
  };
}

function parseInventoryAuditRow(value: unknown): InventoryAuditRow {
  const row = isObject(value) ? (value as BackendInventoryAuditRow) : {};

  return {
    branchName: stringOrEmpty(row.branch_name),
    calculatedQuantityFromMovements: numberOrZero(row.calculated_quantity_from_movements),
    currentQuantity: numberOrZero(row.current_quantity),
    difference: numberOrZero(row.difference),
    inventoryItemId: stringOrEmpty(row.inventory_item_id),
    isBalanced: booleanOrFalse(row.is_balanced),
    itemName: stringOrEmpty(row.item_name),
  };
}

function parsePagination(value: unknown): InventoryReportPagination {
  const pagination = isObject(value) ? (value as BackendPagination) : {};

  return {
    limit: numberOrZero(pagination.limit),
    page: numberOrZero(pagination.page),
    total: numberOrZero(pagination.total),
    totalPages: numberOrZero(pagination.total_pages),
  };
}

function parseInventoryAccountingReconciliationStatus(
  value: unknown,
): InventoryAccountingReconciliationStatus {
  return value === "matched" ? "matched" : "mismatch";
}

function parseInventoryAccountingReconciliationReasonKey(
  value: unknown,
): InventoryAccountingReconciliationRow["possibleReasonKey"] {
  switch (value) {
    case "matched":
    case "missing_cost":
    case "linked_unposted_journal":
    case "linked_journal_missing_inventory_line":
    case "purchase_return_missing_journal":
    case "pos_cogs_missing_journal":
    case "manufacturing_missing_journal":
    case "adjustment_missing_journal":
    case "pending_bill_posting":
    case "missing_journal":
    case "transfer_location_value_mismatch":
    case "operational_stock_ledger_mismatch":
    case "stock_ledger_accounting_mismatch":
    case "inventory_accounting_mismatch":
      return value;
    default:
      return "inventory_accounting_mismatch";
  }
}

function parseInventoryAccountingReconciliationRow(
  value: unknown,
): InventoryAccountingReconciliationRow {
  const row = isObject(value) ? (value as BackendInventoryAccountingReconciliationRow) : {};

  return {
    accountingInventoryValue: numberOrZero(row.accounting_inventory_value),
    branchId: stringOrEmpty(row.branch_id),
    branchName: stringOrEmpty(row.branch_name),
    differenceAmount: numberOrZero(row.difference_amount),
    inventoryItemId: stringOrEmpty(row.inventory_item_id),
    inventoryLedgerValue: numberOrZero(row.inventory_ledger_value),
    itemName: stringOrEmpty(row.item_name),
    itemType: stringOrEmpty(row.item_type),
    lastTransactionAt: stringOrEmpty(row.last_transaction_at),
    lastTransactionId: stringOrEmpty(row.last_transaction_id),
    lastTransactionReference: stringOrEmpty(row.last_transaction_reference),
    lastTransactionType: stringOrEmpty(row.last_transaction_type),
    operationalInventoryValue: numberOrZero(row.operational_inventory_value),
    operationalQuantity: numberOrZero(row.operational_quantity),
    pendingAccountingCount: numberOrZero(row.pending_accounting_count),
    pendingAccountingValue: numberOrZero(row.pending_accounting_value),
    possibleReason: stringOrEmpty(row.possible_reason),
    possibleReasonKey: parseInventoryAccountingReconciliationReasonKey(row.possible_reason_key),
    productId: stringOrNull(row.product_id),
    productVariantId: stringOrNull(row.product_variant_id),
    status: parseInventoryAccountingReconciliationStatus(row.status),
    stockLocationId: stringOrNull(row.stock_location_id),
    stockLocationName: stringOrEmpty(row.stock_location_name),
  };
}

function parseInventoryAccountingUnassignedLine(value: unknown): InventoryAccountingUnassignedLine {
  const row = isObject(value) ? (value as BackendInventoryAccountingUnassignedLine) : {};

  return {
    branchId: stringOrNull(row.branch_id),
    branchName: stringOrEmpty(row.branch_name),
    creditAmount: numberOrZero(row.credit_amount),
    debitAmount: numberOrZero(row.debit_amount),
    journalEntryDate: stringOrEmpty(row.journal_entry_date),
    journalEntryId: stringOrEmpty(row.journal_entry_id),
    journalEntryNumber: stringOrEmpty(row.journal_entry_number),
    lineDescription: stringOrEmpty(row.line_description),
    narration: stringOrEmpty(row.narration),
    reasonLabel: stringOrEmpty(row.reason_label),
    referenceNumber: stringOrEmpty(row.reference_number),
    signedInventoryAmount: numberOrZero(row.signed_inventory_amount),
    sourceId: stringOrNull(row.source_id),
    sourceType: stringOrEmpty(row.source_type),
  };
}

function parseInventoryAccountingReconciliationReport(
  value: unknown,
): InventoryAccountingReconciliationReport {
  const report = isObject(value) ? (value as BackendInventoryAccountingReconciliationReport) : {};

  return {
    asOfDate: stringOrEmpty(report.as_of_date),
    branchId: stringOrEmpty(report.branch_id),
    generalLedgerInventoryBalance: numberOrZero(report.general_ledger_inventory_balance),
    items: parseList(report.items, parseInventoryAccountingReconciliationRow),
    matchedCount: numberOrZero(report.matched_count),
    mismatchCount: numberOrZero(report.mismatch_count),
    pagination: parsePagination(report.pagination),
    totalAccountingInventoryValue: numberOrZero(report.total_accounting_inventory_value),
    totalInventoryLedgerValue: numberOrZero(report.total_inventory_ledger_value),
    totalOperationalValue: numberOrZero(report.total_operational_value),
    unassignedAccountingLineCount: numberOrZero(report.unassigned_accounting_line_count),
    unassignedAccountingLines: parseList(
      report.unassigned_accounting_lines,
      parseInventoryAccountingUnassignedLine,
    ),
    unassignedAccountingDifference: numberOrZero(report.unassigned_accounting_difference),
  };
}

function parseInventoryTrend(value: unknown): InventoryTrendChart {
  const chart = isObject(value) ? (value as BackendTrend) : {};
  const labels = Array.isArray(chart.labels)
    ? chart.labels.filter((label): label is string => typeof label === "string")
    : [];
  const datasets = Array.isArray(chart.datasets)
    ? chart.datasets.filter(isObject).map((dataset) => {
        const typedDataset = dataset as BackendTrendDataset;

        return {
          data: Array.isArray(typedDataset.data)
            ? typedDataset.data.filter((item): item is number => typeof item === "number")
            : [],
          label: stringOrEmpty(typedDataset.label),
        };
      })
    : [];

  return { datasets, labels };
}

async function getReport<TResponse>(
  path: string,
  filters: InventoryReportFilters,
  parse: (value: unknown) => TResponse,
): Promise<TResponse> {
  const response = await apiRequest<TResponse>(`${path}${toSearchParams(filters)}`, {
    authMode: "appwrite",
    parse,
  });

  return response.data;
}

export async function getInventorySummary(
  filters: InventoryReportFilters,
): Promise<InventorySummary> {
  return getReport("/api/v1/reports/inventory/summary", filters, parseInventorySummary);
}

export async function getCurrentStockReport(
  filters: InventoryReportFilters,
): Promise<CurrentStockRow[]> {
  return getReport("/api/v1/reports/inventory/current-stock", filters, (value) =>
    parseList(value, parseCurrentStockRow),
  );
}

export async function getStockValuationReport(
  filters: InventoryReportFilters,
): Promise<StockValuationRow[]> {
  return getReport("/api/v1/reports/inventory/stock-valuation", filters, (value) =>
    parseList(value, parseStockValuationRow),
  );
}

export async function getLowStockReport(filters: InventoryReportFilters): Promise<LowStockRow[]> {
  return getReport("/api/v1/reports/inventory/low-stock", filters, (value) =>
    parseList(value, parseLowStockRow),
  );
}

export async function getExpiryReport(filters: InventoryReportFilters): Promise<ExpiryReportRow[]> {
  return getReport("/api/v1/reports/inventory/expiry", filters, (value) =>
    parseList(value, parseExpiryReportRow),
  );
}

export async function getInventoryMovementsReport(
  filters: InventoryReportFilters,
): Promise<InventoryMovementReportRow[]> {
  return getReport("/api/v1/reports/inventory/movements", filters, (value) =>
    parseList(value, parseInventoryMovementRow),
  );
}

export async function getWastageReport(filters: InventoryReportFilters): Promise<WastageReport> {
  return getReport("/api/v1/reports/inventory/wastage", filters, parseWastageReport);
}

export async function getPackagingStockReport(
  filters: InventoryReportFilters,
): Promise<PackagingStockRow[]> {
  return getReport("/api/v1/reports/inventory/packaging-stock", filters, (value) =>
    parseList(value, parsePackagingStockRow),
  );
}

export async function getInventoryAuditReport(
  filters: InventoryReportFilters,
): Promise<InventoryAuditRow[]> {
  return getReport("/api/v1/reports/inventory/audit", filters, (value) =>
    parseList(value, parseInventoryAuditRow),
  );
}

export async function getInventoryAccountingReconciliationReport(
  filters: InventoryReportFilters,
): Promise<InventoryAccountingReconciliationReport> {
  return getReport(
    "/api/v1/accounting/reconciliation/inventory/details",
    filters,
    parseInventoryAccountingReconciliationReport,
  );
}

export async function getInventoryTrend(
  filters: InventoryReportFilters,
): Promise<InventoryTrendChart> {
  return getReport("/api/v1/reports/inventory/trend", filters, parseInventoryTrend);
}
