import type { JSX } from "react";

import { formatCurrency, formatNumber } from "@/components/reports/sales/sales-report-format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ProductSalesRow } from "@/types/sales-reports";

export function TopProductsCard({ products }: { products: ProductSalesRow[] }): JSX.Element {
  return (
    <Card className="bg-white/85 shadow-soft">
      <CardHeader>
        <CardTitle className="text-brand-espresso">Top Products</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {products.slice(0, 5).map((product) => (
          <div
            className="flex items-center justify-between gap-4 rounded-2xl bg-brand-latte/60 p-3"
            key={product.productId || product.productName}
          >
            <div>
              <p className="font-medium text-brand-espresso">
                {product.productName || "Unnamed product"}
              </p>
              <p className="text-sm text-brand-mocha">{formatNumber(product.quantitySold)} sold</p>
            </div>
            <p className="font-semibold text-brand-espresso">{formatCurrency(product.netSales)}</p>
          </div>
        ))}
        {products.length === 0 ? (
          <p className="text-sm text-brand-mocha">No top products returned.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
