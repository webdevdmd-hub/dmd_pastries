"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AccessDeniedCard } from "@/components/suppliers/access-denied-card";
import {
  parseSupplierDetailTab,
  supplierDetailTabHref,
  type SupplierDetailTabKey,
} from "@/components/suppliers/supplier-detail-tabs";
import { SupplierDetailsPanel } from "@/components/suppliers/supplier-details-panel";
import { SupplierFormDialog } from "@/components/suppliers/supplier-form-dialog";
import { SupplierStatusBadge } from "@/components/suppliers/supplier-status-badge";
import { SUPPLIER_STATUS_COPY } from "@/components/suppliers/supplier-status-copy";
import { SuppliersErrorState } from "@/components/suppliers/suppliers-error-state";
import { SuppliersTableSkeleton } from "@/components/suppliers/suppliers-table-skeleton";
import { useSupplierDetailPermissions } from "@/components/suppliers/use-supplier-detail-permissions";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { useSupplier, useUpdateSupplier, useUpdateSupplierStatus } from "@/hooks/use-suppliers";
import { getErrorMessage } from "@/lib/api/client";
import type { SupplierStatus, UpdateSupplierPayload } from "@/types/supplier";

export function SupplierDetailsPageClient({ supplierId }: { supplierId: string }): JSX.Element {
  const { canManage, canView } = useSupplierDetailPermissions();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [editOpen, setEditOpen] = useState(false);
  const supplierQuery = useSupplier(supplierId, canView);
  const updateMutation = useUpdateSupplier();
  const statusMutation = useUpdateSupplierStatus();
  const noopCreate = (): Promise<void> => Promise.resolve();

  const activeTab = parseSupplierDetailTab(searchParams.get("tab"));

  // Purchasing links to `${supplier}#statement`, which predates these tabs and
  // would otherwise land on Profile with no such anchor on the page. Honour it
  // once on mount and rewrite it to the query form.
  useEffect(() => {
    if (typeof window === "undefined" || window.location.hash !== "#statement") {
      return;
    }

    router.replace(supplierDetailTabHref(supplierId, "statement"), { scroll: false });
  }, [router, supplierId]);

  const changeTab = (tab: SupplierDetailTabKey): void => {
    const next = new URLSearchParams(searchParams.toString());
    if (tab === "profile") {
      next.delete("tab");
    } else {
      next.set("tab", tab);
    }
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

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

  // The details and the status live on different endpoints, so a save that
  // changes both is two calls. Status goes second: if it fails, the field edits
  // are already saved and only the status needs retrying.
  const updateSupplier = async (
    id: string,
    payload: UpdateSupplierPayload,
    nextStatus?: SupplierStatus,
  ): Promise<void> => {
    try {
      await updateMutation.mutateAsync({ id, payload });

      if (nextStatus) {
        await statusMutation.mutateAsync({ id, payload: { status: nextStatus } });
        toast.success(`Supplier updated and set to ${SUPPLIER_STATUS_COPY[nextStatus].label}.`);
      } else {
        toast.success("Supplier updated.");
      }

      setEditOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <Link
            className="inline-flex items-center gap-1.5 text-cell text-foreground-muted transition-colors hover:text-foreground"
            href={ROUTES.suppliers}
          >
            Back to suppliers
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-page">{supplier.supplierName}</h1>
            {/* One badge, exceptions only: Active is the default state and
                badging it everywhere is what made the header noisy. */}
            {supplier.status === "active" ? null : <SupplierStatusBadge status={supplier.status} />}
          </div>
          <p className="mt-1 font-mono text-meta text-foreground-muted">{supplier.supplierCode}</p>
        </div>
        {canManage ? (
          <Button onClick={() => setEditOpen(true)} type="button" variant="outline">
            Edit supplier
          </Button>
        ) : null}
      </div>

      <SupplierDetailsPanel
        activeTab={activeTab}
        canManage={canManage}
        canView={canView}
        onTabChange={changeTab}
        supplier={supplier}
      />

      <SupplierFormDialog
        isSubmitting={updateMutation.isPending || statusMutation.isPending}
        onClose={() => setEditOpen(false)}
        onCreate={noopCreate}
        onUpdate={updateSupplier}
        open={editOpen}
        supplier={supplier}
      />
    </div>
  );
}
