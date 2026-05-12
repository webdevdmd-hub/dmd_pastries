"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import type { JSX } from "react";

import { ProductActionsMenu } from "@/components/products/product-actions-menu";
import { ProductStatusBadge } from "@/components/products/product-status-badge";
import { ProductTypeBadge } from "@/components/products/product-type-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getProductImagePreviewUrl } from "@/lib/appwrite/storage";
import type { Product, ProductStatus } from "@/types/product";

type ProductsTableProps = {
  canManage: boolean;
  onDelete: (product: Product) => void;
  onEdit: (product: Product) => void;
  onManageVariants: (product: Product) => void;
  onStatusChange: (product: Product, status: ProductStatus) => void;
  onView: (product: Product) => void;
  products: Product[];
};

function initials(value: string): string {
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((item) => item[0]?.toUpperCase() ?? "")
    .join("");
}

export function ProductsTable({
  canManage,
  onDelete,
  onEdit,
  onManageVariants,
  onStatusChange,
  onView,
  products,
}: ProductsTableProps): JSX.Element {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product</TableHead>
            <TableHead>Code/SKU</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Unit</TableHead>
            <TableHead>Sale Price</TableHead>
            <TableHead>Tax</TableHead>
            <TableHead>POS Visible</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Updated At</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => (
            <TableRow key={product.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarImage
                      alt={product.productName}
                      src={getProductImagePreviewUrl(product.imageFileId) ?? product.imageUrl ?? ""}
                    />
                    <AvatarFallback>{initials(product.productName)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-brand-espresso">{product.productName}</p>
                    <p className="text-xs text-brand-mocha">
                      {product.description ?? product.productCode}
                    </p>
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-sm text-brand-mocha">
                {product.productCode}
                <br />
                {product.sku ?? "-"}
              </TableCell>
              <TableCell>{product.categoryName}</TableCell>
              <TableCell>
                <ProductTypeBadge type={product.productType} />
              </TableCell>
              <TableCell>{product.unitName}</TableCell>
              <TableCell>{product.salePrice.toFixed(2)}</TableCell>
              <TableCell>{product.taxRateName ?? "-"}</TableCell>
              <TableCell>
                {product.isPosVisible ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                    Yes
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-brand-mocha">
                    <XCircle className="h-4 w-4" />
                    No
                  </span>
                )}
              </TableCell>
              <TableCell>
                <ProductStatusBadge status={product.status} />
              </TableCell>
              <TableCell>{new Date(product.updatedAt).toLocaleString()}</TableCell>
              <TableCell className="text-right">
                <ProductActionsMenu
                  canManage={canManage}
                  onDelete={onDelete}
                  onEdit={onEdit}
                  onManageVariants={onManageVariants}
                  onStatusChange={onStatusChange}
                  onView={onView}
                  product={product}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
