import { apiRequest } from "@/lib/api/client";
import type {
  BatchFilters,
  BatchStatus,
  ConsumePayload,
  CreateBatchPayload,
  CreateProductionPayload,
  ManufacturingBranchOption,
  ManufacturingInventoryOption,
  ManufacturingProductOption,
  ManufacturingRecipeOption,
  ManufacturingSummary,
  ManufacturingUnitOption,
  ProducePayload,
  ProductionBatch,
  ProductionBatchIngredient,
  ProductionBatchPackaging,
  ProductionOutput,
  ProductionPreview,
  ProductionPreviewLineItem,
  ProductionPreviewShortage,
  ProductionWastage,
  UpdateBatchPayload,
  UpdateBatchStatusPayload,
  WastagePayload,
} from "@/types/manufacturing";
import {
  ITEM_STRUCTURES,
  type ItemStructure,
  PRODUCT_TYPES,
  type ProductType,
} from "@/types/product";

type BackendBatchPayload = {
  branch_id?: string;
  recipe_id?: string;
  planned_quantity?: number;
  production_date?: string;
  notes?: string;
};

type BackendCreateProductionPayload = {
  branch_id: string;
  recipe_id: string;
  quantity_produced: number;
  production_date: string;
  notes?: string | null;
};

type BackendConsumePayload = {
  lines: {
    batch_ingredient_id: string;
    consumed_quantity: number;
  }[];
};

type BackendProducePayload = {
  quantity_produced: number;
  production_date?: string;
};

type BackendWastagePayload = {
  inventory_item_id: string;
  wastage_type: string;
  quantity: number;
  reason: string;
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

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function productTypeValue(value: unknown, fallback: ProductType = "finished_product"): ProductType {
  return typeof value === "string" && PRODUCT_TYPES.includes(value as ProductType)
    ? (value as ProductType)
    : fallback;
}

function optionalProductType(value: unknown): ProductType | null {
  return typeof value === "string" && PRODUCT_TYPES.includes(value as ProductType)
    ? (value as ProductType)
    : null;
}

function itemStructureValue(value: unknown, fallback: ItemStructure = "single"): ItemStructure {
  return typeof value === "string" && ITEM_STRUCTURES.includes(value as ItemStructure)
    ? (value as ItemStructure)
    : fallback;
}

function requestString(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function numberValue(value: unknown, fallback = 0): number {
  return typeof value === "number" ? value : fallback;
}

function optionalNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function firstOptionalNumber(...values: unknown[]): number | null {
  for (const value of values) {
    const parsed = optionalNumber(value);
    if (parsed !== null) {
      return parsed;
    }
  }

  return null;
}

function isBatchStatus(value: unknown): value is BatchStatus {
  return (
    value === "draft" ||
    value === "in_progress" ||
    value === "partially_completed" ||
    value === "completed" ||
    value === "cancelled"
  );
}

function branchStatus(value: unknown): "active" | "inactive" {
  return value === "inactive" ? "inactive" : "active";
}

function parseList<TItem>(value: unknown, parser: (item: unknown) => TItem): TItem[] {
  if (Array.isArray(value)) {
    return value.map(parser);
  }

  if (isObject(value)) {
    const keys = ["items", "batches", "ingredients", "packaging", "outputs", "wastage", "data"];
    for (const key of keys) {
      const nextValue = value[key];
      if (Array.isArray(nextValue)) {
        return nextValue.map(parser);
      }
    }
  }

  throw new Error("Backend list payload is invalid.");
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

function parseBatch(value: unknown): ProductionBatch {
  if (!isObject(value)) {
    throw new Error("Backend production batch payload is invalid.");
  }

  return {
    id: stringValue(value.id),
    businessId: stringValue(value.business_id),
    branchId: stringValue(value.branch_id),
    branchName: stringValue(value.branch_name, "Branch"),
    productId: stringValue(value.product_id),
    productName: stringValue(value.product_name, "Product"),
    productVariantId: optionalString(value.product_variant_id),
    productVariantName: optionalString(value.product_variant_name),
    recipeId: stringValue(value.recipe_id),
    recipeName: stringValue(value.recipe_name, "Recipe"),
    recipeVersionNumber: numberValue(value.recipe_version_number),
    batchNumber: stringValue(
      value.production_batch_number,
      stringValue(value.batch_number, "Batch"),
    ),
    plannedQuantity: numberValue(value.planned_quantity),
    producedQuantity: numberValue(value.produced_quantity),
    wastageQuantity: numberValue(value.wastage_quantity),
    batchUnitId: stringValue(value.yield_unit_id, stringValue(value.batch_unit_id)),
    batchUnitName: stringValue(value.yield_unit_symbol, stringValue(value.batch_unit_name, "Unit")),
    status: isBatchStatus(value.status) ? value.status : "draft",
    productionDate: optionalString(value.production_date),
    startTime: optionalString(value.started_at) ?? optionalString(value.start_time),
    endTime: optionalString(value.completed_at) ?? optionalString(value.end_time),
    notes: optionalString(value.notes),
    createdByUserName: stringValue(value.created_by_user_name, "User"),
    createdAt: stringValue(value.created_at),
    updatedAt: stringValue(value.updated_at),
  };
}

function parseIngredient(value: unknown): ProductionBatchIngredient {
  if (!isObject(value)) {
    throw new Error("Backend batch ingredient payload is invalid.");
  }

  return {
    id: stringValue(value.id),
    componentProductId: nullableString(value.component_product_id),
    componentVariantId: nullableString(value.component_variant_id),
    componentProductName: nullableString(value.component_product_name),
    componentVariantName: nullableString(value.component_variant_name),
    componentProductType: optionalProductType(value.component_product_type),
    inventoryItemId: stringValue(value.inventory_item_id),
    itemName: stringValue(value.component_product_name, stringValue(value.item_name, "Ingredient")),
    requiredQuantity: numberValue(value.required_quantity),
    consumedQuantity: numberValue(value.consumed_quantity),
    unitName: stringValue(value.unit_name, "Unit"),
    unitSymbol: stringValue(value.unit_symbol),
    totalCost: numberValue(value.total_cost),
    wastagePercentage: numberValue(value.wastage_percentage),
    unitCostSnapshot: numberValue(value.unit_cost_snapshot),
    stockMovementId: nullableString(value.stock_movement_id),
    accountingJournalEntryId: nullableString(value.accounting_journal_entry_id),
  };
}

function parsePackaging(value: unknown): ProductionBatchPackaging {
  if (!isObject(value)) {
    throw new Error("Backend batch packaging payload is invalid.");
  }

  return {
    id: stringValue(value.id),
    componentProductId: nullableString(value.component_product_id),
    componentVariantId: nullableString(value.component_variant_id),
    componentProductName: nullableString(value.component_product_name),
    componentVariantName: nullableString(value.component_variant_name),
    componentProductType: optionalProductType(value.component_product_type),
    packagingItemId: stringValue(value.packaging_item_id),
    packagingName: stringValue(
      value.component_product_name,
      stringValue(value.packaging_name, "Packaging"),
    ),
    requiredQuantity: numberValue(value.required_quantity),
    consumedQuantity: numberValue(value.consumed_quantity),
    unitName: stringValue(value.unit_name, "Unit"),
    unitSymbol: stringValue(value.unit_symbol),
    unitCostSnapshot: numberValue(value.unit_cost_snapshot),
    totalCost: numberValue(value.total_cost),
    stockMovementId: nullableString(value.stock_movement_id),
    accountingJournalEntryId: nullableString(value.accounting_journal_entry_id),
  };
}

function parseOutput(value: unknown): ProductionOutput {
  if (!isObject(value)) {
    throw new Error("Backend production output payload is invalid.");
  }

  return {
    id: stringValue(value.id),
    productId: nullableString(value.product_id),
    productName: nullableString(value.product_name),
    productVariantId: nullableString(value.product_variant_id),
    productVariantName: nullableString(value.product_variant_name),
    quantityProduced: numberValue(value.quantity_produced),
    unitName: stringValue(value.unit_name, "Unit"),
    unitCostSnapshot: numberValue(value.unit_cost_snapshot),
    totalCost: numberValue(value.total_cost),
    stockMovementId: nullableString(value.stock_movement_id),
    accountingJournalEntryId: nullableString(value.accounting_journal_entry_id),
    createdAt: stringValue(value.created_at),
  };
}

function parseWastage(value: unknown): ProductionWastage {
  if (!isObject(value)) {
    throw new Error("Backend production wastage payload is invalid.");
  }

  return {
    id: stringValue(value.id),
    componentProductId: nullableString(value.component_product_id),
    componentVariantId: nullableString(value.component_variant_id),
    componentProductName: nullableString(value.component_product_name),
    componentVariantName: nullableString(value.component_variant_name),
    componentProductType: optionalProductType(value.component_product_type),
    inventoryItemId: stringValue(value.inventory_item_id),
    itemName: stringValue(value.component_product_name, stringValue(value.item_name, "Item")),
    wastageType: stringValue(value.wastage_type, "wastage"),
    quantity: numberValue(value.quantity),
    unitName: stringValue(value.unit_name, "Unit"),
    reason: stringValue(value.reason, "No reason recorded"),
    unitCostSnapshot: numberValue(value.unit_cost_snapshot),
    totalCost: numberValue(value.total_cost),
    stockMovementId: nullableString(value.stock_movement_id),
    accountingJournalEntryId: nullableString(value.accounting_journal_entry_id),
    createdAt: stringValue(value.created_at),
  };
}

function parseSummary(value: unknown): ManufacturingSummary {
  if (!isObject(value)) {
    throw new Error("Backend manufacturing summary payload is invalid.");
  }

  return {
    totalBatches: numberValue(value.total_batches),
    inProgressBatches: numberValue(value.in_progress_batches),
    completedBatches: numberValue(value.completed_batches),
    totalProductionOutput: numberValue(value.total_production_output),
  };
}

function parsePreviewLineItem(value: unknown): ProductionPreviewLineItem {
  if (!isObject(value)) {
    throw new Error("Backend production preview line payload is invalid.");
  }

  return {
    recipeLineId: stringValue(value.recipe_line_id),
    componentProductId: nullableString(value.component_product_id),
    componentVariantId: nullableString(value.component_variant_id),
    productName: stringValue(value.product_name, "Component"),
    productType: stringValue(value.product_type),
    requiredQuantity: numberValue(value.required_quantity),
    availableQuantity: numberValue(value.available_quantity),
    shortageQuantity: numberValue(value.shortage_quantity),
    unitId: stringValue(value.unit_id),
    unit: stringValue(value.unit, "Unit"),
    estimatedUnitCost: numberValue(value.estimated_unit_cost),
    estimatedTotalCost: numberValue(value.estimated_total_cost),
    isOptional: value.is_optional === true,
  };
}

function parsePreviewShortage(value: unknown): ProductionPreviewShortage {
  if (!isObject(value)) {
    throw new Error("Backend production preview shortage payload is invalid.");
  }

  return {
    recipeLineId: stringValue(value.recipe_line_id),
    productName: stringValue(value.product_name, "Component"),
    requiredQuantity: numberValue(value.required_quantity),
    availableQuantity: numberValue(value.available_quantity),
    shortageQuantity: numberValue(value.shortage_quantity),
    unit: stringValue(value.unit, "Unit"),
  };
}

function parseProductionPreview(value: unknown): ProductionPreview {
  if (!isObject(value)) {
    throw new Error("Backend production preview payload is invalid.");
  }

  return {
    recipeId: stringValue(value.recipe_id),
    recipeName: stringValue(value.recipe_name, "Recipe"),
    recipeYieldQuantity: numberValue(value.recipe_yield_quantity),
    recipeYieldUnitId: stringValue(value.recipe_yield_unit_id),
    recipeYieldUnit: stringValue(value.recipe_yield_unit, "Unit"),
    outputProductId: stringValue(value.output_product_id),
    outputProductName: stringValue(value.output_product_name, "Output product"),
    outputProductVariantId: nullableString(value.output_product_variant_id),
    outputProductVariantName: stringValue(value.output_product_variant_name),
    quantityProduced: numberValue(value.quantity_produced),
    components: parseList(value.components, parsePreviewLineItem),
    packaging: parseList(value.packaging, parsePreviewLineItem),
    estimatedComponentCost: numberValue(value.estimated_component_cost),
    estimatedPackagingCost: numberValue(value.estimated_packaging_cost),
    estimatedTotalCost: numberValue(value.estimated_total_cost),
    estimatedCostPerUnit: numberValue(value.estimated_cost_per_unit),
    hasShortage: value.has_shortage === true,
    shortages: parseList(value.shortages, parsePreviewShortage),
    hasZeroCostWarning: value.has_zero_cost_warning === true,
    warnings: Array.isArray(value.warnings)
      ? value.warnings.filter((warning): warning is string => typeof warning === "string")
      : [],
  };
}

function parseProduct(value: unknown): ManufacturingProductOption {
  if (!isObject(value)) {
    throw new Error("Backend product payload is invalid.");
  }

  return {
    id: stringValue(value.id),
    productName: stringValue(value.product_name, "Product"),
    productCode: stringValue(value.product_code),
    productType: productTypeValue(value.product_type),
    itemStructure: itemStructureValue(value.item_structure),
  };
}

function parseRecipe(value: unknown): ManufacturingRecipeOption {
  if (!isObject(value)) {
    throw new Error("Backend recipe payload is invalid.");
  }

  const isActive = typeof value.is_active === "boolean" ? value.is_active : null;
  const status = typeof value.status === "string" ? value.status : null;

  return {
    id: stringValue(value.id),
    recipeName: stringValue(value.recipe_name, "Recipe"),
    recipeCode: stringValue(value.recipe_code),
    productVariantId: optionalString(value.product_variant_id),
    productVariantName: optionalString(value.product_variant_name),
    versionNumber: numberValue(value.version_number),
    batchYieldQuantity: numberValue(value.batch_yield_quantity),
    batchYieldUnitName: stringValue(value.batch_yield_unit_name, "Unit"),
    componentCount: firstOptionalNumber(
      value.component_count,
      value.components_count,
      value.ingredient_count,
      value.ingredients_count,
      value.ingredient_line_count,
      value.ingredient_lines_count,
      value.bom_ingredient_count,
      value.bom_ingredient_lines_count,
    ),
    packagingCount: firstOptionalNumber(
      value.packaging_count,
      value.packaging_line_count,
      value.packaging_lines_count,
      value.bom_packaging_count,
      value.bom_packaging_lines_count,
    ),
    isActive,
    status,
  };
}

function parseInventory(value: unknown): ManufacturingInventoryOption {
  if (!isObject(value)) {
    throw new Error("Backend inventory payload is invalid.");
  }

  return {
    id: stringValue(value.id),
    productId: nullableString(value.product_id),
    productName: nullableString(value.product_name),
    productVariantId: nullableString(value.product_variant_id),
    productVariantName: nullableString(value.product_variant_name),
    productType: optionalProductType(value.product_type),
    itemName: stringValue(value.item_name, "Inventory item"),
    itemCode: stringValue(value.item_code),
    unitName: stringValue(value.unit_name, "Unit"),
    unitSymbol: stringValue(value.unit_symbol),
  };
}

function parseUnit(value: unknown): ManufacturingUnitOption {
  if (!isObject(value)) {
    throw new Error("Backend unit payload is invalid.");
  }

  return {
    id: stringValue(value.id),
    unitName: stringValue(value.unit_name, "Unit"),
    symbol: stringValue(value.symbol),
  };
}

function parseBranch(value: unknown): ManufacturingBranchOption {
  if (!isObject(value)) {
    throw new Error("Backend branch payload is invalid.");
  }

  const branchName = stringValue(value.branch_name, stringValue(value.name, "Branch"));
  const branchCode = stringValue(value.branch_code, stringValue(value.code));

  return {
    id: stringValue(value.id),
    branchName: branchCode ? `${branchName} (${branchCode})` : branchName,
    status: branchStatus(value.status),
  };
}

function batchPayload(payload: CreateBatchPayload | UpdateBatchPayload): BackendBatchPayload {
  const nextPayload: BackendBatchPayload = {};

  if (payload.branchId !== undefined) nextPayload.branch_id = payload.branchId;
  if (payload.recipeId !== undefined) nextPayload.recipe_id = payload.recipeId;
  if (payload.plannedQuantity !== undefined) nextPayload.planned_quantity = payload.plannedQuantity;
  if (payload.productionDate !== undefined) nextPayload.production_date = payload.productionDate;
  if (payload.notes !== undefined) nextPayload.notes = requestString(payload.notes);

  return nextPayload;
}

function productionPayload(payload: CreateProductionPayload): BackendCreateProductionPayload {
  return {
    branch_id: payload.branchId,
    recipe_id: payload.recipeId,
    quantity_produced: payload.quantityProduced,
    production_date: payload.productionDate,
    notes: payload.notes,
  };
}

function consumePayload(payload: ConsumePayload): BackendConsumePayload {
  return {
    lines: payload.lines.map((line) => ({
      batch_ingredient_id: line.batchIngredientId,
      consumed_quantity: line.consumedQuantity,
    })),
  };
}

function producePayload(payload: ProducePayload): BackendProducePayload {
  const nextPayload: BackendProducePayload = {
    quantity_produced: payload.quantityProduced,
  };

  if (payload.productionDate !== undefined) {
    nextPayload.production_date = payload.productionDate;
  }

  return nextPayload;
}

function wastagePayload(payload: WastagePayload): BackendWastagePayload {
  return {
    inventory_item_id: payload.inventoryItemId,
    wastage_type: payload.wastageType,
    quantity: payload.quantity,
    reason: payload.reason,
  };
}

export async function getBatches(params: BatchFilters): Promise<ProductionBatch[]> {
  const response = await apiRequest<ProductionBatch[]>(
    `/api/v1/manufacturing/batches${toQueryString({
      search: params.search,
      product_id: params.productId,
      branch_id: params.branchId,
      status: params.status,
      date_from: params.dateFrom,
      date_to: params.dateTo,
    })}`,
    {
      authMode: "appwrite",
      parse: (data) => parseList(data, parseBatch),
    },
  );

  return response.data;
}

export async function createBatch(payload: CreateBatchPayload): Promise<ProductionBatch> {
  const response = await apiRequest<ProductionBatch, BackendBatchPayload>(
    "/api/v1/manufacturing/batches",
    {
      method: "POST",
      authMode: "appwrite",
      body: batchPayload(payload),
      parse: parseBatch,
    },
  );

  return response.data;
}

export async function createProduction(payload: CreateProductionPayload): Promise<ProductionBatch> {
  const response = await apiRequest<ProductionBatch, BackendCreateProductionPayload>(
    "/api/v1/manufacturing/productions",
    {
      method: "POST",
      authMode: "appwrite",
      body: productionPayload(payload),
      parse: parseBatch,
    },
  );

  return response.data;
}

export async function getBatchById(id: string): Promise<ProductionBatch> {
  const response = await apiRequest<ProductionBatch>(`/api/v1/manufacturing/batches/${id}`, {
    authMode: "appwrite",
    parse: parseBatch,
  });

  return response.data;
}

export async function updateBatch(
  id: string,
  payload: UpdateBatchPayload,
): Promise<ProductionBatch> {
  const response = await apiRequest<ProductionBatch, BackendBatchPayload>(
    `/api/v1/manufacturing/batches/${id}`,
    {
      method: "PATCH",
      authMode: "appwrite",
      body: batchPayload(payload),
      parse: parseBatch,
    },
  );

  return response.data;
}

export async function updateBatchStatus(
  id: string,
  payload: UpdateBatchStatusPayload,
): Promise<ProductionBatch> {
  const response = await apiRequest<ProductionBatch, { status: BatchStatus }>(
    `/api/v1/manufacturing/batches/${id}/status`,
    {
      method: "PATCH",
      authMode: "appwrite",
      body: payload,
      parse: parseBatch,
    },
  );

  return response.data;
}

export async function deleteBatch(id: string): Promise<void> {
  await apiRequest<void>(`/api/v1/manufacturing/batches/${id}`, {
    method: "DELETE",
    authMode: "appwrite",
    parse: () => undefined,
  });
}

async function postBatchLifecycle(id: string, action: string): Promise<ProductionBatch> {
  const response = await apiRequest<ProductionBatch>(
    `/api/v1/manufacturing/batches/${id}/${action}`,
    {
      method: "POST",
      authMode: "appwrite",
      parse: parseBatch,
    },
  );

  return response.data;
}

export async function startBatch(id: string): Promise<ProductionBatch> {
  return postBatchLifecycle(id, "start");
}

export async function completeBatch(id: string): Promise<ProductionBatch> {
  return postBatchLifecycle(id, "complete");
}

export async function cancelBatch(id: string): Promise<ProductionBatch> {
  return postBatchLifecycle(id, "cancel");
}

export async function consumeBatch(id: string, payload: ConsumePayload): Promise<ProductionBatch> {
  const response = await apiRequest<ProductionBatch, BackendConsumePayload>(
    `/api/v1/manufacturing/batches/${id}/consume`,
    {
      method: "POST",
      authMode: "appwrite",
      body: consumePayload(payload),
      parse: parseBatch,
    },
  );

  return response.data;
}

export async function produceBatch(id: string, payload: ProducePayload): Promise<ProductionBatch> {
  const response = await apiRequest<ProductionBatch, BackendProducePayload>(
    `/api/v1/manufacturing/batches/${id}/produce`,
    {
      method: "POST",
      authMode: "appwrite",
      body: producePayload(payload),
      parse: parseBatch,
    },
  );

  return response.data;
}

export async function addBatchWastage(
  id: string,
  payload: WastagePayload,
): Promise<ProductionWastage> {
  const response = await apiRequest<ProductionWastage, BackendWastagePayload>(
    `/api/v1/manufacturing/batches/${id}/wastage`,
    {
      method: "POST",
      authMode: "appwrite",
      body: wastagePayload(payload),
      parse: parseWastage,
    },
  );

  return response.data;
}

export async function getBatchIngredients(id: string): Promise<ProductionBatchIngredient[]> {
  const response = await apiRequest<ProductionBatchIngredient[]>(
    `/api/v1/manufacturing/batches/${id}/ingredients`,
    {
      authMode: "appwrite",
      parse: (data) => parseList(data, parseIngredient),
    },
  );

  return response.data;
}

export async function getBatchPackaging(id: string): Promise<ProductionBatchPackaging[]> {
  const response = await apiRequest<ProductionBatchPackaging[]>(
    `/api/v1/manufacturing/batches/${id}/packaging`,
    {
      authMode: "appwrite",
      parse: (data) => parseList(data, parsePackaging),
    },
  );

  return response.data;
}

export async function getBatchOutputs(id: string): Promise<ProductionOutput[]> {
  const response = await apiRequest<ProductionOutput[]>(
    `/api/v1/manufacturing/batches/${id}/outputs`,
    {
      authMode: "appwrite",
      parse: (data) => parseList(data, parseOutput),
    },
  );

  return response.data;
}

export async function getBatchWastage(id: string): Promise<ProductionWastage[]> {
  const response = await apiRequest<ProductionWastage[]>(
    `/api/v1/manufacturing/batches/${id}/wastage`,
    {
      authMode: "appwrite",
      parse: (data) => parseList(data, parseWastage),
    },
  );

  return response.data;
}

export async function getManufacturingSummary(): Promise<ManufacturingSummary> {
  const response = await apiRequest<ManufacturingSummary>("/api/v1/manufacturing/summary", {
    authMode: "appwrite",
    parse: parseSummary,
  });

  return response.data;
}

export async function getProductionPreview({
  branchId,
  quantity,
  recipeId,
}: {
  branchId: string;
  quantity: number;
  recipeId: string;
}): Promise<ProductionPreview> {
  const response = await apiRequest<ProductionPreview>(
    `/api/v1/manufacturing/recipes/${recipeId}/production-preview${toQueryString({
      branch_id: branchId,
      quantity,
    })}`,
    {
      authMode: "appwrite",
      parse: parseProductionPreview,
    },
  );

  return response.data;
}

export async function getManufacturingProducts(): Promise<ManufacturingProductOption[]> {
  const response = await apiRequest<ManufacturingProductOption[]>("/api/v1/products?limit=100", {
    authMode: "appwrite",
    parse: (data) => parseList(data, parseProduct),
  });

  return response.data.filter(
    (product) =>
      product.productType === "finished_product" || product.productType === "semi_finished",
  );
}

export async function getManufacturingRecipeByProduct(
  productId: string,
): Promise<ManufacturingRecipeOption[]> {
  const response = await apiRequest<ManufacturingRecipeOption[]>(
    `/api/v1/recipes/product/${productId}`,
    {
      authMode: "appwrite",
      parse: (data) => {
        if (Array.isArray(data) || (isObject(data) && Array.isArray(data.items))) {
          return parseList(data, parseRecipe);
        }
        return [parseRecipe(data)];
      },
    },
  );

  return response.data;
}

export async function getManufacturingInventory(): Promise<ManufacturingInventoryOption[]> {
  const response = await apiRequest<ManufacturingInventoryOption[]>("/api/v1/inventory?limit=100", {
    authMode: "appwrite",
    parse: (data) => parseList(data, parseInventory),
  });

  return response.data;
}

export async function getManufacturingUnits(): Promise<ManufacturingUnitOption[]> {
  const response = await apiRequest<ManufacturingUnitOption[]>("/api/v1/master-data/units", {
    authMode: "appwrite",
    parse: (data) => parseList(data, parseUnit),
  });

  return response.data;
}

export async function getManufacturingBranches(): Promise<ManufacturingBranchOption[]> {
  const response = await apiRequest<ManufacturingBranchOption[]>("/api/v1/branches", {
    authMode: "appwrite",
    parse: (data) => parseList(data, parseBranch),
  });

  return response.data;
}
