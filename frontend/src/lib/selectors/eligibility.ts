import type { ChartAccount, PaymentAccount } from "@/types/accounting";
import type { Branch } from "@/types/branch";
import type { Product, ProductType } from "@/types/product";
import type { PaymentMethod, TaxRate } from "@/types/settings";

export type SelectorContext =
  | "pos_product"
  | "bakery_order_product"
  | "purchase_line_product"
  | "recipe_component"
  | "expense_paid_through"
  | "journal_line_account"
  | "transaction_tax"
  | "branch_scope"
  | "user_assignment";

const RECIPE_COMPONENT_PRODUCT_TYPES = new Set<ProductType>([
  "ingredient",
  "packaging",
  "raw_material",
  "semi_finished",
  "finished_product",
]);

export type RecipeComponentCandidate = {
  id: string;
  productType: ProductType;
  isStockTracked: boolean;
  status?: string;
};

export type PurchasableProductCandidate = {
  isPurchasable: boolean;
  status?: string;
};

export function isSelectableBranch(branch: Branch, allowedBranchIds?: readonly string[]): boolean {
  return (
    branch.status === "active" &&
    (allowedBranchIds === undefined ||
      allowedBranchIds.length === 0 ||
      allowedBranchIds.includes(branch.id))
  );
}

export function isSelectableTaxRate(taxRate: TaxRate | { status: string }): boolean {
  return taxRate.status === "active";
}

export function isSellableProduct(product: Product): boolean {
  return product.status === "active" && product.isSellable;
}

export function isPosSelectableProduct(product: Product): boolean {
  return isSellableProduct(product) && product.isPosVisible;
}

export function isBakeryOrderProduct(product: Product): boolean {
  return isSellableProduct(product);
}

export function isPurchasableProduct(product: Product | PurchasableProductCandidate): boolean {
  return (product.status === undefined || product.status === "active") && product.isPurchasable;
}

export function isRecipeComponentProduct(
  product: Product | RecipeComponentCandidate,
  parentProductId?: string | null,
): boolean {
  return (
    (product.status === undefined || product.status === "active") &&
    product.id !== parentProductId &&
    product.isStockTracked &&
    RECIPE_COMPONENT_PRODUCT_TYPES.has(product.productType)
  );
}

export function isPaymentAccountForBranch(
  account: PaymentAccount,
  branchId?: string | null,
): boolean {
  return (
    account.status === "active" &&
    account.chartAccountType === "asset" &&
    account.chartAccountAllowManualPosting &&
    (account.branchId === null ||
      branchId === undefined ||
      branchId === null ||
      account.branchId === branchId)
  );
}

export function isPurchasingPaymentMethod(method: PaymentMethod): boolean {
  return method.status === "active" && method.showInPurchasing;
}

export function isBakeryPaymentMethod(method: PaymentMethod): boolean {
  return (
    method.status === "active" &&
    method.showInBakeryOrders &&
    Boolean(method.defaultPaymentAccountId)
  );
}

export function isLedgerAllowedForContext(
  account: ChartAccount,
  context: "journal_line_account" | "purchase_line_account" | "expense_category_account",
): boolean {
  if (account.status !== "active" || !account.allowManualPosting) {
    return false;
  }

  if (context === "purchase_line_account") {
    return (
      account.accountType === "asset" ||
      account.accountType === "expense" ||
      account.accountType === "cogs"
    );
  }

  if (context === "expense_category_account") {
    return account.accountType === "expense" || account.accountType === "cogs";
  }

  return true;
}
