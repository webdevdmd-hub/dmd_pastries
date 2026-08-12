"use client";

import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, FileText, Lock, Package, Plus, Trash2 } from "lucide-react";
import type { JSX, ReactNode } from "react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { ProductFormDialog } from "@/components/products/product-form-dialog";
import type { SearchableComboboxOption } from "@/components/shared/searchable-combobox";
import { SearchableCombobox } from "@/components/shared/searchable-combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PERMISSIONS } from "@/constants/permissions";
import { usePermission } from "@/hooks/use-permission";
import { useCreateProduct, useProductReferenceData } from "@/hooks/use-products";
import { getErrorMessage } from "@/lib/api/client";
import {
  isLedgerAllowedForContext,
  isPurchasableProduct,
  isSelectableTaxRate,
} from "@/lib/selectors/eligibility";
import { cn } from "@/lib/utils/cn";
import { createUuid } from "@/lib/uuid";
import type { ChartAccount } from "@/types/accounting";
import type { CreateProductPayload, Product } from "@/types/product";
import { PRODUCT_TYPE_LABELS } from "@/types/product";
import type {
  PurchaseItemLineDraft,
  PurchasingProductOption,
  PurchasingTaxRateOption,
  PurchasingUnitOption,
} from "@/types/purchasing";

type PurchasingItemLineEditorProps = {
  accounts?: ChartAccount[];
  allowBatchFields?: boolean;
  billDiscountAmount?: number;
  canCreateProducts?: boolean;
  disableAddRows?: boolean;
  legacyChargeAmount?: number;
  legacyChargeTaxAmount?: number;
  lineErrors?: Record<string, string>;
  lineLocks?: Record<string, { minQuantity: number; receivedQuantity: number }>;
  lines: PurchaseItemLineDraft[];
  onLinesChange: (lines: PurchaseItemLineDraft[]) => void;
  onBillDiscountAmountChange?: (value: number) => void;
  onCreateProductRequest?: (lineId: string) => void;
  paidAmount?: number;
  products: PurchasingProductOption[];
  showAccountRows?: boolean;
  taxRates: PurchasingTaxRateOption[];
  units: PurchasingUnitOption[];
};

function createLine(): PurchaseItemLineDraft {
  return {
    batchNumber: null,
    discountAmount: 0,
    expiryDate: null,
    ingredientId: null,
    itemNameSnapshot: null,
    itemType: "product",
    lineType: "product",
    lineId: createUuid(),
    packagingItemId: null,
    productId: null,
    productVariantId: null,
    quantity: 1,
    taxRateId: null,
    unitCost: 0,
    unitId: "",
  };
}

function createAccountLine(): PurchaseItemLineDraft {
  return {
    accountId: null,
    description: "",
    discountAmount: 0,
    ingredientId: null,
    itemNameSnapshot: "",
    itemType: "account",
    lineId: createUuid(),
    lineType: "account",
    packagingItemId: null,
    productId: null,
    productVariantId: null,
    quantity: 1,
    taxRateId: null,
    unitCost: 0,
    unitId: "",
  };
}

function updateLine(
  lines: PurchaseItemLineDraft[],
  lineId: string,
  patch: Partial<PurchaseItemLineDraft>,
): PurchaseItemLineDraft[] {
  return lines.map((line) => (line.lineId === lineId ? { ...line, ...patch } : line));
}

function lineNetAmount(line: PurchaseItemLineDraft): number {
  return Math.max(line.quantity * line.unitCost - line.discountAmount, 0);
}

function lineTaxAmount(line: PurchaseItemLineDraft, taxRates: PurchasingTaxRateOption[]): number {
  const taxRate = taxRates.find((rate) => rate.id === line.taxRateId);
  const taxableAmount = lineNetAmount(line);

  return taxRate ? taxableAmount * (taxRate.taxPercentage / 100) : 0;
}

function isAccountLine(line: PurchaseItemLineDraft): boolean {
  return line.lineType === "account" || line.itemType === "account" || Boolean(line.accountId);
}

function formatAmount(value: number): string {
  return value.toFixed(2);
}

function withSnapshotOption(
  options: SearchableComboboxOption[],
  selectedValue: string,
  snapshot: string | null | undefined,
): SearchableComboboxOption[] {
  const label = snapshot?.trim();

  if (
    selectedValue.length === 0 ||
    !label ||
    options.some((option) => option.value === selectedValue)
  ) {
    return options;
  }

  return [
    {
      description: "Saved purchase item",
      keywords: [label],
      label,
      value: selectedValue,
    },
    ...options,
  ];
}

function optionSearchText(option: SearchableComboboxOption): string {
  return [option.label, option.description, ...(option.keywords ?? [])]
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .join(" ")
    .toLowerCase();
}

function MiniLabel({ children }: { children: ReactNode }): JSX.Element {
  return (
    <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-workspace-muted">
      {children}
    </span>
  );
}

export function PurchasingItemLineEditor({
  accounts = [],
  allowBatchFields = false,
  billDiscountAmount = 0,
  canCreateProducts = false,
  disableAddRows = false,
  legacyChargeAmount = 0,
  legacyChargeTaxAmount = 0,
  lineErrors = {},
  lineLocks = {},
  lines,
  onLinesChange,
  onBillDiscountAmountChange,
  onCreateProductRequest,
  paidAmount = 0,
  products,
  showAccountRows = false,
  taxRates,
  units,
}: PurchasingItemLineEditorProps): JSX.Element {
  const queryClient = useQueryClient();
  const { hasAnyPermission } = usePermission();
  const [accountSearch, setAccountSearch] = useState("");
  const [productCreateLineId, setProductCreateLineId] = useState<string | null>(null);
  const createProductMutation = useCreateProduct();
  const safeLines = useMemo(() => (lines.length > 0 ? lines : [createLine()]), [lines]);
  const isPurchaseOrderEditor = showAccountRows && !allowBatchFields && !onBillDiscountAmountChange;
  const canCreateProductInEditor =
    !disableAddRows &&
    (canCreateProducts || isPurchaseOrderEditor) &&
    hasAnyPermission([PERMISSIONS.productsCreate]);
  const productReferenceDataQuery = useProductReferenceData(canCreateProductInEditor);
  const productOptions = useMemo<SearchableComboboxOption[]>(
    () =>
      products.filter(isPurchasableProduct).map((product) => ({
        description: [
          PRODUCT_TYPE_LABELS[product.productType],
          product.productCode,
          product.sku,
          product.unitSymbol,
        ]
          .filter(Boolean)
          .join(" / "),
        keywords: [
          product.productName,
          product.productCode,
          product.sku ?? "",
          product.barcode ?? "",
          PRODUCT_TYPE_LABELS[product.productType],
        ],
        label: product.productName,
        value: product.id,
      })),
    [products],
  );
  const unitOptions = useMemo<SearchableComboboxOption[]>(
    () =>
      units.map((unit) => ({
        description: unit.symbol,
        keywords: [unit.unitName, unit.symbol],
        label: `${unit.unitName} (${unit.symbol})`,
        value: unit.id,
      })),
    [units],
  );
  const accountOptions = useMemo<SearchableComboboxOption[]>(
    () =>
      accounts
        .filter((account) => isLedgerAllowedForContext(account, "purchase_line_account"))
        .map((account) => ({
          description: [account.accountType.toUpperCase(), account.accountGroup]
            .filter(Boolean)
            .join(" / "),
          keywords: [
            account.accountCode,
            account.accountName,
            account.accountGroup,
            "freight",
            "carriage inward",
            "delivery expense",
            "loading expense",
            "customs",
            "packaging expense",
            "other direct expense",
          ],
          label: `${account.accountCode} - ${account.accountName}`,
          value: account.id,
        })),
    [accounts],
  );
  const totals = useMemo(() => {
    const subtotal = safeLines.reduce((sum, line) => sum + line.quantity * line.unitCost, 0);
    const discount = safeLines.reduce((sum, line) => sum + line.discountAmount, 0);
    const tax = safeLines.reduce((sum, line) => sum + lineTaxAmount(line, taxRates), 0);
    const legacyCharges = legacyChargeAmount + legacyChargeTaxAmount;
    const total = Math.max(subtotal - discount - billDiscountAmount + tax + legacyCharges, 0);
    const balanceDue = Math.max(total - paidAmount, 0);

    return { balanceDue, discount, legacyCharges, subtotal, tax, total };
  }, [
    billDiscountAmount,
    legacyChargeAmount,
    legacyChargeTaxAmount,
    paidAmount,
    safeLines,
    taxRates,
  ]);
  const accountGroupLabel = useMemo(() => {
    const search = accountSearch.trim().toLowerCase();

    if (search.length === 0) {
      return `Chart accounts (${String(accountOptions.length)})`;
    }

    const matchingAccounts = accountOptions.filter((option) =>
      optionSearchText(option).includes(search),
    ).length;
    return `Matching accounts (${String(matchingAccounts)})`;
  }, [accountOptions, accountSearch]);
  const referenceNotices = useMemo(() => {
    const notices: string[] = [];
    if (products.length === 0) {
      notices.push(
        "No products available — add products in Product Master, or use an account row for non-stock costs.",
      );
    }
    if (units.length === 0) {
      notices.push("No units configured — add a unit of measure before adding product lines.");
    }
    if (taxRates.length === 0) {
      notices.push("No tax rates configured — lines will post without tax until one is added.");
    }
    if (showAccountRows && accounts.length === 0) {
      notices.push(
        "No chart accounts available for account rows — add accounts in the chart of accounts first.",
      );
    }
    return notices;
  }, [accounts.length, products.length, showAccountRows, taxRates.length, units.length]);
  const applyCreatedProductToLine = (product: Product): void => {
    const targetLineId =
      productCreateLineId ??
      safeLines.find((line) => !isAccountLine(line) && !line.productId)?.lineId ??
      safeLines[0]?.lineId;

    if (!targetLineId) return;

    onLinesChange(
      updateLine(safeLines, targetLineId, {
        ingredientId: null,
        itemNameSnapshot: product.productName,
        itemType: "product",
        lineType: "product",
        packagingItemId: null,
        productId: product.id,
        productVariantId: null,
        unitCost: product.costPrice ?? 0,
        unitId: product.unitId,
      }),
    );
  };
  const createProductFromLine = async (payload: CreateProductPayload): Promise<void> => {
    try {
      const createdProduct = await createProductMutation.mutateAsync(payload);
      await queryClient.invalidateQueries({ queryKey: ["purchasing"] });

      if (createdProduct.productType === "service") {
        toast.error("Service products cannot be selected in purchase order product rows.");
        setProductCreateLineId(null);
        return;
      }

      applyCreatedProductToLine(createdProduct);
      setProductCreateLineId(null);
      toast.success("Product created and selected for this purchase order.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <>
      <section className="flex min-h-0 w-full flex-1 flex-col rounded-md border border-workspace-border bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-workspace-border px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-brand-mocha">Item Rates Are</span>
            <Select value="tax-exclusive">
              <SelectTrigger className="h-8 w-36 border-0 border-b border-dashed border-brand-mocha/40 bg-transparent px-0 text-xs font-semibold shadow-none focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tax-exclusive">Tax Exclusive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-brand-mocha">
            Add purchase lines exactly as they should move through receiving and billing.
          </p>
        </div>

        {referenceNotices.length > 0 ? (
          <ul className="space-y-1 border-b border-workspace-border bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {referenceNotices.map((notice) => (
              <li className="flex items-start gap-1.5" key={notice}>
                <AlertTriangle aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{notice}</span>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="min-h-0 w-full flex-1 overflow-x-auto overflow-y-auto">
          <table className="w-full min-w-[1050px] table-fixed border-collapse text-xs">
            <thead>
              <tr className="sticky top-0 z-10 border-b border-workspace-border bg-brand-latte/40 text-left text-xs font-semibold text-brand-mocha">
                <th className="w-[92px] px-1.5 py-2">{showAccountRows ? "Row type" : ""}</th>
                <th className="w-[220px] px-2 py-2">Item Details</th>
                <th className="w-[200px] px-2 py-2">Account</th>
                <th className="w-[64px] px-2 py-2 text-right">Qty</th>
                <th className="w-[78px] px-2 py-2 text-right">Rate</th>
                <th className="w-[78px] px-2 py-2 text-right">Discount</th>
                <th className="w-[118px] px-2 py-2">Tax</th>
                <th className="w-[104px] px-2 py-2">Unit</th>
                <th className="w-[92px] px-2 py-2 text-right">Amount</th>
                <th className="w-[36px] px-1.5 py-2" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {safeLines.map((line, index) => {
                const lineLock = lineLocks[line.lineId];
                const isLineLocked = Boolean(lineLock);
                const lineError = lineErrors[line.lineId];
                const accountLine = showAccountRows && isAccountLine(line);
                const selectedProduct =
                  products.find((product) => product.id === line.productId) ?? null;
                const selectedAccount =
                  accounts.find((account) => account.id === line.accountId) ?? null;
                const activeVariants =
                  selectedProduct?.variants.filter((variant) => variant.status === "active") ?? [];
                const variantOptions = activeVariants.map((variant) => ({
                  description: [variant.sku, variant.barcode].filter(Boolean).join(" / "),
                  keywords: [variant.variantName, variant.sku ?? "", variant.barcode ?? ""],
                  label: variant.variantName,
                  value: variant.id,
                }));
                const isLegacyLine =
                  line.itemType !== "product" ||
                  (!line.productId && Boolean(line.itemNameSnapshot));
                const selectedTaxRate = taxRates.find((rate) => rate.id === line.taxRateId);

                return (
                  <tr
                    className={cn(
                      "border-b border-workspace-border align-top",
                      accountLine ? "border-l-2 border-l-amber-400 bg-amber-50/30" : "border-l-2 border-l-brand-caramel/60",
                      lineError ? "bg-red-50/60" : undefined,
                    )}
                    key={line.lineId}
                  >
                    <td className="px-1.5 py-2 text-brand-mocha">
                      {showAccountRows ? (
                        <Select
                          disabled={disableAddRows || isLineLocked}
                          value={accountLine ? "account" : "product"}
                          onValueChange={(lineType) => {
                            onLinesChange(
                              updateLine(
                                safeLines,
                                line.lineId,
                                lineType === "account"
                                  ? {
                                      ...createAccountLine(),
                                      lineId: line.lineId,
                                    }
                                  : {
                                      ...createLine(),
                                      lineId: line.lineId,
                                    },
                              ),
                            );
                          }}
                        >
                          <SelectTrigger
                            className={cn(
                              "h-8 text-xs font-semibold",
                              accountLine ? "text-amber-800" : "text-brand-espresso",
                            )}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="product">
                              <span className="inline-flex items-center gap-1.5">
                                <Package className="h-3.5 w-3.5" />
                                Product Row
                              </span>
                            </SelectItem>
                            <SelectItem value="account">
                              <span className="inline-flex items-center gap-1.5">
                                <FileText className="h-3.5 w-3.5" />
                                Account Row
                              </span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-brand-mocha">
                          <Package className="h-3.5 w-3.5" />
                          Item {index + 1}
                        </span>
                      )}
                    </td>
                    <td className="bg-brand-latte/10 px-2 py-2">
                      {accountLine ? (
                        <div className="space-y-2">
                          <Input
                            aria-label={`Description for account line ${String(index + 1)}`}
                            className="h-8 text-xs"
                            disabled={isLineLocked}
                            onChange={(event) =>
                              onLinesChange(
                                updateLine(safeLines, line.lineId, {
                                  description: event.target.value,
                                  itemNameSnapshot: event.target.value,
                                }),
                              )
                            }
                            placeholder="Description, e.g. Delivery Charge"
                            value={line.description ?? line.itemNameSnapshot ?? ""}
                          />
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-brand-mocha">
                            <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 font-semibold uppercase tracking-[0.12em] text-amber-800">
                              <FileText className="h-3 w-3" />
                              Account Row
                            </span>
                            {selectedAccount ? <span>{selectedAccount.accountName}</span> : null}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <SearchableCombobox
                            emptyMessage="No matching Product Master items found."
                            disabled={isLineLocked}
                            onValueChange={(productId) => {
                              const selected = products.find((product) => product.id === productId);
                              onLinesChange(
                                updateLine(safeLines, line.lineId, {
                                  ingredientId: null,
                                  itemNameSnapshot:
                                    productId.length === 0 ? null : (selected?.productName ?? null),
                                  itemType: "product",
                                  lineType: "product",
                                  packagingItemId: null,
                                  productId: productId.length === 0 ? null : productId,
                                  productVariantId: null,
                                  unitCost: selected?.costPrice ?? line.unitCost,
                                  unitId: selected?.unitId ?? line.unitId,
                                }),
                              );
                            }}
                            options={withSnapshotOption(
                              productOptions,
                              line.productId ?? "",
                              line.itemNameSnapshot,
                            )}
                            placeholder={line.itemNameSnapshot ?? "Select Product Master item"}
                            renderOption={(option) => {
                              const product = products.find((item) => item.id === option.value);
                              return (
                                <span className="min-w-0 flex-1">
                                  <span className="flex items-center justify-between gap-2">
                                    <span className="block truncate font-medium">
                                      {option.label}
                                    </span>
                                    {product?.costPrice != null ? (
                                      <span className="shrink-0 text-xs font-semibold tabular-nums text-brand-espresso">
                                        {formatAmount(product.costPrice)}
                                      </span>
                                    ) : null}
                                  </span>
                                  {option.description ? (
                                    <span className="block truncate text-xs text-brand-mocha">
                                      {option.description}
                                    </span>
                                  ) : null}
                                </span>
                              );
                            }}
                            searchPlaceholder="Search product, code, SKU, barcode..."
                            triggerClassName="h-8 text-xs"
                            value={line.productId ?? ""}
                          />
                          {canCreateProductInEditor ? (
                            <Button
                              className="h-7 gap-1 rounded-md border border-dashed border-blue-300 bg-blue-50/60 px-2 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                              disabled={isLineLocked}
                              onClick={() => {
                                if (onCreateProductRequest) {
                                  onCreateProductRequest(line.lineId);
                                  return;
                                }
                                setProductCreateLineId(line.lineId);
                              }}
                              type="button"
                              variant="outline"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              Create product
                            </Button>
                          ) : null}
                          {selectedProduct && activeVariants.length > 0 ? (
                            <div>
                              <MiniLabel>Variant</MiniLabel>
                              <SearchableCombobox
                                emptyMessage="No matching variants found."
                                disabled={isLineLocked}
                                onValueChange={(productVariantId) => {
                                  const selectedVariant = activeVariants.find(
                                    (variant) => variant.id === productVariantId,
                                  );
                                  onLinesChange(
                                    updateLine(safeLines, line.lineId, {
                                      itemNameSnapshot:
                                        productVariantId.length === 0
                                          ? selectedProduct.productName
                                          : `${selectedProduct.productName} / ${selectedVariant?.variantName ?? "Variant"}`,
                                      productVariantId:
                                        productVariantId.length === 0 ? null : productVariantId,
                                      unitCost: selectedVariant?.costPrice ?? line.unitCost,
                                    }),
                                  );
                                }}
                                options={variantOptions}
                                placeholder="Select variant"
                                searchPlaceholder="Search variant, SKU, barcode..."
                                triggerClassName="h-8 text-xs"
                                value={line.productVariantId ?? ""}
                              />
                            </div>
                          ) : null}
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-brand-mocha">
                            <span className="inline-flex items-center gap-1 rounded bg-brand-cappuccino/60 px-1.5 py-0.5 font-semibold uppercase tracking-[0.12em] text-brand-espresso">
                              <Package className="h-3 w-3" />
                              {selectedProduct
                                ? PRODUCT_TYPE_LABELS[selectedProduct.productType]
                                : "Product"}
                            </span>
                            {selectedProduct?.productCode ? (
                              <span>{selectedProduct.productCode}</span>
                            ) : null}
                          </div>
                          {isLegacyLine ? (
                            <p className="text-xs text-amber-700">
                              Legacy item saved as {line.itemNameSnapshot ?? "purchase item"}.
                              Select a Product Master item before saving changes.
                            </p>
                          ) : null}
                          {allowBatchFields ? (
                            <div className="grid gap-2 sm:grid-cols-2">
                              <div>
                                <MiniLabel>Batch</MiniLabel>
                                <Input
                                  aria-label="Batch number"
                                  className="h-8"
                                  onChange={(event) =>
                                    onLinesChange(
                                      updateLine(safeLines, line.lineId, {
                                        batchNumber: event.target.value || null,
                                      }),
                                    )
                                  }
                                  placeholder="Batch"
                                  value={line.batchNumber ?? ""}
                                />
                              </div>
                              <div>
                                <MiniLabel>Expiry</MiniLabel>
                                <Input
                                  aria-label="Expiry date"
                                  className="h-8"
                                  onChange={(event) =>
                                    onLinesChange(
                                      updateLine(safeLines, line.lineId, {
                                        expiryDate: event.target.value || null,
                                      }),
                                    )
                                  }
                                  type="date"
                                  value={line.expiryDate ?? ""}
                                />
                              </div>
                            </div>
                          ) : null}
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      {accountLine ? (
                        <SearchableCombobox
                          emptyMessage="No active chart accounts found."
                          contentClassName="w-[min(560px,92vw)]"
                          disabled={isLineLocked}
                          filterOptionsLocally
                          groupLabel={accountGroupLabel}
                          listClassName="max-h-[28rem] overscroll-contain overflow-y-auto"
                          onSearchChange={setAccountSearch}
                          onValueChange={(accountId) => {
                            const selected = accounts.find((account) => account.id === accountId);
                            onLinesChange(
                              updateLine(safeLines, line.lineId, {
                                accountId: accountId.length === 0 ? null : accountId,
                                itemNameSnapshot:
                                  line.description ??
                                  selected?.accountName ??
                                  line.itemNameSnapshot ??
                                  null,
                              }),
                            );
                          }}
                          options={accountOptions}
                          optionTextWrap
                          placeholder="Select account"
                          searchPlaceholder="Search account code, name, type, group..."
                          searchValue={accountSearch}
                          triggerClassName="h-8 text-xs"
                          value={line.accountId ?? ""}
                        />
                      ) : (
                        <div className="rounded-md border border-workspace-border bg-white px-2 py-1.5 text-xs font-semibold text-brand-espresso">
                          Inventory Asset
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        aria-invalid={isLineLocked && Boolean(lineError)}
                        aria-label={`Quantity for item line ${String(index + 1)}`}
                        className="h-8 text-right text-xs tabular-nums"
                        disabled={accountLine && isLineLocked}
                        min={lineLock ? String(lineLock.minQuantity) : "0"}
                        onChange={(event) =>
                          onLinesChange(
                            updateLine(safeLines, line.lineId, {
                              quantity: Number(event.target.value),
                            }),
                          )
                        }
                        type="number"
                        value={line.quantity}
                      />
                      {lineLock ? (
                        <p className="mt-1 flex items-center justify-end gap-1 text-right text-[11px] leading-4 text-amber-700">
                          <Lock aria-hidden="true" className="h-3 w-3 shrink-0" />
                          Received {formatAmount(lineLock.receivedQuantity)} · can&apos;t go lower
                        </p>
                      ) : null}
                      {selectedProduct?.isStockTracked ? (
                        <p className="mt-1 text-right text-[11px] leading-4 text-brand-mocha">
                          Stock
                        </p>
                      ) : null}
                      {lineError ? (
                        <p className="mt-1 text-right text-[11px] font-semibold leading-4 text-red-700">
                          {lineError}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        aria-label={`Rate for item line ${String(index + 1)}`}
                        className="h-8 text-right text-xs tabular-nums"
                        disabled={isLineLocked}
                        min="0"
                        onChange={(event) =>
                          onLinesChange(
                            updateLine(safeLines, line.lineId, {
                              unitCost: Number(event.target.value),
                            }),
                          )
                        }
                        type="number"
                        value={line.unitCost}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        aria-label={`Discount for item line ${String(index + 1)}`}
                        className="h-8 text-right text-xs tabular-nums"
                        disabled={isLineLocked}
                        min="0"
                        onChange={(event) =>
                          onLinesChange(
                            updateLine(safeLines, line.lineId, {
                              discountAmount: Number(event.target.value),
                            }),
                          )
                        }
                        type="number"
                        value={line.discountAmount}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Select
                        disabled={isLineLocked}
                        value={line.taxRateId ?? "none"}
                        onValueChange={(taxRateId) =>
                          onLinesChange(
                            updateLine(safeLines, line.lineId, {
                              taxRateId: taxRateId === "none" ? null : taxRateId,
                            }),
                          )
                        }
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Tax rate" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No tax</SelectItem>
                          {taxRates.filter(isSelectableTaxRate).map((rate) => (
                            <SelectItem key={rate.id} value={rate.id}>
                              {rate.taxName} ({rate.taxPercentage}%)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedTaxRate ? (
                        <p className="mt-1 text-[11px] tabular-nums text-brand-mocha">
                          Tax {formatAmount(lineTaxAmount(line, taxRates))}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-2 py-2">
                      {accountLine ? (
                        <span className="text-xs text-brand-mocha">Not required</span>
                      ) : (
                        <SearchableCombobox
                          emptyMessage="No matching units found."
                          disabled={isLineLocked}
                          onValueChange={(unitId) =>
                            onLinesChange(updateLine(safeLines, line.lineId, { unitId }))
                          }
                          options={unitOptions}
                          placeholder="Select unit"
                          searchPlaceholder="Search unit..."
                          triggerClassName="h-8 text-xs"
                          value={line.unitId}
                        />
                      )}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <span className="inline-flex rounded-md bg-brand-latte/60 px-2 py-1 text-sm font-bold tabular-nums text-brand-espresso">
                        {formatAmount(lineNetAmount(line))}
                      </span>
                    </td>
                    <td className="px-1.5 py-2">
                      <Button
                        aria-label={`Remove item line ${String(index + 1)}`}
                        disabled={disableAddRows || safeLines.length === 1 || isLineLocked}
                        onClick={() =>
                          onLinesChange(safeLines.filter((item) => item.lineId !== line.lineId))
                        }
                        size="icon"
                        type="button"
                        variant="ghost"
                      >
                        <Trash2 className="h-4 w-4 text-red-700" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="grid gap-3 border-t border-workspace-border px-3 py-3 lg:grid-cols-[1fr_430px]">
          <div className="flex flex-wrap items-center gap-2">
            {disableAddRows ? (
              <p className="text-xs text-workspace-muted">
                Adding new lines isn&apos;t available in this mode.
              </p>
            ) : (
              <>
                <Button
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => onLinesChange([...safeLines, createLine()])}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add product row
                </Button>
                {showAccountRows ? (
                  <Button
                    className="h-8 gap-1.5 text-xs"
                    onClick={() => onLinesChange([...safeLines, createAccountLine()])}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add account row
                  </Button>
                ) : null}
                <Button
                  className="h-8 gap-1.5 text-xs"
                  onClick={() =>
                    onLinesChange([...safeLines, createLine(), createLine(), createLine()])
                  }
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add items in bulk
                </Button>
              </>
            )}
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-brand-mocha">Subtotal</span>
              <span className="font-semibold tabular-nums text-brand-espresso">
                {formatAmount(totals.subtotal)}
              </span>
            </div>
            <div className="flex items-start justify-between gap-6 border-t border-workspace-border pt-2">
              <div>
                <span className="text-brand-mocha">Line discounts</span>
                <p className="text-xs text-blue-700">Applied per line</p>
              </div>
              <span className="font-semibold tabular-nums text-red-700">
                -{formatAmount(totals.discount)}
              </span>
            </div>
            {showAccountRows && onBillDiscountAmountChange ? (
              <div className="grid grid-cols-[1fr_150px] items-center gap-3 border-t border-workspace-border pt-2">
                <span className="text-brand-mocha">Bill discount</span>
                <Input
                  aria-label="Bill discount"
                  className="h-9 text-right text-xs tabular-nums"
                  min="0"
                  onChange={(event) => onBillDiscountAmountChange(Number(event.target.value))}
                  type="number"
                  value={billDiscountAmount}
                />
              </div>
            ) : showAccountRows || billDiscountAmount > 0 ? (
              <div className="flex items-center justify-between border-t border-workspace-border pt-2">
                <span className="text-brand-mocha">Bill discount</span>
                <span className="font-semibold tabular-nums text-red-700">
                  -{formatAmount(billDiscountAmount)}
                </span>
              </div>
            ) : null}
            <div className="flex items-center justify-between border-t border-workspace-border pt-2">
              <span className="text-brand-mocha">Tax</span>
              <span className="font-semibold tabular-nums text-brand-espresso">
                {formatAmount(totals.tax)}
              </span>
            </div>
            {totals.legacyCharges > 0 ? (
              <div className="flex items-center justify-between border-t border-workspace-border pt-2">
                <span className="text-brand-mocha">Legacy charges</span>
                <span className="font-semibold tabular-nums text-brand-espresso">
                  {formatAmount(totals.legacyCharges)}
                </span>
              </div>
            ) : null}
            <div className="flex items-center justify-between rounded-md bg-brand-latte px-3 py-2.5 text-base">
              <span className="font-semibold text-brand-mocha">Grand total</span>
              <span className="text-lg font-bold tabular-nums text-brand-espresso">
                {formatAmount(totals.total)}
              </span>
            </div>
            {showAccountRows ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-brand-mocha">Paid</span>
                  <span className="font-semibold tabular-nums text-brand-espresso">
                    {formatAmount(paidAmount)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-brand-mocha">Balance due</span>
                  <span className="font-semibold tabular-nums text-brand-espresso">
                    {formatAmount(totals.balanceDue)}
                  </span>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </section>
      <ProductFormDialog
        onClose={() => setProductCreateLineId(null)}
        onCreate={createProductFromLine}
        onUpdate={() => Promise.resolve()}
        open={productCreateLineId !== null}
        product={null}
        referenceData={
          productReferenceDataQuery.data ?? {
            categories: [],
            taxRates: [],
            units: [],
          }
        }
        submitting={createProductMutation.isPending}
      />
    </>
  );
}
