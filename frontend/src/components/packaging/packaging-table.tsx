"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { JSX } from "react";

import { PackagingActionsMenu } from "@/components/packaging/packaging-actions-menu";
import { PackagingStatusBadge } from "@/components/packaging/packaging-status-badge";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ROUTES } from "@/constants/routes";
import type { PackagingItem } from "@/types/packaging";

type PackagingTableProps = {
  canManage: boolean;
  items: PackagingItem[];
  onDelete: (item: PackagingItem) => void;
  onEdit: (item: PackagingItem) => void;
  onStatusChange: (item: PackagingItem, status: PackagingItem["status"]) => void;
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

function formatDate(value: string): string {
  return value
    ? new Intl.DateTimeFormat("en-AE", { dateStyle: "medium" }).format(new Date(value))
    : "Not recorded";
}

export function PackagingTable({
  canManage,
  items,
  onDelete,
  onEdit,
  onStatusChange,
}: PackagingTableProps): JSX.Element {
  const router = useRouter();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Packaging</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Supplier</TableHead>
          <TableHead>Unit</TableHead>
          <TableHead>Cost</TableHead>
          <TableHead>Stock Tracked</TableHead>
          <TableHead>Reorder Level</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Created At</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow className={item.status === "inactive" ? "opacity-65" : ""} key={item.id}>
            <TableCell>
              <Link className="grid gap-1" href={`${ROUTES.packaging}/${item.id}`}>
                <span className="font-semibold text-brand-espresso">{item.packagingName}</span>
                <span className="text-xs text-brand-mocha">{item.packagingCode}</span>
              </Link>
            </TableCell>
            <TableCell>{item.packagingCategoryName}</TableCell>
            <TableCell>{item.supplierName ?? "Not linked"}</TableCell>
            <TableCell>
              {item.unitName} ({item.unitSymbol})
            </TableCell>
            <TableCell>{formatCurrency(item.costPerUnit)}</TableCell>
            <TableCell>
              <Badge variant="outline">{item.isStockTracked ? "Tracked" : "Not tracked"}</Badge>
            </TableCell>
            <TableCell>
              {item.reorderLevel} {item.unitSymbol}
            </TableCell>
            <TableCell>
              <PackagingStatusBadge status={item.status} />
            </TableCell>
            <TableCell>{formatDate(item.createdAt)}</TableCell>
            <TableCell>
              <PackagingActionsMenu
                canManage={canManage}
                item={item}
                onDelete={onDelete}
                onEdit={onEdit}
                onStatusChange={onStatusChange}
                onView={(selectedItem) => router.push(`${ROUTES.packaging}/${selectedItem.id}`)}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
