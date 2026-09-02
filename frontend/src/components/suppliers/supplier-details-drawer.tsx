"use client";

import { ExternalLink, Pencil } from "lucide-react";
import Link from "next/link";
import type { JSX } from "react";
import { useState } from "react";

import { AccessDeniedCard } from "@/components/suppliers/access-denied-card";
import {
  DEFAULT_SUPPLIER_DETAIL_TAB,
  type SupplierDetailTabKey,
} from "@/components/suppliers/supplier-detail-tabs";
import { SupplierDetailsPanel } from "@/components/suppliers/supplier-details-panel";
import { SupplierStatusBadge } from "@/components/suppliers/supplier-status-badge";
import { SuppliersErrorState } from "@/components/suppliers/suppliers-error-state";
import { SuppliersTableSkeleton } from "@/components/suppliers/suppliers-table-skeleton";
import { useSupplierDetailPermissions } from "@/components/suppliers/use-supplier-detail-permissions";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ROUTES } from "@/constants/routes";
import { useSupplier } from "@/hooks/use-suppliers";
import { getErrorMessage } from "@/lib/api/client";
import type { Supplier } from "@/types/supplier";

type SupplierDetailsDrawerProps = {
  /** Opens the edit form in the host's own modal flow. */
  onEdit?: ((supplier: Supplier) => void) | undefined;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  supplierId: string | null;
};

/**
 * One supplier's details in a sheet over the suppliers list, the way a
 * customer's details open over the customers list. The tab is plain state
 * here: the list's URL stays the list's, and the header offers the full page
 * for anyone who wants a URL to share.
 */
export function SupplierDetailsDrawer({
  onEdit,
  onOpenChange,
  open,
  supplierId,
}: SupplierDetailsDrawerProps): JSX.Element {
  const permissions = useSupplierDetailPermissions();
  const supplierQuery = useSupplier(supplierId, open && supplierId !== null && permissions.canView);

  // Radix requires a title in every dialog. The body renders the supplier's
  // name; the states before it name the sheet invisibly.
  const fallbackTitle = (
    <SheetHeader className="sr-only">
      <SheetTitle>Supplier details</SheetTitle>
      <SheetDescription>Details of the selected supplier.</SheetDescription>
    </SheetHeader>
  );

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
        {!permissions.canView ? (
          <>
            {fallbackTitle}
            <AccessDeniedCard />
          </>
        ) : supplierQuery.isLoading ? (
          <>
            {fallbackTitle}
            <SuppliersTableSkeleton />
          </>
        ) : supplierQuery.error || !supplierQuery.data ? (
          <>
            {fallbackTitle}
            <SuppliersErrorState
              description={
                supplierQuery.error ? getErrorMessage(supplierQuery.error) : "Supplier not found."
              }
              onRetry={() => void supplierQuery.refetch()}
            />
          </>
        ) : (
          // Keyed by supplier so switching suppliers resets the tab.
          <SupplierDetailsDrawerBody
            canManage={permissions.canManage}
            canView={permissions.canView}
            key={supplierQuery.data.id}
            onEdit={onEdit}
            supplier={supplierQuery.data}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function SupplierDetailsDrawerBody({
  canManage,
  canView,
  onEdit,
  supplier,
}: {
  canManage: boolean;
  canView: boolean;
  onEdit: ((supplier: Supplier) => void) | undefined;
  supplier: Supplier;
}): JSX.Element {
  const [activeTab, setActiveTab] = useState<SupplierDetailTabKey>(DEFAULT_SUPPLIER_DETAIL_TAB);
  const detailHref = `${ROUTES.suppliers}/${supplier.id}`;

  return (
    <div className="flex flex-col gap-6">
      <SheetHeader>
        <div className="flex flex-wrap items-center gap-3 pr-8">
          <SheetTitle className="text-page">{supplier.supplierName}</SheetTitle>
          {/* One badge, exceptions only: Active is the default state. */}
          {supplier.status === "active" ? null : <SupplierStatusBadge status={supplier.status} />}
        </div>
        <SheetDescription className="font-mono text-meta">{supplier.supplierCode}</SheetDescription>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button asChild size="sm" variant="outline">
            <Link href={detailHref}>
              <ExternalLink className="h-4 w-4" />
              Open full page
            </Link>
          </Button>
          {canManage && onEdit ? (
            <Button onClick={() => onEdit(supplier)} size="sm" type="button" variant="outline">
              <Pencil className="h-4 w-4" />
              Edit supplier
            </Button>
          ) : null}
        </div>
      </SheetHeader>

      <SupplierDetailsPanel
        activeTab={activeTab}
        canManage={canManage}
        canView={canView}
        onTabChange={setActiveTab}
        supplier={supplier}
      />
    </div>
  );
}
