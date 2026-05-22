import type { ProductCategory } from "@/types/master-data";
import type { ProductType } from "@/types/product";
import type { PaymentMethod, RecordStatus } from "@/types/settings";

export type POSProductVariant = {
  id: string;
  productId: string;
  variantName: string;
  sku: string | null;
  barcode: string | null;
  salePrice: number;
  currentStockQuantity: number | null;
  availableStockQuantity: number | null;
  imageUrl: string | null;
  imageFileId: string | null;
  status: RecordStatus;
};

export type POSProduct = {
  id: string;
  productName: string;
  productCode: string;
  sku: string | null;
  barcode: string | null;
  categoryId: string | null;
  categoryName: string;
  unitName: string;
  taxRateName: string | null;
  taxRatePercentage: number;
  productType: ProductType;
  salePrice: number;
  isStockTracked: boolean;
  currentStockQuantity: number | null;
  availableStockQuantity: number | null;
  imageUrl: string | null;
  imageFileId: string | null;
  isPosVisible: boolean;
  variants: POSProductVariant[];
  status: RecordStatus;
};

export type POSProductFilters = {
  categoryId: string;
  search: string;
  limit: number;
};

export type POSLookupParams = {
  query: string;
};

export type CartDiscountType = "fixed" | "percentage";

export type CartItem = {
  cartItemId: string;
  productId: string;
  productVariantId: string | null;
  productName: string;
  variantName: string | null;
  sku: string | null;
  imageUrl: string | null;
  imageFileId: string | null;
  quantity: number;
  unitPrice: number;
  discountType: CartDiscountType | null;
  discountValue: number | null;
  taxRatePercentage: number;
  taxRateName: string | null;
  lineSubtotal: number;
  discountAmount: number;
  taxAmount: number;
  lineTotal: number;
};

export type PaymentInput = {
  paymentMethodId: string;
  paymentMethodName: string;
  amount: number;
  referenceNumber: string | null;
};

export type CartTotals = {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  paidAmount: number;
  changeAmount: number;
  balanceDue: number;
};

export type CheckoutPayload = {
  branchId: string;
  customerId: string | null;
  items: {
    productId: string;
    productVariantId: string | null;
    quantity: number;
    unitPrice: number;
    discountType: CartDiscountType | null;
    discountValue: number | null;
  }[];
  saleDiscountType: CartDiscountType | null;
  saleDiscountValue: number | null;
  payments: PaymentInput[];
  notes: string | null;
};

export type HeldSaleStatus = "held" | "resumed" | "cancelled";

export type HoldSalePayload = {
  branchId: string;
  customerId: string | null;
  items: CartItem[];
  saleDiscountType: CartDiscountType | null;
  saleDiscountValue: number | null;
  totals: CartTotals;
  notes: string | null;
};

export type HeldSale = {
  id: string;
  holdNumber: string;
  branchId: string;
  customerId: string | null;
  customerName: string | null;
  itemCount: number;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  status: HeldSaleStatus;
  notes: string | null;
  heldAt: string;
  updatedAt: string;
};

export type HeldSaleResumeData = {
  heldSale: HeldSale;
  items: CartItem[];
  saleDiscountType: CartDiscountType | null;
  saleDiscountValue: number | null;
  customerId: string | null;
};

export type ReceiptLine = {
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type SaleReceipt = {
  businessName: string;
  branchName: string;
  saleId: string;
  saleNumber: string;
  cashierName: string;
  soldAt: string;
  items: ReceiptLine[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  payments: PaymentInput[];
  paidAmount: number;
  changeAmount: number;
  balanceDue: number;
};

export type CheckoutResponse = {
  sale: {
    id: string;
    saleNumber: string;
  };
  receipt: SaleReceipt;
};

export type POSReferenceData = {
  categories: ProductCategory[];
  paymentMethods: PaymentMethod[];
};
