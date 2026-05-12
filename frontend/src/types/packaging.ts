export type PackagingStatus = "active" | "inactive";

export type PackagingCategory = {
  id: string;
  categoryName: string;
  description: string;
  status: PackagingStatus;
};

export type PackagingSupplierOption = {
  id: string;
  supplierName: string;
};

export type PackagingUnitOption = {
  id: string;
  unitName: string;
  symbol: string;
};

export type PackagingItem = {
  id: string;
  businessId: string;
  packagingCode: string;
  packagingName: string;
  packagingCategoryId: string;
  packagingCategoryName: string;
  supplierId: string | null;
  supplierName: string | null;
  unitId: string;
  unitName: string;
  unitSymbol: string;
  costPerUnit: number;
  isStockTracked: boolean;
  isConsumable: boolean;
  reorderLevel: number;
  description: string | null;
  imageUrl: string | null;
  imageFileId: string | null;
  status: PackagingStatus;
  createdByUserName: string;
  createdAt: string;
  updatedAt: string;
};

export type PackagingUsageRule = {
  id: string;
  productId: string;
  productName: string;
  packagingItemId: string;
  packagingName: string;
  quantityRequired: number;
  isDefault: boolean;
  createdAt: string;
};

export type CreatePackagingPayload = {
  packagingName: string;
  packagingCategoryId: string;
  supplierId: string | null;
  unitId: string;
  costPerUnit: number;
  isStockTracked: boolean;
  isConsumable: boolean;
  reorderLevel: number;
  description: string | null;
  imageUrl: string | null;
  imageFileId: string | null;
};

export type UpdatePackagingPayload = Partial<CreatePackagingPayload>;

export type UpdatePackagingStatusPayload = {
  status: PackagingStatus;
};

export type CreatePackagingUsagePayload = {
  packagingItemId: string;
  quantityRequired: number;
  isDefault: boolean;
};

export type PackagingFilters = {
  search: string;
  categoryId: string;
  supplierId: string;
  status: PackagingStatus | "all";
  stockTracked: "all" | "true" | "false";
};

export type PackagingLookupParams = {
  search: string;
  limit?: number;
};
