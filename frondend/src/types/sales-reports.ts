export type SalesReportGroupBy = "day" | "week" | "month";

export type SalesReportSortOrder = "asc" | "desc";

export type SalesReportFilters = {
  branchId?: string;
  dateFrom: string;
  dateTo: string;
  timezone?: string;
  groupBy?: SalesReportGroupBy;
  cashierUserId?: string;
  productId?: string;
  categoryId?: string;
  paymentStatus?: string;
  saleStatus?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: SalesReportSortOrder;
};

export type SalesSummary = {
  grossSales: number;
  netSales: number;
  salesCount: number;
  itemsSold: number;
  averageOrderValue: number;
  discountTotal: number;
  taxTotal: number;
  refundTotal: number;
  voidedSalesCount: number;
  grossSalesChangePercentage: number;
  netSalesChangePercentage: number;
  salesCountChangePercentage: number;
};

export type DailySalesRow = {
  date: string;
  grossSales: number;
  netSales: number;
  salesCount: number;
  itemsSold: number;
  discountTotal: number;
  taxTotal: number;
};

export type ProductSalesRow = {
  productId: string;
  productName: string;
  sku: string;
  quantitySold: number;
  grossSales: number;
  discountTotal: number;
  taxTotal: number;
  netSales: number;
};

export type CategorySalesRow = {
  categoryId: string;
  categoryName: string;
  quantitySold: number;
  salesCount: number;
  grossSales: number;
  netSales: number;
};

export type CashierSalesRow = {
  cashierUserId: string;
  cashierName: string;
  salesCount: number;
  itemsSold: number;
  grossSales: number;
  netSales: number;
  refundCount: number;
  voidCount: number;
};

export type BranchSalesRow = {
  branchId: string;
  branchName: string;
  salesCount: number;
  itemsSold: number;
  grossSales: number;
  netSales: number;
  taxTotal: number;
};

export type DiscountReportItem = {
  saleNumber: string;
  cashierName: string;
  discountType: string;
  discountAmount: number;
  saleTotal: number;
  soldAt: string;
};

export type DiscountReport = {
  totalDiscount: number;
  saleLevelDiscount: number;
  lineLevelDiscount: number;
  discountedSalesCount: number;
  discountPercentageOfGrossSales: number;
  items: DiscountReportItem[];
};

export type TaxReportRow = {
  taxRateId: string;
  taxName: string;
  taxPercentage: number;
  taxableAmount: number;
  taxCollected: number;
  salesCount: number;
};

export type SalesTrendDataset = {
  label: string;
  data: number[];
};

export type SalesTrendChart = {
  labels: string[];
  datasets: SalesTrendDataset[];
};
