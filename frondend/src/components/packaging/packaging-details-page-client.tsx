"use client";

import Link from "next/link";
import type { JSX } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { AccessDeniedCard } from "@/components/packaging/access-denied-card";
import { PackagingErrorState } from "@/components/packaging/packaging-error-state";
import { PackagingFormDialog } from "@/components/packaging/packaging-form-dialog";
import { PackagingProfileCard } from "@/components/packaging/packaging-profile-card";
import { PackagingStatusBadge } from "@/components/packaging/packaging-status-badge";
import { PackagingTableSkeleton } from "@/components/packaging/packaging-table-skeleton";
import { PackagingUsageSection } from "@/components/packaging/packaging-usage-section";
import { LegacyProductMasterNotice } from "@/components/shared/legacy-product-master-notice";
import { Button } from "@/components/ui/button";
import { PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import {
  usePackagingCategories,
  usePackagingItem,
  usePackagingSupplierLookup,
  usePackagingUnits,
  useUpdatePackaging,
} from "@/hooks/use-packaging";
import { usePermission } from "@/hooks/use-permission";
import { getErrorMessage } from "@/lib/api/client";
import type { UpdatePackagingPayload } from "@/types/packaging";

export function PackagingDetailsPageClient({ packagingId }: { packagingId: string }): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const canView = hasAnyPermission([PERMISSIONS.packagingView, PERMISSIONS.masterDataView]);
  const canManage = hasAnyPermission([
    PERMISSIONS.packagingEdit,
    PERMISSIONS.packagingStatusUpdate,
    PERMISSIONS.packagingUsageRulesManage,
  ]);
  const [editOpen, setEditOpen] = useState(false);
  const packagingQuery = usePackagingItem(packagingId, canView);
  const categoriesQuery = usePackagingCategories(canView);
  const suppliersQuery = usePackagingSupplierLookup("", canView);
  const unitsQuery = usePackagingUnits(canView);
  const updateMutation = useUpdatePackaging();
  const noopCreate = (): Promise<void> => Promise.resolve();

  if (!canView) {
    return <AccessDeniedCard />;
  }

  if (packagingQuery.isLoading) {
    return <PackagingTableSkeleton />;
  }

  if (packagingQuery.error || !packagingQuery.data) {
    return (
      <PackagingErrorState
        description={
          packagingQuery.error ? getErrorMessage(packagingQuery.error) : "Packaging item not found."
        }
        onRetry={() => {
          void packagingQuery.refetch();
        }}
      />
    );
  }

  const categories = categoriesQuery.data ?? [];
  const rawItem = packagingQuery.data;
  const item = {
    ...rawItem,
    packagingCategoryName:
      rawItem.packagingCategoryName !== "Uncategorized"
        ? rawItem.packagingCategoryName
        : (categories.find((category) => category.id === rawItem.packagingCategoryId)
            ?.categoryName ?? rawItem.packagingCategoryName),
  };

  const updatePackaging = async (id: string, payload: UpdatePackagingPayload): Promise<void> => {
    try {
      await updateMutation.mutateAsync({ id, payload });
      toast.success("Packaging item updated.");
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
            href={ROUTES.packaging}
          >
            Back to Packaging
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h1 className="font-display text-4xl text-brand-espresso">{item.packagingName}</h1>
            <PackagingStatusBadge status={item.status} />
          </div>
          <p className="mt-2 text-sm text-brand-mocha">{item.packagingCode}</p>
        </div>
        {canManage ? (
          <Button onClick={() => setEditOpen(true)} type="button">
            Edit packaging
          </Button>
        ) : null}
      </div>

      <LegacyProductMasterNotice kind="packaging" />

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <PackagingProfileCard item={item} />
        <PackagingUsageSection canManage={canManage} item={item} />
      </div>

      <PackagingFormDialog
        categories={categoriesQuery.data ?? []}
        isSubmitting={updateMutation.isPending}
        item={item}
        onClose={() => setEditOpen(false)}
        onCreate={noopCreate}
        onUpdate={updatePackaging}
        open={editOpen}
        suppliers={suppliersQuery.data ?? []}
        units={unitsQuery.data ?? []}
      />
    </div>
  );
}
