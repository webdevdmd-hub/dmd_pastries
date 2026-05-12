"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { JSX } from "react";

import { SupplierActionsMenu } from "@/components/suppliers/supplier-actions-menu";
import { SupplierStatusBadge } from "@/components/suppliers/supplier-status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ROUTES } from "@/constants/routes";
import type { Supplier } from "@/types/supplier";

type SuppliersTableProps = {
  canManage: boolean;
  onDelete: (supplier: Supplier) => void;
  onEdit: (supplier: Supplier) => void;
  onStatusChange: (supplier: Supplier, status: Supplier["status"]) => void;
  suppliers: Supplier[];
};

function formatDate(value: string): string {
  return value
    ? new Intl.DateTimeFormat("en-AE", { dateStyle: "medium" }).format(new Date(value))
    : "Not recorded";
}

function locationText(supplier: Supplier): string {
  const parts = [supplier.country, supplier.city].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );

  return parts.length > 0 ? parts.join(" / ") : "Not set";
}

export function SuppliersTable({
  canManage,
  onDelete,
  onEdit,
  onStatusChange,
  suppliers,
}: SuppliersTableProps): JSX.Element {
  const router = useRouter();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Supplier</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Primary Contact</TableHead>
          <TableHead>Phone</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Country/City</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Created At</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {suppliers.map((supplier) => (
          <TableRow key={supplier.id}>
            <TableCell>
              <Link className="grid gap-1" href={`${ROUTES.suppliers}/${supplier.id}`}>
                <span className="font-semibold text-brand-espresso">{supplier.supplierName}</span>
                <span className="text-xs text-brand-mocha">{supplier.supplierCode}</span>
              </Link>
            </TableCell>
            <TableCell>{supplier.supplierCategoryName ?? "Uncategorized"}</TableCell>
            <TableCell>
              {supplier.primaryContact ? (
                <span className="grid gap-1">
                  <span className="font-medium">{supplier.primaryContact.contactName}</span>
                  <span className="text-xs text-brand-mocha">
                    {supplier.primaryContact.contactRole ?? "Primary contact"}
                  </span>
                </span>
              ) : (
                "Not set"
              )}
            </TableCell>
            <TableCell>{supplier.phone ?? "Not set"}</TableCell>
            <TableCell>{supplier.email ?? "Not set"}</TableCell>
            <TableCell>{locationText(supplier)}</TableCell>
            <TableCell>
              <SupplierStatusBadge status={supplier.status} />
            </TableCell>
            <TableCell>{formatDate(supplier.createdAt)}</TableCell>
            <TableCell>
              <SupplierActionsMenu
                canManage={canManage}
                onDelete={onDelete}
                onEdit={onEdit}
                onStatusChange={onStatusChange}
                onView={(selectedSupplier) =>
                  router.push(`${ROUTES.suppliers}/${selectedSupplier.id}`)
                }
                supplier={supplier}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
