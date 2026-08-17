"use client";

import Link from "next/link";
import type { JSX } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { AccessDeniedCard } from "@/components/suppliers/access-denied-card";
import { SupplierContactsSection } from "@/components/suppliers/supplier-contacts-section";
import { SupplierFormDialog } from "@/components/suppliers/supplier-form-dialog";
import { SupplierNotesSection } from "@/components/suppliers/supplier-notes-section";
import { SupplierProfileCard } from "@/components/suppliers/supplier-profile-card";
import { SupplierPurchasingHistory } from "@/components/suppliers/supplier-purchasing-history";
import { SupplierStatsCards } from "@/components/suppliers/supplier-stats-cards";
import { SupplierStatusBadge } from "@/components/suppliers/supplier-status-badge";
import { SuppliersErrorState } from "@/components/suppliers/suppliers-error-state";
import { SuppliersTableSkeleton } from "@/components/suppliers/suppliers-table-skeleton";
import { Button } from "@/components/ui/button";
import { PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import { usePermission } from "@/hooks/use-permission";
import { useSupplier, useSupplierStats, useUpdateSupplier } from "@/hooks/use-suppliers";
import { getErrorMessage } from "@/lib/api/client";
import type { UpdateSupplierPayload } from "@/types/supplier";

export function SupplierDetailsPageClient({ supplierId }: { supplierId: string }): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const canView = hasAnyPermission([PERMISSIONS.suppliersView, PERMISSIONS.inventoryView]);
  const canManage = hasAnyPermission([
    PERMISSIONS.suppliersEdit,
    PERMISSIONS.suppliersStatusUpdate,
    PERMISSIONS.suppliersContactsManage,
    PERMISSIONS.suppliersNotesManage,
  ]);
  const [editOpen, setEditOpen] = useState(false);
  const supplierQuery = useSupplier(supplierId, canView);
  const statsQuery = useSupplierStats(supplierId, canView);
  const updateMutation = useUpdateSupplier();
  const noopCreate = (): Promise<void> => Promise.resolve();

  if (!canView) {
    return <AccessDeniedCard />;
  }

  if (supplierQuery.isLoading) {
    return <SuppliersTableSkeleton />;
  }

  if (supplierQuery.error || !supplierQuery.data) {
    return (
      <SuppliersErrorState
        description={
          supplierQuery.error ? getErrorMessage(supplierQuery.error) : "Supplier not found."
        }
        onRetry={() => {
          void supplierQuery.refetch();
        }}
      />
    );
  }

  const supplier = supplierQuery.data;

  const updateSupplier = async (id: string, payload: UpdateSupplierPayload): Promise<void> => {
    try {
      await updateMutation.mutateAsync({ id, payload });
      toast.success("Supplier updated.");
      setEditOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link
            className="text-sm font-semibold text-brand-mocha hover:text-brand-espresso"
            href={ROUTES.suppliers}
          >
            Back to Suppliers
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h1 className="font-serif text-4xl text-brand-espresso">{supplier.supplierName}</h1>
            <SupplierStatusBadge status={supplier.status} />
          </div>
          <p className="mt-2 text-sm text-brand-mocha">{supplier.supplierCode}</p>
        </div>
        {canManage ? (
          <Button onClick={() => setEditOpen(true)} type="button">
            Edit supplier
          </Button>
        ) : null}
      </div>

      <SupplierStatsCards stats={statsQuery.data} />

      <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <SupplierProfileCard supplier={supplier} />
        <SupplierContactsSection canManage={canManage} supplierId={supplier.id} />
      </div>

      <SupplierNotesSection canManage={canManage} supplierId={supplier.id} />

      <SupplierPurchasingHistory canView={canView} supplierId={supplier.id} />

      <SupplierFormDialog
        isSubmitting={updateMutation.isPending}
        onClose={() => setEditOpen(false)}
        onCreate={noopCreate}
        onUpdate={updateSupplier}
        open={editOpen}
        supplier={supplier}
      />
    </div>
  );
}
