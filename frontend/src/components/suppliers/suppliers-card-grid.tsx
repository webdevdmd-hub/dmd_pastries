"use client";

import { Phone, Star } from "lucide-react";
import type { JSX } from "react";

import { SupplierActionsMenu } from "@/components/suppliers/supplier-actions-menu";
import { SupplierStatusBadge } from "@/components/suppliers/supplier-status-badge";
import { Absent, leadTimeText, locationText } from "@/components/suppliers/suppliers-table";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PAYMENT_TERMS_LABEL, type Supplier } from "@/types/supplier";

type SuppliersCardGridProps = {
  canManage: boolean;
  onDelete: (supplier: Supplier) => void;
  onEdit: (supplier: Supplier) => void;
  onStatusChange: (supplier: Supplier, status: Supplier["status"]) => void;
  onView: (supplier: Supplier) => void;
  suppliers: Supplier[];
};

/**
 * The suppliers list as cards, for phones: the six-column table has no honest
 * layout below md. Clicking a card opens the details drawer; the kebab stops
 * the click so it does not also open the drawer.
 */
export function SuppliersCardGrid({
  canManage,
  onDelete,
  onEdit,
  onStatusChange,
  onView,
  suppliers,
}: SuppliersCardGridProps): JSX.Element {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {suppliers.map((supplier) => {
        const location = locationText(supplier);
        const contactName = supplier.primaryContact?.contactName ?? null;
        const termsUnset = supplier.paymentTerms === "" && supplier.leadTimeDays === null;

        return (
          <Card
            className="cursor-pointer overflow-hidden transition-shadow duration-fast ease-out hover:shadow-sm"
            key={supplier.id}
            onClick={() => onView(supplier)}
          >
            <div className="flex items-start justify-between gap-3 border-b border-workspace-border px-4 py-3">
              <button
                className="grid min-w-0 gap-0.5 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                onClick={(event) => {
                  event.stopPropagation();
                  onView(supplier);
                }}
                type="button"
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  {supplier.isPreferred ? (
                    <Star
                      aria-label="Preferred supplier"
                      className="h-3.5 w-3.5 shrink-0 fill-current"
                      role="img"
                    />
                  ) : null}
                  <span className="truncate font-medium">{supplier.supplierName}</span>
                </span>
                <span className="whitespace-nowrap font-mono text-meta text-foreground-muted">
                  {supplier.supplierCode}
                </span>
              </button>
              <div
                className="flex shrink-0 items-center gap-2"
                onClick={(event) => event.stopPropagation()}
              >
                {supplier.status === "active" ? null : (
                  <SupplierStatusBadge status={supplier.status} />
                )}
                <SupplierActionsMenu
                  canManage={canManage}
                  onDelete={onDelete}
                  onEdit={onEdit}
                  onStatusChange={onStatusChange}
                  supplier={supplier}
                />
              </div>
            </div>

            <div className="grid gap-1.5 p-4 text-cell">
              <span className="flex min-w-0 items-center gap-2">
                <Phone className="h-3.5 w-3.5 shrink-0 text-foreground-muted" />
                {contactName === null && !supplier.phone ? (
                  <Absent />
                ) : (
                  <span className="min-w-0 truncate">
                    {contactName ?? <Absent />}
                    {supplier.phone ? (
                      <span className="ml-2 whitespace-nowrap text-meta tabular-nums text-foreground-muted">
                        {supplier.phone}
                      </span>
                    ) : null}
                  </span>
                )}
              </span>
            </div>

            <div className="grid grid-cols-2 border-t border-workspace-border bg-brand-latte/30">
              <div className="border-r border-workspace-border px-4 py-3">
                <p className="text-meta text-foreground-muted">Terms</p>
                {termsUnset ? (
                  <Badge className="mt-1" variant="warning">
                    Not set
                  </Badge>
                ) : (
                  <p className="mt-1 text-cell font-medium tabular-nums">
                    {supplier.paymentTerms === "" ? (
                      <Absent />
                    ) : (
                      PAYMENT_TERMS_LABEL[supplier.paymentTerms]
                    )}
                    <span className="ml-1.5 font-normal text-meta text-foreground-muted">
                      {leadTimeText(supplier.leadTimeDays)}
                    </span>
                  </p>
                )}
              </div>
              <div className="min-w-0 px-4 py-3">
                <p className="text-meta text-foreground-muted">Location</p>
                <p className="mt-1 truncate text-cell font-medium">{location ?? <Absent />}</p>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
