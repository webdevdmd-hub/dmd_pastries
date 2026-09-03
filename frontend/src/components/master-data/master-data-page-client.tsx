"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Copy,
  ListChecks,
  LoaderCircle,
  MoreHorizontal,
  Plus,
  Ruler,
  Search,
  Shapes,
  ShieldAlert,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import type { JSX, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { useConfirm } from "@/components/app/confirm-provider";
import { MasterDataCardGrid } from "@/components/master-data/master-data-card-grid";
import {
  type MasterDataDetail,
  matchesMasterDataQuery,
  orderStatusDetail,
  paymentStatusDetail,
  productCategoryDetail,
  simpleCategoryDetail,
  unitDetail,
} from "@/components/master-data/master-data-detail";
import { MasterDataDetailsDrawer } from "@/components/master-data/master-data-details-drawer";
import {
  defaultMasterDataFilters,
  type MasterDataFilters,
  MasterDataToolbar,
} from "@/components/master-data/master-data-toolbar";
import { EmptyState } from "@/components/shared/collection-state";
import { FilteredState } from "@/components/shared/collection-state";
import { CollectionStateRow } from "@/components/shared/collection-state-row";
import { PageHeader } from "@/components/shared/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PERMISSIONS } from "@/constants/permissions";
import { useBranchScope } from "@/hooks/use-branch-scope";
import { useBranches } from "@/hooks/use-branches";
import {
  useCopyCategories,
  useCreateOrderStatus,
  useCreatePaymentStatus,
  useCreateProductCategory,
  useCreateSimpleCategory,
  useCreateUnit,
  useDeleteProductCategory,
  useDeleteSimpleCategory,
  useDeleteUnit,
  useOrderStatuses,
  usePaymentStatuses,
  useProductCategories,
  useSimpleCategories,
  useUnitCategories,
  useUnits,
  useUpdateOrderStatus,
  useUpdateOrderStatusStatus,
  useUpdatePaymentStatus,
  useUpdatePaymentStatusStatus,
  useUpdateProductCategory,
  useUpdateProductCategoryStatus,
  useUpdateSimpleCategory,
  useUpdateSimpleCategoryStatus,
  useUpdateUnit,
  useUpdateUnitStatus,
} from "@/hooks/use-master-data";
import { usePermission } from "@/hooks/use-permission";
import { getErrorMessage } from "@/lib/api/client";
import { formatLabel } from "@/lib/format/label";
import type { ProductCategoryIconKey } from "@/lib/product-category-icons";
import {
  getProductCategoryIconForMetadata,
  getProductCategoryIconKey,
  getProductCategoryIconKeyFromMetadata,
  productCategoryIconOptions,
  toProductCategoryIconValue,
} from "@/lib/product-category-icons";
import { type OrderStatusSchema, orderStatusSchema } from "@/lib/validators/order-status.schema";
import {
  type PaymentStatusSchema,
  paymentStatusSchema,
} from "@/lib/validators/payment-status.schema";
import {
  type ProductCategorySchema,
  productCategorySchema,
} from "@/lib/validators/product-category.schema";
import {
  type SimpleCategorySchema,
  simpleCategorySchema,
} from "@/lib/validators/simple-category.schema";
import { type UnitSchema, unitSchema } from "@/lib/validators/unit.schema";
import type { Branch } from "@/types/branch";
import type {
  CategoryCopyType,
  CreateOrderStatusPayload,
  CreatePaymentStatusPayload,
  CreateProductCategoryPayload,
  CreateSimpleCategoryPayload,
  CreateUnitPayload,
  MasterDataCollection,
  OrderStatus,
  PaymentStatus,
  ProductCategory,
  SimpleCategory,
  Unit,
  UnitCategory,
} from "@/types/master-data";
import { PRODUCT_TYPE_LABELS, PRODUCT_TYPES, type ProductType } from "@/types/product";
import type { RecordStatus } from "@/types/settings";

type MasterDataPageClientProps = {
  collection: MasterDataCollection;
};

const titles: Record<MasterDataCollection, string> = {
  units: "Units & Measurements",
  "product-categories": "Product Categories",
  "ingredient-categories": "Ingredient Categories",
  "packaging-categories": "Packaging Categories",
  "order-statuses": "Order Statuses",
  "payment-statuses": "Payment Statuses",
};

const descriptions: Record<MasterDataCollection, string> = {
  units: "Backend-connected units and measurement conversions seeded for the business workspace.",
  "product-categories": "Manage product categories used by catalog setup and POS billing.",
  "ingredient-categories":
    "Backend-connected ingredient category list for raw material organization.",
  "packaging-categories":
    "Backend-connected packaging category list for boxes, cups, trays, and labels.",
  "order-statuses": "Backend-connected order workflow status list.",
  "payment-statuses": "Backend-connected payment status list.",
};

type CopyableCategoryCollection = Extract<
  MasterDataCollection,
  "product-categories" | "ingredient-categories" | "packaging-categories"
>;

const collectionManagePermissions: Record<MasterDataCollection, string[]> = {
  units: [PERMISSIONS.masterDataUnitsManage],
  "product-categories": [PERMISSIONS.masterDataProductCategoriesManage],
  "ingredient-categories": [PERMISSIONS.masterDataIngredientCategoriesManage],
  "packaging-categories": [PERMISSIONS.masterDataPackagingCategoriesManage],
  "order-statuses": [PERMISSIONS.masterDataOrderStatusesManage],
  "payment-statuses": [PERMISSIONS.masterDataPaymentStatusesManage],
};

const categoryCopyTypeByCollection: Record<CopyableCategoryCollection, CategoryCopyType> = {
  "product-categories": "product_categories",
  "ingredient-categories": "ingredient_categories",
  "packaging-categories": "packaging_categories",
};

const categoryCopyLabels: Record<
  CopyableCategoryCollection,
  { button: string; short: string; tooltip: string }
> = {
  "product-categories": {
    button: "Copy Product Categories",
    short: "product categories",
    tooltip: "Copy product categories from another branch",
  },
  "ingredient-categories": {
    button: "Copy Ingredient Categories",
    short: "ingredient categories",
    tooltip: "Copy ingredient categories from another branch",
  },
  "packaging-categories": {
    button: "Copy Packaging Categories",
    short: "packaging categories",
    tooltip: "Copy packaging categories from another branch",
  },
};

const productCategoryDefaultValues: ProductCategorySchema = {
  allowedProductTypes: ["finished_product"],
  parentCategoryId: "",
  categoryName: "",
  categoryCode: "",
  description: "",
  imageUrl: "",
  sortOrder: 0,
};

const simpleCategoryDefaultValues: SimpleCategorySchema = {
  categoryName: "",
  description: "",
};

const unitDefaultValues: UnitSchema = {
  unitCategoryId: "",
  unitName: "",
  symbol: "",
  baseUnitId: "",
  conversionFactor: 1,
  decimalPrecision: 0,
};

const orderStatusDefaultValues: OrderStatusSchema = {
  statusName: "",
  statusKey: "",
  sortOrder: 0,
  color: "#B08968",
  isFinalStatus: false,
};

const paymentStatusDefaultValues: PaymentStatusSchema = {
  statusName: "",
  statusKey: "",
  color: "#B08968",
};

function StatusBadge({ status }: { status: RecordStatus }): JSX.Element {
  return (
    <Badge variant={status === "active" ? "secondary" : "default"}>{formatLabel(status)}</Badge>
  );
}

function LoadingCard(): JSX.Element {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="h-32 animate-pulse rounded-3xl bg-brand-cappuccino/30" />
      </CardContent>
    </Card>
  );
}

function ErrorCard({ children }: { children: ReactNode }): JSX.Element {
  return (
    <Alert className="border-danger/30 bg-danger-tint text-danger-text">
      <ShieldAlert className="h-4 w-4" />
      <AlertTitle>Unable to load master data</AlertTitle>
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}

function isCopyableCategoryCollection(
  collection: MasterDataCollection,
): collection is CopyableCategoryCollection {
  return (
    collection === "product-categories" ||
    collection === "ingredient-categories" ||
    collection === "packaging-categories"
  );
}

function parseProductTypeFilter(value: string | null): ProductType | undefined {
  return PRODUCT_TYPES.includes(value as ProductType) ? (value as ProductType) : undefined;
}

function toProductCategoryForm(category: ProductCategory | null): ProductCategorySchema {
  if (!category) {
    return productCategoryDefaultValues;
  }

  return {
    allowedProductTypes:
      category.allowedProductTypes.length > 0
        ? category.allowedProductTypes
        : productCategoryDefaultValues.allowedProductTypes,
    parentCategoryId: category.parentCategoryId ?? "",
    categoryName: category.categoryName,
    categoryCode: category.categoryCode,
    description: category.description,
    imageUrl: category.imageUrl,
    sortOrder: category.sortOrder,
  };
}

function toProductCategoryPayload(values: ProductCategorySchema): CreateProductCategoryPayload {
  const imageUrl = values.imageUrl ?? "";
  const explicitIconKey = getProductCategoryIconKey(imageUrl);
  const inferredIconKey = getProductCategoryIconKeyFromMetadata({
    categoryCode: values.categoryCode,
    categoryName: values.categoryName,
    imageUrl,
  });
  const shouldPreserveLegacyImageUrl = imageUrl.trim().length > 0 && explicitIconKey === null;

  return {
    allowedProductTypes: values.allowedProductTypes,
    parentCategoryId:
      values.parentCategoryId && values.parentCategoryId.trim().length > 0
        ? values.parentCategoryId.trim()
        : null,
    categoryName: values.categoryName.trim(),
    categoryCode: values.categoryCode.trim(),
    description: values.description?.trim() ?? "",
    imageUrl: shouldPreserveLegacyImageUrl
      ? imageUrl.trim()
      : inferredIconKey
        ? toProductCategoryIconValue(inferredIconKey)
        : imageUrl.trim(),
    sortOrder: values.sortOrder,
  };
}

function productCategoryIconSearchText(
  option: (typeof productCategoryIconOptions)[number],
): string {
  return [option.label, option.key, ...option.keywords].join(" ").toLowerCase();
}

function ProductCategoryIconPicker({
  categoryCode,
  categoryName,
  onChange,
  value,
}: {
  categoryCode: string;
  categoryName: string;
  onChange: (key: ProductCategoryIconKey) => void;
  value: string | undefined;
}): JSX.Element {
  const [iconSearch, setIconSearch] = useState("");
  const selectedKey = getProductCategoryIconKeyFromMetadata({
    categoryCode,
    categoryName,
    imageUrl: value ?? "",
  });
  const hasLegacyValue =
    typeof value === "string" && value.trim().length > 0 && selectedKey === null;
  const normalizedSearch = iconSearch.trim().toLowerCase();
  const filteredOptions = useMemo(
    () =>
      normalizedSearch.length === 0
        ? productCategoryIconOptions
        : productCategoryIconOptions.filter((option) =>
            productCategoryIconSearchText(option).includes(normalizedSearch),
          ),
    [normalizedSearch],
  );
  const countLabel =
    normalizedSearch.length === 0
      ? `Icons (${String(productCategoryIconOptions.length)})`
      : `Matching icons (${String(filteredOptions.length)})`;

  return (
    <div className="rounded-2xl border border-brand-cappuccino/70 bg-brand-latte/40 p-3">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-mocha" />
          <Input
            aria-label="Search category icons"
            className="h-10 pl-9"
            onChange={(event) => setIconSearch(event.target.value)}
            placeholder="Search icon name or category type..."
            value={iconSearch}
          />
        </div>
        <span className="text-xs font-semibold text-brand-mocha">{countLabel}</span>
      </div>
      <div className="max-h-80 overflow-y-auto overscroll-contain pr-1">
        {filteredOptions.length > 0 ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {filteredOptions.map((option) => {
              const Icon = option.icon;
              const isSelected = selectedKey === option.key;

              return (
                <Button
                  aria-pressed={isSelected}
                  className="h-20 flex-col gap-2 rounded-xl px-2 text-xs"
                  key={option.key}
                  onClick={() => onChange(option.key)}
                  title={option.label}
                  type="button"
                  variant={isSelected ? "default" : "outline"}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="line-clamp-2 leading-tight">{option.label}</span>
                </Button>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-brand-cappuccino bg-card px-4 py-8 text-center text-sm text-brand-mocha">
            No icons match that search.
          </div>
        )}
      </div>
      {hasLegacyValue ? (
        <p className="mt-2 text-xs text-brand-mocha">
          Existing image URL is preserved until you select an icon.
        </p>
      ) : null}
    </div>
  );
}

function ProductCategoryDialog({
  category,
  isSubmitting,
  onOpenChange,
  onSubmit,
  open,
}: {
  category: ProductCategory | null;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: CreateProductCategoryPayload) => Promise<void>;
  open: boolean;
}): JSX.Element {
  const form = useForm<ProductCategorySchema>({
    resolver: zodResolver(productCategorySchema),
    defaultValues: productCategoryDefaultValues,
  });

  useEffect(() => {
    if (open) {
      form.reset(toProductCategoryForm(category));
    }
  }, [category, form, open]);

  const handleSubmit = form.handleSubmit(async (values) => {
    await onSubmit(toProductCategoryPayload(values));
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {category ? "Edit product category" : "Create product category"}
          </DialogTitle>
          <DialogDescription>
            Product categories organize catalog items before POS billing is built.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            className="grid gap-4 md:grid-cols-2"
            onSubmit={(event) => {
              void handleSubmit(event);
            }}
          >
            <FormField
              control={form.control}
              name="categoryName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category name</FormLabel>
                  <FormControl>
                    <Input placeholder="Cakes" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="categoryCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category code</FormLabel>
                  <FormControl>
                    <Input placeholder="CAKES" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input placeholder="Fresh bakery cakes and celebration cakes" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="allowedProductTypes"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Allowed product types</FormLabel>
                  <div className="grid gap-2 rounded-2xl border border-border bg-muted/30 p-3 sm:grid-cols-2 lg:grid-cols-4">
                    {PRODUCT_TYPES.map((productType) => {
                      const checked = field.value.includes(productType);

                      return (
                        <label
                          key={productType}
                          className="flex items-center gap-2 rounded-xl bg-background px-3 py-2 text-sm"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(nextChecked) => {
                              if (nextChecked === true) {
                                field.onChange([...field.value, productType]);
                                return;
                              }

                              field.onChange(field.value.filter((item) => item !== productType));
                            }}
                          />
                          {PRODUCT_TYPE_LABELS[productType]}
                        </label>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Product forms only show categories compatible with the selected product type.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="imageUrl"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Category icon</FormLabel>
                  <FormControl>
                    <ProductCategoryIconPicker
                      categoryCode={form.watch("categoryCode")}
                      categoryName={form.watch("categoryName")}
                      onChange={(key) => field.onChange(toProductCategoryIconValue(key))}
                      value={field.value}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="sortOrder"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sort order</FormLabel>
                  <FormControl>
                    <Input
                      min={0}
                      type="number"
                      value={field.value}
                      onChange={(event) => {
                        field.onChange(event.target.value);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="parentCategoryId"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Parent category ID</FormLabel>
                  <FormControl>
                    <Input placeholder="Optional parent category UUID" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="md:col-span-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                }}
              >
                Cancel
              </Button>
              <Button disabled={isSubmitting} type="submit">
                {isSubmitting ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Saving
                  </>
                ) : category ? (
                  "Save changes"
                ) : (
                  "Create category"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function toSimpleCategoryForm(category: SimpleCategory | null): SimpleCategorySchema {
  if (!category) {
    return simpleCategoryDefaultValues;
  }

  return {
    categoryName: category.categoryName,
    description: category.description,
  };
}

function toSimpleCategoryPayload(values: SimpleCategorySchema): CreateSimpleCategoryPayload {
  return {
    categoryName: values.categoryName.trim(),
    description: values.description?.trim() ?? "",
  };
}

function SimpleCategoryDialog({
  category,
  isSubmitting,
  onOpenChange,
  onSubmit,
  open,
  title,
}: {
  category: SimpleCategory | null;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: CreateSimpleCategoryPayload) => Promise<void>;
  open: boolean;
  title: string;
}): JSX.Element {
  const form = useForm<SimpleCategorySchema>({
    resolver: zodResolver(simpleCategorySchema),
    defaultValues: simpleCategoryDefaultValues,
  });

  useEffect(() => {
    if (open) {
      form.reset(toSimpleCategoryForm(category));
    }
  }, [category, form, open]);

  const handleSubmit = form.handleSubmit(async (values) => {
    await onSubmit(toSimpleCategoryPayload(values));
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{category ? `Edit ${title}` : `Create ${title}`}</DialogTitle>
          <DialogDescription>
            Manage reusable category records for bakery operations and future POS workflows.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              void handleSubmit(event);
            }}
          >
            <FormField
              control={form.control}
              name="categoryName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category name</FormLabel>
                  <FormControl>
                    <Input placeholder="Cake Boxes" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input placeholder="Boxes, trays, bags, and labels" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                }}
              >
                Cancel
              </Button>
              <Button disabled={isSubmitting} type="submit">
                {isSubmitting ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Saving
                  </>
                ) : category ? (
                  "Save changes"
                ) : (
                  "Create category"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function toUnitForm(unit: Unit | null): UnitSchema {
  if (!unit) {
    return unitDefaultValues;
  }

  return {
    unitCategoryId: unit.unitCategoryId,
    unitName: unit.unitName,
    symbol: unit.symbol,
    baseUnitId: unit.baseUnitId ?? "",
    conversionFactor: unit.conversionFactor,
    decimalPrecision: unit.decimalPrecision,
  };
}

function toUnitPayload(values: UnitSchema): CreateUnitPayload {
  return {
    unitCategoryId: values.unitCategoryId,
    unitName: values.unitName.trim(),
    symbol: values.symbol.trim(),
    baseUnitId:
      values.baseUnitId && values.baseUnitId.trim().length > 0 ? values.baseUnitId.trim() : null,
    conversionFactor: values.conversionFactor,
    decimalPrecision: values.decimalPrecision,
  };
}

function UnitDialog({
  isSubmitting,
  onOpenChange,
  onSubmit,
  open,
  unit,
  unitCategories,
  units,
}: {
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: CreateUnitPayload) => Promise<void>;
  open: boolean;
  unit: Unit | null;
  unitCategories: UnitCategory[];
  units: Unit[];
}): JSX.Element {
  const form = useForm<UnitSchema>({
    resolver: zodResolver(unitSchema),
    defaultValues: unitDefaultValues,
  });

  useEffect(() => {
    if (open) {
      form.reset(toUnitForm(unit));
    }
  }, [form, open, unit]);

  const handleSubmit = form.handleSubmit(async (values) => {
    await onSubmit(toUnitPayload(values));
  });

  const baseUnitOptions = units.filter((item) => item.id !== unit?.id && item.status === "active");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{unit ? "Edit unit" : "Create unit"}</DialogTitle>
          <DialogDescription>
            Manage measurement units and conversion rules used across products and inventory.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            className="grid gap-4 md:grid-cols-2"
            onSubmit={(event) => {
              void handleSubmit(event);
            }}
          >
            <FormField
              control={form.control}
              name="unitName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Unit name</FormLabel>
                  <FormControl>
                    <Input placeholder="Kilogram" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="symbol"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Symbol</FormLabel>
                  <FormControl>
                    <Input placeholder="kg" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="unitCategoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Unit category</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {unitCategories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="baseUnitId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Base unit</FormLabel>
                  <Select
                    value={field.value ?? "none"}
                    onValueChange={(value) => {
                      field.onChange(value === "none" ? "" : value);
                    }}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select base unit" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">No base unit</SelectItem>
                      {baseUnitOptions.map((baseUnit) => (
                        <SelectItem key={baseUnit.id} value={baseUnit.id}>
                          {baseUnit.unitName} ({baseUnit.symbol})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="conversionFactor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Conversion factor</FormLabel>
                  <FormControl>
                    <Input
                      min="0.000001"
                      step="0.000001"
                      type="number"
                      value={field.value}
                      onChange={(event) => {
                        field.onChange(event.target.value);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="decimalPrecision"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Decimal precision</FormLabel>
                  <FormControl>
                    <Input
                      max={6}
                      min={0}
                      type="number"
                      value={field.value}
                      onChange={(event) => {
                        field.onChange(event.target.value);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="md:col-span-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                }}
              >
                Cancel
              </Button>
              <Button disabled={isSubmitting} type="submit">
                {isSubmitting ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Saving
                  </>
                ) : unit ? (
                  "Save changes"
                ) : (
                  "Create unit"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function UnitsTable({
  canManage,
  onDeactivate,
  onEdit,
  onStatusChange,
  onView,
  units,
}: {
  canManage: boolean;
  onDeactivate: (unit: Unit) => void;
  onEdit: (unit: Unit) => void;
  onStatusChange: (unit: Unit, status: RecordStatus) => void;
  onView: (unit: Unit) => void;
  units: Unit[];
}): JSX.Element {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Symbol</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Conversion</TableHead>
          <TableHead>Precision</TableHead>
          <TableHead>System</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {units.length === 0 ? (
          <CollectionStateRow colSpan={8}>
            <EmptyState
              description="A unit is how a quantity is measured — kg, litre, piece. Recipes, stock and purchase orders all need one."
              icon={Ruler}
              title="No units yet"
            />
          </CollectionStateRow>
        ) : null}
        {units.map((unit) => (
          <TableRow className="cursor-pointer" key={unit.id} onClick={() => onView(unit)}>
            <TableCell className="font-medium">{unit.unitName}</TableCell>
            <TableCell>{unit.symbol}</TableCell>
            <TableCell>{unit.unitCategory.name}</TableCell>
            <TableCell>{unit.conversionFactor}</TableCell>
            <TableCell>{unit.decimalPrecision}</TableCell>
            <TableCell>{unit.isSystemDefault ? "Yes" : "No"}</TableCell>
            <TableCell>
              <StatusBadge status={unit.status} />
            </TableCell>
            <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    aria-label={`Open actions for ${unit.unitName}`}
                    size="icon"
                    variant="ghost"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    disabled={!canManage || unit.isSystemDefault}
                    onSelect={() => onEdit(unit)}
                  >
                    Edit unit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={!canManage || unit.status === "active" || unit.isSystemDefault}
                    onSelect={() => onStatusChange(unit, "active")}
                  >
                    Activate
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={!canManage || unit.status === "inactive" || unit.isSystemDefault}
                    onSelect={() => onStatusChange(unit, "inactive")}
                  >
                    Mark inactive
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-danger-text focus:text-danger-text"
                    disabled={!canManage || unit.isSystemDefault}
                    onSelect={() => onDeactivate(unit)}
                  >
                    Deactivate through delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function ProductCategoriesTable({
  canManage,
  categories,
  onDeactivate,
  onEdit,
  onStatusChange,
  onView,
}: {
  canManage: boolean;
  categories: ProductCategory[];
  onDeactivate: (category: ProductCategory) => void;
  onEdit: (category: ProductCategory) => void;
  onStatusChange: (category: ProductCategory, status: RecordStatus) => void;
  onView: (category: ProductCategory) => void;
}): JSX.Element {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Code</TableHead>
          <TableHead>Allowed Types</TableHead>
          <TableHead>Description</TableHead>
          <TableHead>Sort</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {categories.length === 0 ? (
          <CollectionStateRow colSpan={7}>
            <EmptyState
              description="Categories group products for the catalogue and the POS grid. Without them, every product lands in one undifferentiated list."
              icon={Shapes}
              title="No product categories yet"
            />
          </CollectionStateRow>
        ) : null}
        {categories.map((category) => {
          const Icon = getProductCategoryIconForMetadata(category);

          return (
            <TableRow className="cursor-pointer" key={category.id} onClick={() => onView(category)}>
              <TableCell className="font-medium">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-latte text-brand-mocha">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span>{category.categoryName}</span>
                </div>
              </TableCell>
              <TableCell>{category.categoryCode}</TableCell>
              <TableCell>
                {category.allowedProductTypes.length > 0 ? (
                  <div className="flex max-w-xs flex-wrap gap-1">
                    {category.allowedProductTypes.map((productType) => (
                      <Badge key={productType} variant="outline">
                        {PRODUCT_TYPE_LABELS[productType]}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">All product types</span>
                )}
              </TableCell>
              <TableCell className="min-w-64 whitespace-normal">{category.description}</TableCell>
              <TableCell>{category.sortOrder}</TableCell>
              <TableCell>
                <StatusBadge status={category.status} />
              </TableCell>
              <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      aria-label={`Open actions for ${category.categoryName}`}
                      size="icon"
                      variant="ghost"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem disabled={!canManage} onSelect={() => onEdit(category)}>
                      Edit category
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={!canManage || category.status === "active"}
                      onSelect={() => onStatusChange(category, "active")}
                    >
                      Activate
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={!canManage || category.status === "inactive"}
                      onSelect={() => onStatusChange(category, "inactive")}
                    >
                      Mark inactive
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-danger-text focus:text-danger-text"
                      disabled={!canManage}
                      onSelect={() => onDeactivate(category)}
                    >
                      Deactivate through delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function SimpleCategoriesTable({
  canManage = false,
  categories,
  noun,
  onDeactivate,
  onEdit,
  onStatusChange,
  onView,
}: {
  canManage?: boolean;
  categories: SimpleCategory[];
  /** Names the collection in the empty state. Required: this table renders both
      ingredient and packaging categories, and "No categories yet" on the
      packaging screen sends someone looking in the wrong place. */
  noun: string;
  onDeactivate?: (category: SimpleCategory) => void;
  onEdit?: (category: SimpleCategory) => void;
  onStatusChange?: (category: SimpleCategory, status: RecordStatus) => void;
  onView: (category: SimpleCategory) => void;
}): JSX.Element {
  const showActions =
    onEdit !== undefined && onDeactivate !== undefined && onStatusChange !== undefined;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Description</TableHead>
          <TableHead>Status</TableHead>
          {showActions ? <TableHead className="text-right">Actions</TableHead> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {categories.length === 0 ? (
          <CollectionStateRow colSpan={showActions ? 4 : 3}>
            <EmptyState
              description={`Used to group ${noun} for reporting and stock organisation.`}
              icon={Shapes}
              title={`No ${noun} yet`}
            />
          </CollectionStateRow>
        ) : null}
        {categories.map((category) => (
          <TableRow className="cursor-pointer" key={category.id} onClick={() => onView(category)}>
            <TableCell className="font-medium">{category.categoryName}</TableCell>
            <TableCell className="min-w-64 whitespace-normal">{category.description}</TableCell>
            <TableCell>
              <StatusBadge status={category.status} />
            </TableCell>
            {showActions ? (
              <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      aria-label={`Open actions for ${category.categoryName}`}
                      size="icon"
                      variant="ghost"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      disabled={!canManage}
                      onSelect={() => {
                        onEdit(category);
                      }}
                    >
                      Edit category
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={!canManage || category.status === "active"}
                      onSelect={() => {
                        onStatusChange(category, "active");
                      }}
                    >
                      Activate
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={!canManage || category.status === "inactive"}
                      onSelect={() => {
                        onStatusChange(category, "inactive");
                      }}
                    >
                      Mark inactive
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-danger-text focus:text-danger-text"
                      disabled={!canManage}
                      onSelect={() => {
                        onDeactivate(category);
                      }}
                    >
                      Deactivate through delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            ) : null}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function toOrderStatusForm(status: OrderStatus | null): OrderStatusSchema {
  if (!status) {
    return orderStatusDefaultValues;
  }

  return {
    statusName: status.statusName,
    statusKey: status.statusKey,
    sortOrder: status.sortOrder,
    color: status.color,
    isFinalStatus: status.isFinalStatus,
  };
}

function toOrderStatusPayload(values: OrderStatusSchema): CreateOrderStatusPayload {
  return {
    statusName: values.statusName.trim(),
    statusKey: values.statusKey.trim(),
    sortOrder: values.sortOrder,
    color: values.color.trim(),
    isFinalStatus: values.isFinalStatus,
  };
}

function OrderStatusDialog({
  isSubmitting,
  onOpenChange,
  onSubmit,
  open,
  status,
}: {
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: CreateOrderStatusPayload) => Promise<void>;
  open: boolean;
  status: OrderStatus | null;
}): JSX.Element {
  const form = useForm<OrderStatusSchema>({
    resolver: zodResolver(orderStatusSchema),
    defaultValues: orderStatusDefaultValues,
  });

  useEffect(() => {
    if (open) {
      form.reset(toOrderStatusForm(status));
    }
  }, [form, open, status]);

  const handleSubmit = form.handleSubmit(async (values) => {
    await onSubmit(toOrderStatusPayload(values));
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{status ? "Edit order status" : "Create order status"}</DialogTitle>
          <DialogDescription>
            Order statuses control the operational workflow labels used by future order screens.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            className="grid gap-4 md:grid-cols-2"
            onSubmit={(event) => {
              void handleSubmit(event);
            }}
          >
            <FormField
              control={form.control}
              name="statusName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status name</FormLabel>
                  <FormControl>
                    <Input placeholder="In Production" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="statusKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status key</FormLabel>
                  <FormControl>
                    <Input placeholder="in_production" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="sortOrder"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sort order</FormLabel>
                  <FormControl>
                    <Input
                      min={0}
                      type="number"
                      value={field.value}
                      onChange={(event) => {
                        field.onChange(event.target.value);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Color</FormLabel>
                  <FormControl>
                    <Input placeholder="#B08968" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="isFinalStatus"
              render={({ field }) => (
                <FormItem className="flex items-center gap-3 rounded-2xl border border-brand-cappuccino bg-brand-latte/70 p-4 md:col-span-2">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div>
                    <FormLabel>Final status</FormLabel>
                    <p className="text-xs text-brand-mocha">
                      Mark this status as a completed end state for the order workflow.
                    </p>
                  </div>
                </FormItem>
              )}
            />

            <DialogFooter className="md:col-span-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                }}
              >
                Cancel
              </Button>
              <Button disabled={isSubmitting} type="submit">
                {isSubmitting ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Saving
                  </>
                ) : status ? (
                  "Save changes"
                ) : (
                  "Create status"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function OrderStatusesTable({
  canManage,
  onEdit,
  onStatusChange,
  onView,
  statuses,
}: {
  canManage: boolean;
  onEdit: (status: OrderStatus) => void;
  onStatusChange: (status: OrderStatus, recordStatus: RecordStatus) => void;
  onView: (status: OrderStatus) => void;
  statuses: OrderStatus[];
}): JSX.Element {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Key</TableHead>
          <TableHead>Sort</TableHead>
          <TableHead>Final</TableHead>
          <TableHead>System</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {statuses.length === 0 ? (
          <CollectionStateRow colSpan={7}>
            <EmptyState
              description="Order statuses are the steps a bakery order moves through, from new to delivered."
              icon={ListChecks}
              title="No order statuses yet"
            />
          </CollectionStateRow>
        ) : null}
        {statuses.map((status) => (
          <TableRow className="cursor-pointer" key={status.id} onClick={() => onView(status)}>
            <TableCell className="font-medium">{status.statusName}</TableCell>
            <TableCell>{status.statusKey}</TableCell>
            <TableCell>{status.sortOrder}</TableCell>
            <TableCell>{status.isFinalStatus ? "Yes" : "No"}</TableCell>
            <TableCell>{status.isSystemDefault ? "Yes" : "No"}</TableCell>
            <TableCell>
              <StatusBadge status={status.status} />
            </TableCell>
            <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    aria-label={`Open actions for ${status.statusName}`}
                    size="icon"
                    variant="ghost"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    disabled={!canManage || status.isSystemDefault}
                    onSelect={() => onEdit(status)}
                  >
                    Edit status
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={!canManage || status.status === "active" || status.isSystemDefault}
                    onSelect={() => onStatusChange(status, "active")}
                  >
                    Activate
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={!canManage || status.status === "inactive" || status.isSystemDefault}
                    onSelect={() => onStatusChange(status, "inactive")}
                  >
                    Mark inactive
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function toPaymentStatusForm(status: PaymentStatus | null): PaymentStatusSchema {
  if (!status) {
    return paymentStatusDefaultValues;
  }

  return {
    statusName: status.statusName,
    statusKey: status.statusKey,
    color: status.color,
  };
}

function toPaymentStatusPayload(values: PaymentStatusSchema): CreatePaymentStatusPayload {
  return {
    statusName: values.statusName.trim(),
    statusKey: values.statusKey.trim(),
    color: values.color.trim(),
  };
}

function PaymentStatusDialog({
  isSubmitting,
  onOpenChange,
  onSubmit,
  open,
  status,
}: {
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: CreatePaymentStatusPayload) => Promise<void>;
  open: boolean;
  status: PaymentStatus | null;
}): JSX.Element {
  const form = useForm<PaymentStatusSchema>({
    resolver: zodResolver(paymentStatusSchema),
    defaultValues: paymentStatusDefaultValues,
  });

  useEffect(() => {
    if (open) {
      form.reset(toPaymentStatusForm(status));
    }
  }, [form, open, status]);

  const handleSubmit = form.handleSubmit(async (values) => {
    await onSubmit(toPaymentStatusPayload(values));
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{status ? "Edit payment status" : "Create payment status"}</DialogTitle>
          <DialogDescription>
            Payment statuses define reusable payment workflow labels for orders and invoices.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            className="grid gap-4 md:grid-cols-2"
            onSubmit={(event) => {
              void handleSubmit(event);
            }}
          >
            <FormField
              control={form.control}
              name="statusName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status name</FormLabel>
                  <FormControl>
                    <Input placeholder="Partial" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="statusKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status key</FormLabel>
                  <FormControl>
                    <Input placeholder="partial" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Color</FormLabel>
                  <FormControl>
                    <Input placeholder="#B08968" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="md:col-span-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                }}
              >
                Cancel
              </Button>
              <Button disabled={isSubmitting} type="submit">
                {isSubmitting ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Saving
                  </>
                ) : status ? (
                  "Save changes"
                ) : (
                  "Create status"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function PaymentStatusesTable({
  canManage,
  onEdit,
  onStatusChange,
  onView,
  statuses,
}: {
  canManage: boolean;
  onEdit: (status: PaymentStatus) => void;
  onStatusChange: (status: PaymentStatus, recordStatus: RecordStatus) => void;
  onView: (status: PaymentStatus) => void;
  statuses: PaymentStatus[];
}): JSX.Element {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Key</TableHead>
          <TableHead>Color</TableHead>
          <TableHead>System</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {statuses.length === 0 ? (
          <CollectionStateRow colSpan={6}>
            <EmptyState
              description="Payment statuses describe where a payment stands: pending, completed, refunded."
              icon={ListChecks}
              title="No payment statuses yet"
            />
          </CollectionStateRow>
        ) : null}
        {statuses.map((status) => (
          <TableRow className="cursor-pointer" key={status.id} onClick={() => onView(status)}>
            <TableCell className="font-medium">{status.statusName}</TableCell>
            <TableCell>{status.statusKey}</TableCell>
            <TableCell>
              <span className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="inline-block h-4 w-4 shrink-0 rounded-full border border-border"
                  style={{ backgroundColor: status.color }}
                />
                <span className="font-mono">{status.color}</span>
              </span>
            </TableCell>
            <TableCell>{status.isSystemDefault ? "Yes" : "No"}</TableCell>
            <TableCell>
              <StatusBadge status={status.status} />
            </TableCell>
            <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    aria-label={`Open actions for ${status.statusName}`}
                    size="icon"
                    variant="ghost"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    disabled={!canManage || status.isSystemDefault}
                    onSelect={() => onEdit(status)}
                  >
                    Edit status
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={!canManage || status.status === "active" || status.isSystemDefault}
                    onSelect={() => onStatusChange(status, "active")}
                  >
                    Activate
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={!canManage || status.status === "inactive" || status.isSystemDefault}
                    onSelect={() => onStatusChange(status, "inactive")}
                  >
                    Mark inactive
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function CategoryCopyDialog({
  activeSourceBranches,
  copyLabel,
  currentBranchName,
  disabledReason,
  isBranchesLoading,
  isSubmitting,
  onOpenChange,
  onSourceBranchChange,
  onSubmit,
  open,
  selectedSourceBranchId,
}: {
  activeSourceBranches: Branch[];
  copyLabel: string;
  currentBranchName: string;
  disabledReason: string | null;
  isBranchesLoading: boolean;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSourceBranchChange: (branchId: string) => void;
  onSubmit: () => Promise<void>;
  open: boolean;
  selectedSourceBranchId: string;
}): JSX.Element {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Copy {copyLabel}</DialogTitle>
          <DialogDescription>
            Copy categories into {currentBranchName}. Existing categories with the same name are
            skipped by the backend.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="master-data-copy-from-branch"
              className="text-sm font-medium text-brand-espresso"
            >
              Copy from branch
            </label>
            <Select
              disabled={Boolean(disabledReason) || isBranchesLoading || isSubmitting}
              onValueChange={onSourceBranchChange}
              {...(selectedSourceBranchId ? { value: selectedSourceBranchId } : {})}
            >
              <SelectTrigger id="master-data-copy-from-branch">
                <SelectValue
                  placeholder={isBranchesLoading ? "Loading branches..." : "Select source branch"}
                />
              </SelectTrigger>
              <SelectContent>
                {activeSourceBranches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.name} ({branch.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {disabledReason ? (
            <Alert className="border-brand-cappuccino bg-brand-latte/70 text-brand-espresso">
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>Copy unavailable</AlertTitle>
              <AlertDescription>{disabledReason}</AlertDescription>
            </Alert>
          ) : (
            <div className="rounded-2xl border border-brand-cappuccino bg-brand-latte/60 p-4 text-sm text-brand-mocha">
              Confirming this action copies from the selected source branch into the current active
              branch only. The frontend does not send a target branch.
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button
            disabled={Boolean(disabledReason) || !selectedSourceBranchId || isSubmitting}
            type="button"
            onClick={() => {
              void onSubmit();
            }}
          >
            {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            Copy categories
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function MasterDataPageClient({ collection }: MasterDataPageClientProps): JSX.Element {
  const confirm = useConfirm();
  const searchParams = useSearchParams();
  const { hasAnyPermission } = usePermission();
  const branchScope = useBranchScope();
  const canView = hasAnyPermission([PERMISSIONS.masterDataView]);
  const canManage = hasAnyPermission(collectionManagePermissions[collection]);
  const copyableCollection = isCopyableCategoryCollection(collection) ? collection : null;
  const copyLabel = copyableCollection ? categoryCopyLabels[copyableCollection] : null;
  const copyCategoryType = copyableCollection
    ? categoryCopyTypeByCollection[copyableCollection]
    : null;
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [selectedProductCategory, setSelectedProductCategory] = useState<ProductCategory | null>(
    null,
  );
  const [unitDialogOpen, setUnitDialogOpen] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [orderStatusDialogOpen, setOrderStatusDialogOpen] = useState(false);
  const [selectedOrderStatus, setSelectedOrderStatus] = useState<OrderStatus | null>(null);
  const [paymentStatusDialogOpen, setPaymentStatusDialogOpen] = useState(false);
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState<PaymentStatus | null>(null);
  const [simpleDialogOpen, setSimpleDialogOpen] = useState(false);
  const [selectedSimpleCategory, setSelectedSimpleCategory] = useState<SimpleCategory | null>(null);
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [filters, setFilters] = useState<MasterDataFilters>(defaultMasterDataFilters);
  const [drawerDetail, setDrawerDetail] = useState<MasterDataDetail | null>(null);
  const [copySourceBranchId, setCopySourceBranchId] = useState("");
  const branchesQuery = useBranches(Boolean(copyableCollection && canManage));
  const activeCopySourceBranches = useMemo(
    () =>
      (branchesQuery.data ?? []).filter(
        (branch) => branch.status === "active" && branch.id !== branchScope.effectiveBranchId,
      ),
    [branchScope.effectiveBranchId, branchesQuery.data],
  );
  const currentBranchName =
    branchScope.effectiveBranchName ??
    branchesQuery.data?.find((branch) => branch.id === branchScope.effectiveBranchId)?.name ??
    "current branch";
  const copyDisabledReason = !branchScope.effectiveBranchId
    ? "Switch to a target branch before copying categories."
    : branchesQuery.error
      ? getErrorMessage(branchesQuery.error)
      : !branchesQuery.isLoading && activeCopySourceBranches.length === 0
        ? "No other active branch is available to copy from."
        : null;
  const activeSimpleCollection =
    collection === "ingredient-categories" || collection === "packaging-categories"
      ? collection
      : "packaging-categories";
  const unitsQuery = useUnits(canView && collection === "units");
  const unitCategoriesQuery = useUnitCategories(canView && collection === "units");
  const createUnitMutation = useCreateUnit();
  const updateUnitMutation = useUpdateUnit();
  const updateUnitStatusMutation = useUpdateUnitStatus();
  const deleteUnitMutation = useDeleteUnit();
  const productTypeFilter =
    collection === "product-categories"
      ? parseProductTypeFilter(searchParams.get("product_type"))
      : undefined;
  const productCategoriesQuery = useProductCategories(
    canView && collection === "product-categories",
    { productType: productTypeFilter ?? "all" },
  );
  const createProductCategoryMutation = useCreateProductCategory();
  const updateProductCategoryMutation = useUpdateProductCategory();
  const updateProductCategoryStatusMutation = useUpdateProductCategoryStatus();
  const deleteProductCategoryMutation = useDeleteProductCategory();
  const ingredientCategoriesQuery = useSimpleCategories(
    "ingredient-categories",
    canView && collection === "ingredient-categories",
  );
  const createIngredientCategoryMutation = useCreateSimpleCategory("ingredient-categories");
  const updateIngredientCategoryMutation = useUpdateSimpleCategory("ingredient-categories");
  const updateIngredientCategoryStatusMutation =
    useUpdateSimpleCategoryStatus("ingredient-categories");
  const deleteIngredientCategoryMutation = useDeleteSimpleCategory("ingredient-categories");
  const packagingCategoriesQuery = useSimpleCategories(
    "packaging-categories",
    canView && collection === "packaging-categories",
  );
  const createPackagingCategoryMutation = useCreateSimpleCategory("packaging-categories");
  const updatePackagingCategoryMutation = useUpdateSimpleCategory("packaging-categories");
  const updatePackagingCategoryStatusMutation =
    useUpdateSimpleCategoryStatus("packaging-categories");
  const deletePackagingCategoryMutation = useDeleteSimpleCategory("packaging-categories");
  const orderStatusesQuery = useOrderStatuses(canView && collection === "order-statuses");
  const createOrderStatusMutation = useCreateOrderStatus();
  const updateOrderStatusMutation = useUpdateOrderStatus();
  const updateOrderStatusStatusMutation = useUpdateOrderStatusStatus();
  const paymentStatusesQuery = usePaymentStatuses(canView && collection === "payment-statuses");
  const createPaymentStatusMutation = useCreatePaymentStatus();
  const updatePaymentStatusMutation = useUpdatePaymentStatus();
  const updatePaymentStatusStatusMutation = useUpdatePaymentStatusStatus();
  const copyCategoriesMutation = useCopyCategories();

  if (!canView) {
    return (
      <div className="mx-auto max-w-3xl">
        <Alert className="border-brand-cappuccino bg-card/80">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Access denied</AlertTitle>
          <AlertDescription>
            You need master_data.view permission to view this page.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const activeQuery =
    collection === "units"
      ? unitsQuery
      : collection === "product-categories"
        ? productCategoriesQuery
        : collection === "ingredient-categories"
          ? ingredientCategoriesQuery
          : collection === "packaging-categories"
            ? packagingCategoriesQuery
            : collection === "order-statuses"
              ? orderStatusesQuery
              : paymentStatusesQuery;

  const unitSubmitting =
    createUnitMutation.isPending ||
    updateUnitMutation.isPending ||
    updateUnitStatusMutation.isPending ||
    deleteUnitMutation.isPending;
  const productCategorySubmitting =
    createProductCategoryMutation.isPending ||
    updateProductCategoryMutation.isPending ||
    updateProductCategoryStatusMutation.isPending ||
    deleteProductCategoryMutation.isPending;
  const ingredientCategorySubmitting =
    createIngredientCategoryMutation.isPending ||
    updateIngredientCategoryMutation.isPending ||
    updateIngredientCategoryStatusMutation.isPending ||
    deleteIngredientCategoryMutation.isPending;
  const packagingCategorySubmitting =
    createPackagingCategoryMutation.isPending ||
    updatePackagingCategoryMutation.isPending ||
    updatePackagingCategoryStatusMutation.isPending ||
    deletePackagingCategoryMutation.isPending;
  const simpleCategorySubmitting =
    activeSimpleCollection === "ingredient-categories"
      ? ingredientCategorySubmitting
      : packagingCategorySubmitting;
  const orderStatusSubmitting =
    createOrderStatusMutation.isPending ||
    updateOrderStatusMutation.isPending ||
    updateOrderStatusStatusMutation.isPending;
  const paymentStatusSubmitting =
    createPaymentStatusMutation.isPending ||
    updatePaymentStatusMutation.isPending ||
    updatePaymentStatusStatusMutation.isPending;

  const openCreateProductCategoryDialog = (): void => {
    setSelectedProductCategory(null);
    setProductDialogOpen(true);
  };

  const openEditProductCategoryDialog = (category: ProductCategory): void => {
    setSelectedProductCategory(category);
    setProductDialogOpen(true);
  };

  const openCreateUnitDialog = (): void => {
    setSelectedUnit(null);
    setUnitDialogOpen(true);
  };

  const openEditUnitDialog = (unit: Unit): void => {
    setSelectedUnit(unit);
    setUnitDialogOpen(true);
  };

  const openCreateOrderStatusDialog = (): void => {
    setSelectedOrderStatus(null);
    setOrderStatusDialogOpen(true);
  };

  const openEditOrderStatusDialog = (status: OrderStatus): void => {
    setSelectedOrderStatus(status);
    setOrderStatusDialogOpen(true);
  };

  const openCreatePaymentStatusDialog = (): void => {
    setSelectedPaymentStatus(null);
    setPaymentStatusDialogOpen(true);
  };

  const openEditPaymentStatusDialog = (status: PaymentStatus): void => {
    setSelectedPaymentStatus(status);
    setPaymentStatusDialogOpen(true);
  };

  const openCreatePackagingCategoryDialog = (): void => {
    setSelectedSimpleCategory(null);
    setSimpleDialogOpen(true);
  };

  const openEditSimpleCategoryDialog = (category: SimpleCategory): void => {
    setSelectedSimpleCategory(category);
    setSimpleDialogOpen(true);
  };

  const openCopyCategoryDialog = (): void => {
    setCopySourceBranchId("");
    setCopyDialogOpen(true);
  };

  const handleCopyCategories = async (): Promise<void> => {
    if (!copyCategoryType || !copyLabel || !copySourceBranchId) {
      return;
    }

    const sourceBranch = activeCopySourceBranches.find(
      (branch) => branch.id === copySourceBranchId,
    );
    const sourceBranchName = sourceBranch?.name ?? "selected branch";
    // Not destructive: nothing is removed and duplicates are skipped. So this is
    // tone="default", not danger — reserving red for actions that actually lose
    // something is what keeps red meaningful (DESIGN.md §3.2).
    const confirmed = await confirm({
      cancelLabel: "Don't copy",
      confirmLabel: `Copy ${copyLabel.short}`,
      consequence: `This copies ${copyLabel.short} from ${sourceBranchName} into ${currentBranchName}. Nothing is removed, and any that already exist are skipped.`,
      title: `Copy ${copyLabel.short} into ${currentBranchName}?`,
      tone: "default",
    });

    if (!confirmed) {
      return;
    }

    try {
      const result = await copyCategoriesMutation.mutateAsync({
        categoryType: copyCategoryType,
        sourceBranchId: copySourceBranchId,
      });

      toast.success(
        `${String(result.createdCount)} copied, ${String(result.skippedCount)} skipped.`,
      );
      setCopyDialogOpen(false);
      setCopySourceBranchId("");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleProductCategorySubmit = async (
    payload: CreateProductCategoryPayload,
  ): Promise<void> => {
    try {
      if (selectedProductCategory) {
        await updateProductCategoryMutation.mutateAsync({
          id: selectedProductCategory.id,
          payload,
        });
        toast.success("Product category updated.");
      } else {
        await createProductCategoryMutation.mutateAsync(payload);
        toast.success("Product category created.");
      }

      setProductDialogOpen(false);
      setSelectedProductCategory(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleUnitSubmit = async (payload: CreateUnitPayload): Promise<void> => {
    try {
      if (selectedUnit) {
        await updateUnitMutation.mutateAsync({
          id: selectedUnit.id,
          payload,
        });
        toast.success("Unit updated.");
      } else {
        await createUnitMutation.mutateAsync(payload);
        toast.success("Unit created.");
      }

      setUnitDialogOpen(false);
      setSelectedUnit(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleUnitStatusChange = async (unit: Unit, status: RecordStatus): Promise<void> => {
    try {
      await updateUnitStatusMutation.mutateAsync({
        id: unit.id,
        payload: { status },
      });
      toast.success(`Unit marked ${status}.`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleUnitDeactivate = async (unit: Unit): Promise<void> => {
    // Reversible — the backend keeps the record and marks it inactive. Danger tone
    // and "cannot be undone" would both be false here, and a dialog that overstates
    // its stakes trains people to dismiss the ones that matter.
    const confirmed = await confirm({
      cancelLabel: "Keep active",
      confirmLabel: "Deactivate unit",
      consequence: `${unit.unitName} stops being offered on new records. Existing records that use it are unchanged, and it can be reactivated later.`,
      title: `Deactivate ${unit.unitName}?`,
      tone: "default",
    });

    if (!confirmed) {
      return;
    }

    try {
      await deleteUnitMutation.mutateAsync(unit.id);
      toast.success("Unit deactivated.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleOrderStatusSubmit = async (payload: CreateOrderStatusPayload): Promise<void> => {
    try {
      if (selectedOrderStatus) {
        await updateOrderStatusMutation.mutateAsync({
          id: selectedOrderStatus.id,
          payload,
        });
        toast.success("Order status updated.");
      } else {
        await createOrderStatusMutation.mutateAsync(payload);
        toast.success("Order status created.");
      }

      setOrderStatusDialogOpen(false);
      setSelectedOrderStatus(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleOrderStatusStatusChange = async (
    status: OrderStatus,
    recordStatus: RecordStatus,
  ): Promise<void> => {
    try {
      await updateOrderStatusStatusMutation.mutateAsync({
        id: status.id,
        payload: { status: recordStatus },
      });
      toast.success(`Order status marked ${recordStatus}.`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handlePaymentStatusSubmit = async (payload: CreatePaymentStatusPayload): Promise<void> => {
    try {
      if (selectedPaymentStatus) {
        await updatePaymentStatusMutation.mutateAsync({
          id: selectedPaymentStatus.id,
          payload,
        });
        toast.success("Payment status updated.");
      } else {
        await createPaymentStatusMutation.mutateAsync(payload);
        toast.success("Payment status created.");
      }

      setPaymentStatusDialogOpen(false);
      setSelectedPaymentStatus(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handlePaymentStatusStatusChange = async (
    status: PaymentStatus,
    recordStatus: RecordStatus,
  ): Promise<void> => {
    try {
      await updatePaymentStatusStatusMutation.mutateAsync({
        id: status.id,
        payload: { status: recordStatus },
      });
      toast.success(`Payment status marked ${recordStatus}.`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleProductCategoryStatusChange = async (
    category: ProductCategory,
    status: RecordStatus,
  ): Promise<void> => {
    try {
      await updateProductCategoryStatusMutation.mutateAsync({
        id: category.id,
        payload: { status },
      });
      toast.success(`Product category marked ${status}.`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleProductCategoryDeactivate = async (category: ProductCategory): Promise<void> => {
    const confirmed = await confirm({
      cancelLabel: "Keep active",
      confirmLabel: "Deactivate category",
      consequence: `${category.categoryName} stops being offered on new products. Products already in it are unchanged, and it can be reactivated later.`,
      title: `Deactivate ${category.categoryName}?`,
      tone: "default",
    });

    if (!confirmed) {
      return;
    }

    try {
      await deleteProductCategoryMutation.mutateAsync(category.id);
      toast.success("Product category deactivated.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleSimpleCategorySubmit = async (
    payload: CreateSimpleCategoryPayload,
  ): Promise<void> => {
    const label =
      activeSimpleCollection === "ingredient-categories"
        ? "Ingredient category"
        : "Packaging category";

    try {
      if (selectedSimpleCategory) {
        if (activeSimpleCollection === "ingredient-categories") {
          await updateIngredientCategoryMutation.mutateAsync({
            id: selectedSimpleCategory.id,
            payload,
          });
        } else {
          await updatePackagingCategoryMutation.mutateAsync({
            id: selectedSimpleCategory.id,
            payload,
          });
        }
        toast.success(`${label} updated.`);
      } else {
        if (activeSimpleCollection === "ingredient-categories") {
          await createIngredientCategoryMutation.mutateAsync(payload);
        } else {
          await createPackagingCategoryMutation.mutateAsync(payload);
        }
        toast.success(`${label} created.`);
      }

      setSimpleDialogOpen(false);
      setSelectedSimpleCategory(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleSimpleCategoryStatusChange = async (
    category: SimpleCategory,
    status: RecordStatus,
  ): Promise<void> => {
    const label =
      activeSimpleCollection === "ingredient-categories"
        ? "Ingredient category"
        : "Packaging category";

    try {
      if (activeSimpleCollection === "ingredient-categories") {
        await updateIngredientCategoryStatusMutation.mutateAsync({
          id: category.id,
          payload: { status },
        });
      } else {
        await updatePackagingCategoryStatusMutation.mutateAsync({
          id: category.id,
          payload: { status },
        });
      }
      toast.success(`${label} marked ${status}.`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleSimpleCategoryDeactivate = async (category: SimpleCategory): Promise<void> => {
    const label =
      activeSimpleCollection === "ingredient-categories"
        ? "ingredient category"
        : "packaging category";
    const confirmed = await confirm({
      cancelLabel: "Keep active",
      confirmLabel: `Deactivate ${label}`,
      consequence: `${category.categoryName} stops being offered on new records. Anything already using it is unchanged, and it can be reactivated later.`,
      title: `Deactivate ${category.categoryName}?`,
      tone: "default",
    });

    if (!confirmed) {
      return;
    }

    try {
      if (activeSimpleCollection === "ingredient-categories") {
        await deleteIngredientCategoryMutation.mutateAsync(category.id);
      } else {
        await deletePackagingCategoryMutation.mutateAsync(category.id);
      }
      toast.success(`${label} deactivated.`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const statusAllowed = (status: RecordStatus): boolean =>
    filters.status === "all" || filters.status === status;
  const query = filters.search.trim().toLowerCase();
  const keep = (detail: MasterDataDetail): boolean =>
    statusAllowed(detail.status) && matchesMasterDataQuery(detail, query);

  // Each collection maps onto the shared descriptor, so the search, the cards
  // and the drawer are written once rather than five times.
  const filteredUnits = (unitsQuery.data ?? []).filter((unit) => keep(unitDetail(unit)));
  const filteredProductCategories = (productCategoriesQuery.data ?? []).filter((category) =>
    keep(productCategoryDetail(category)),
  );
  const filteredIngredientCategories = (ingredientCategoriesQuery.data ?? []).filter((category) =>
    keep(simpleCategoryDetail(category)),
  );
  const filteredPackagingCategories = (packagingCategoriesQuery.data ?? []).filter((category) =>
    keep(simpleCategoryDetail(category)),
  );
  const filteredOrderStatuses = (orderStatusesQuery.data ?? []).filter((status) =>
    keep(orderStatusDetail(status)),
  );
  const filteredPaymentStatuses = (paymentStatusesQuery.data ?? []).filter((status) =>
    keep(paymentStatusDetail(status)),
  );

  const activeDetails: MasterDataDetail[] =
    collection === "units"
      ? filteredUnits.map(unitDetail)
      : collection === "product-categories"
        ? filteredProductCategories.map(productCategoryDetail)
        : collection === "ingredient-categories"
          ? filteredIngredientCategories.map(simpleCategoryDetail)
          : collection === "packaging-categories"
            ? filteredPackagingCategories.map(simpleCategoryDetail)
            : collection === "order-statuses"
              ? filteredOrderStatuses.map(orderStatusDetail)
              : filteredPaymentStatuses.map(paymentStatusDetail);

  // The drawer holds a descriptor, so one component serves every collection.
  const editFromDrawer = (): void => {
    const detail = drawerDetail;
    setDrawerDetail(null);

    if (!detail) return;

    if (collection === "units") {
      const unit = unitsQuery.data?.find((item) => item.id === detail.id);
      if (unit) openEditUnitDialog(unit);
      return;
    }

    if (collection === "product-categories") {
      const category = productCategoriesQuery.data?.find((item) => item.id === detail.id);
      if (category) openEditProductCategoryDialog(category);
      return;
    }

    if (collection === "ingredient-categories" || collection === "packaging-categories") {
      const source =
        collection === "ingredient-categories"
          ? ingredientCategoriesQuery.data
          : packagingCategoriesQuery.data;
      const category = source?.find((item) => item.id === detail.id);
      if (category) openEditSimpleCategoryDialog(category);
      return;
    }

    if (collection === "order-statuses") {
      const status = orderStatusesQuery.data?.find((item) => item.id === detail.id);
      if (status) openEditOrderStatusDialog(status);
      return;
    }

    const status = paymentStatusesQuery.data?.find((item) => item.id === detail.id);
    if (status) openEditPaymentStatusDialog(status);
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        title={titles[collection]}
        description={descriptions[collection]}
        actions={
          collection === "units" && canManage ? (
            <Button onClick={openCreateUnitDialog}>
              <Plus className="h-4 w-4" />
              Create unit
            </Button>
          ) : collection === "product-categories" && canManage ? (
            <>
              {copyLabel ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Button
                          disabled={Boolean(copyDisabledReason)}
                          type="button"
                          variant="outline"
                          onClick={openCopyCategoryDialog}
                        >
                          <Copy className="h-4 w-4" />
                          {copyLabel.button}
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>{copyDisabledReason ?? copyLabel.tooltip}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : null}
              <Button onClick={openCreateProductCategoryDialog}>
                <Plus className="h-4 w-4" />
                Create category
              </Button>
            </>
          ) : (collection === "ingredient-categories" || collection === "packaging-categories") &&
            canManage ? (
            <>
              {copyLabel ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Button
                          disabled={Boolean(copyDisabledReason)}
                          type="button"
                          variant="outline"
                          onClick={openCopyCategoryDialog}
                        >
                          <Copy className="h-4 w-4" />
                          {copyLabel.button}
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>{copyDisabledReason ?? copyLabel.tooltip}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : null}
              <Button onClick={openCreatePackagingCategoryDialog}>
                <Plus className="h-4 w-4" />
                Create category
              </Button>
            </>
          ) : collection === "order-statuses" && canManage ? (
            <Button onClick={openCreateOrderStatusDialog}>
              <Plus className="h-4 w-4" />
              Create status
            </Button>
          ) : collection === "payment-statuses" && canManage ? (
            <Button onClick={openCreatePaymentStatusDialog}>
              <Plus className="h-4 w-4" />
              Create status
            </Button>
          ) : null
        }
      />
      {copyLabel ? (
        <CategoryCopyDialog
          activeSourceBranches={activeCopySourceBranches}
          copyLabel={copyLabel.short}
          currentBranchName={currentBranchName}
          disabledReason={copyDisabledReason}
          isBranchesLoading={branchesQuery.isLoading}
          isSubmitting={copyCategoriesMutation.isPending}
          open={copyDialogOpen}
          selectedSourceBranchId={copySourceBranchId}
          onOpenChange={setCopyDialogOpen}
          onSourceBranchChange={setCopySourceBranchId}
          onSubmit={handleCopyCategories}
        />
      ) : null}
      {/* A card that held only a title and did nothing is gone. The page
          heading already says what this screen is. */}
      <MasterDataToolbar
        filters={filters}
        noun={titles[collection].toLowerCase()}
        onFiltersChange={setFilters}
      />

      {/* Five tables of up to seven columns, none of which survives 375px.
          Below md the active collection renders as cards instead. */}
      {!activeQuery.isLoading && !activeQuery.error && activeDetails.length > 0 ? (
        <div className="md:hidden">
          <MasterDataCardGrid details={activeDetails} onView={setDrawerDetail} />
        </div>
      ) : null}

      {!activeQuery.isLoading && !activeQuery.error && activeDetails.length === 0 ? (
        <FilteredState
          noun={titles[collection].toLowerCase()}
          onClearFilters={() => setFilters(defaultMasterDataFilters)}
          query={filters.search.trim() || undefined}
        />
      ) : null}

      <MasterDataDetailsDrawer
        canManage={canManage}
        detail={drawerDetail}
        onEdit={editFromDrawer}
        onOpenChange={(open) => (!open ? setDrawerDetail(null) : undefined)}
        open={drawerDetail !== null}
      />
      {activeQuery.isLoading ? <LoadingCard /> : null}
      {activeQuery.error ? <ErrorCard>{getErrorMessage(activeQuery.error)}</ErrorCard> : null}
      {collection === "units" && unitsQuery.data ? (
        <Card className="hidden overflow-hidden md:block">
          <CardContent className="p-0">
            <UnitsTable
              canManage={canManage}
              units={filteredUnits}
              onDeactivate={(unit) => {
                void handleUnitDeactivate(unit);
              }}
              onEdit={openEditUnitDialog}
              onView={(unit) => setDrawerDetail(unitDetail(unit))}
              onStatusChange={(unit, status) => {
                void handleUnitStatusChange(unit, status);
              }}
            />
          </CardContent>
        </Card>
      ) : null}
      {collection === "units" ? (
        <UnitDialog
          isSubmitting={unitSubmitting}
          open={unitDialogOpen}
          unit={selectedUnit}
          unitCategories={unitCategoriesQuery.data ?? []}
          units={unitsQuery.data ?? []}
          onOpenChange={setUnitDialogOpen}
          onSubmit={handleUnitSubmit}
        />
      ) : null}
      {collection === "product-categories" && productCategoriesQuery.data ? (
        <Card className="hidden overflow-hidden md:block">
          <CardContent className="p-0">
            <ProductCategoriesTable
              canManage={canManage}
              categories={filteredProductCategories}
              onDeactivate={(category) => {
                void handleProductCategoryDeactivate(category);
              }}
              onEdit={openEditProductCategoryDialog}
              onView={(category) => setDrawerDetail(productCategoryDetail(category))}
              onStatusChange={(category, status) => {
                void handleProductCategoryStatusChange(category, status);
              }}
            />
          </CardContent>
        </Card>
      ) : null}
      {collection === "product-categories" ? (
        <ProductCategoryDialog
          category={selectedProductCategory}
          isSubmitting={productCategorySubmitting}
          open={productDialogOpen}
          onOpenChange={setProductDialogOpen}
          onSubmit={handleProductCategorySubmit}
        />
      ) : null}
      {collection === "ingredient-categories" && ingredientCategoriesQuery.data ? (
        <Card className="hidden overflow-hidden md:block">
          <CardContent className="p-0">
            <SimpleCategoriesTable
              canManage={canManage}
              categories={filteredIngredientCategories}
              noun="ingredient categories"
              onDeactivate={(category) => {
                void handleSimpleCategoryDeactivate(category);
              }}
              onEdit={openEditSimpleCategoryDialog}
              onView={(category) => setDrawerDetail(simpleCategoryDetail(category))}
              onStatusChange={(category, status) => {
                void handleSimpleCategoryStatusChange(category, status);
              }}
            />
          </CardContent>
        </Card>
      ) : null}
      {collection === "packaging-categories" && packagingCategoriesQuery.data ? (
        <Card className="hidden overflow-hidden md:block">
          <CardContent className="p-0">
            <SimpleCategoriesTable
              canManage={canManage}
              categories={filteredPackagingCategories}
              noun="packaging categories"
              onDeactivate={(category) => {
                void handleSimpleCategoryDeactivate(category);
              }}
              onEdit={openEditSimpleCategoryDialog}
              onView={(category) => setDrawerDetail(simpleCategoryDetail(category))}
              onStatusChange={(category, status) => {
                void handleSimpleCategoryStatusChange(category, status);
              }}
            />
          </CardContent>
        </Card>
      ) : null}
      {collection === "ingredient-categories" || collection === "packaging-categories" ? (
        <SimpleCategoryDialog
          category={selectedSimpleCategory}
          isSubmitting={simpleCategorySubmitting}
          open={simpleDialogOpen}
          title={
            activeSimpleCollection === "ingredient-categories"
              ? "ingredient category"
              : "packaging category"
          }
          onOpenChange={setSimpleDialogOpen}
          onSubmit={handleSimpleCategorySubmit}
        />
      ) : null}
      {collection === "order-statuses" && orderStatusesQuery.data ? (
        <Card className="hidden overflow-hidden md:block">
          <CardContent className="p-0">
            <OrderStatusesTable
              canManage={canManage}
              statuses={filteredOrderStatuses}
              onEdit={openEditOrderStatusDialog}
              onView={(status) => setDrawerDetail(orderStatusDetail(status))}
              onStatusChange={(status, recordStatus) => {
                void handleOrderStatusStatusChange(status, recordStatus);
              }}
            />
          </CardContent>
        </Card>
      ) : null}
      {collection === "order-statuses" ? (
        <OrderStatusDialog
          isSubmitting={orderStatusSubmitting}
          open={orderStatusDialogOpen}
          status={selectedOrderStatus}
          onOpenChange={setOrderStatusDialogOpen}
          onSubmit={handleOrderStatusSubmit}
        />
      ) : null}
      {collection === "payment-statuses" && paymentStatusesQuery.data ? (
        <Card className="hidden overflow-hidden md:block">
          <CardContent className="p-0">
            <PaymentStatusesTable
              canManage={canManage}
              statuses={filteredPaymentStatuses}
              onEdit={openEditPaymentStatusDialog}
              onView={(status) => setDrawerDetail(paymentStatusDetail(status))}
              onStatusChange={(status, recordStatus) => {
                void handlePaymentStatusStatusChange(status, recordStatus);
              }}
            />
          </CardContent>
        </Card>
      ) : null}
      {collection === "payment-statuses" ? (
        <PaymentStatusDialog
          isSubmitting={paymentStatusSubmitting}
          open={paymentStatusDialogOpen}
          status={selectedPaymentStatus}
          onOpenChange={setPaymentStatusDialogOpen}
          onSubmit={handlePaymentStatusSubmit}
        />
      ) : null}
    </div>
  );
}
