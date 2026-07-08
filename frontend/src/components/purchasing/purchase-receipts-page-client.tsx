"use client";

import { Plus } from "lucide-react";
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AccessDeniedCard } from "@/components/purchasing/access-denied-card";
import { PurchaseEmptyState } from "@/components/purchasing/purchase-empty-state";
import { PurchaseErrorState } from "@/components/purchasing/purchase-error-state";
import { PurchaseReceiptsTable } from "@/components/purchasing/purchase-receipts-table";
import { PurchaseReceiveDialog } from "@/components/purchasing/purchase-receive-dialog";
import { PurchaseReturnDialog } from "@/components/purchasing/purchase-return-dialog";
import { PurchaseTableSkeleton } from "@/components/purchasing/purchase-table-skeleton";
import { PurchasingToolbar } from "@/components/purchasing/purchasing-toolbar";
import { NoBranchScopeCard } from "@/components/shared/no-branch-scope-card";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PERMISSIONS } from "@/constants/permissions";
import { useBranchScope } from "@/hooks/use-branch-scope";
import { useStockLocations } from "@/hooks/use-inventory";
import { usePermission } from "@/hooks/use-permission";
import {
  useCancelPurchaseReceipt,
  usePostPurchaseReceipt,
  usePurchaseReceipts,
  usePurchasingBranches,
  usePurchasingProducts,
  usePurchasingSuppliers,
  usePurchasingTaxRates,
  usePurchasingUnits,
  useReceivePurchase,
} from "@/hooks/use-purchasing";
import { ApiError, getErrorMessage } from "@/lib/api/client";
import type {
  PurchaseReceipt,
  PurchasingFilters,
  ReceivePurchasePayload,
} from "@/types/purchasing";

const defaultFilters: PurchasingFilters = {
  branchId: "",
  dateFrom: "",
  dateTo: "",
  search: "",
  status: "all",
  supplierId: "all",
};

const receiptStatuses = [
  { label: "Draft", value: "draft" },
  { label: "Posted", value: "posted" },
  { label: "Cancelled", value: "cancelled" },
];

type PendingAction = { receipt: PurchaseReceipt; type: "post" | "cancel" } | null;

export function PurchaseReceiptsPageClient(): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const branchScope = useBranchScope();
  const { normalizeBranchId } = branchScope;
  const canView = hasAnyPermission([PERMISSIONS.purchasingView, PERMISSIONS.inventoryView]);
  const canManage = hasAnyPermission([
    PERMISSIONS.purchasingReceiptsCreate,
    PERMISSIONS.purchasingReceiptsPost,
    PERMISSIONS.purchasingReceiptsCancel,
    PERMISSIONS.purchasingReceiveStock,
  ]);
  const canReturn = hasAnyPermission([
    PERMISSIONS.purchasingReturnsCreate,
    PERMISSIONS.purchasingReturnsManage,
  ]);
  const [filters, setFilters] = useState<PurchasingFilters>({
    ...defaultFilters,
    branchId: branchScope.defaultBranchId,
  });
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [returnReceipt, setReturnReceipt] = useState<PurchaseReceipt | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const receiptsQuery = usePurchaseReceipts(filters, canView && branchScope.hasBranchScope);
  const suppliersQuery = usePurchasingSuppliers("", canView);
  const branchesQuery = usePurchasingBranches(canView);
  const productsQuery = usePurchasingProducts(canView);
  const unitsQuery = usePurchasingUnits(canView);
  const taxRatesQuery = usePurchasingTaxRates(canView);
  const stockLocationsQuery = useStockLocations(canView && canReturn);
  const receiveMutation = useReceivePurchase();
  const postMutation = usePostPurchaseReceipt();
  const cancelMutation = useCancelPurchaseReceipt();
  const isPermissionDenied =
    receiptsQuery.error instanceof ApiError && receiptsQuery.error.status === 403;

  const branchOptions = useMemo(
    () =>
      (branchesQuery.data ?? []).filter(
        (branch) => branchScope.canAccessAllBranches || branchScope.isBranchAllowed(branch.id),
      ),
    [branchScope, branchesQuery.data],
  );

  useEffect(() => {
    setFilters((currentFilters) => {
      const branchId = normalizeBranchId(currentFilters.branchId);
      return branchId === currentFilters.branchId
        ? currentFilters
        : { ...currentFilters, branchId };
    });
  }, [normalizeBranchId]);

  if (!canView) {
    return <AccessDeniedCard />;
  }

  if (!branchScope.hasBranchScope) {
    return <NoBranchScopeCard />;
  }

  const handleReceive = async (payload: ReceivePurchasePayload): Promise<void> => {
    try {
      await receiveMutation.mutateAsync(payload);
      toast.success(
        "Stock received into operational inventory. Accounting inventory updates when the supplier bill is posted.",
      );
      setReceiveOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const confirmAction = async (): Promise<void> => {
    if (!pendingAction) return;

    try {
      if (pendingAction.type === "post") {
        await postMutation.mutateAsync(pendingAction.receipt.id);
        toast.success("Purchase receipt posted.");
      } else {
        await cancelMutation.mutateAsync(pendingAction.receipt.id);
        toast.success("Purchase receipt cancelled.");
      }
      setPendingAction(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const receipts = receiptsQuery.data ?? [];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        title="Receive Goods"
        description="Receive supplier goods and trace inventory stock-in movements."
        actions={
          canManage ? (
            <Button onClick={() => setReceiveOpen(true)} type="button">
              <Plus className="h-4 w-4" />
              Receive Goods
            </Button>
          ) : undefined
        }
      />

      <PurchasingToolbar
        allowAllBranches={branchScope.canAccessAllBranches}
        branches={branchOptions}
        filters={filters}
        onFiltersChange={setFilters}
        resetBranchId={branchScope.defaultBranchId}
        statuses={receiptStatuses}
        suppliers={suppliersQuery.data ?? []}
      />

      {receiptsQuery.isLoading ? <PurchaseTableSkeleton /> : null}

      {!receiptsQuery.isLoading && receiptsQuery.error ? (
        isPermissionDenied ? (
          <AccessDeniedCard message="The backend denied access to receive goods records." />
        ) : (
          <PurchaseErrorState
            description={getErrorMessage(receiptsQuery.error)}
            onRetry={() => {
              void receiptsQuery.refetch();
            }}
          />
        )
      ) : null}

      {!receiptsQuery.isLoading && !receiptsQuery.error && receipts.length === 0 ? (
        <PurchaseEmptyState
          actionLabel={canManage ? "Receive Goods" : undefined}
          onAction={canManage ? () => setReceiveOpen(true) : undefined}
          title="No receive goods records found."
        />
      ) : null}

      {!receiptsQuery.isLoading && !receiptsQuery.error && receipts.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <PurchaseReceiptsTable
              canManage={canManage}
              canReturn={canReturn}
              onCancel={(receipt) => setPendingAction({ receipt, type: "cancel" })}
              onPost={(receipt) => setPendingAction({ receipt, type: "post" })}
              onReturn={(receipt) => setReturnReceipt(receipt)}
              receipts={receipts}
            />
          </CardContent>
        </Card>
      ) : null}

      <PurchaseReceiveDialog
        branches={branchesQuery.data ?? []}
        isSubmitting={receiveMutation.isPending}
        onClose={() => setReceiveOpen(false)}
        onReceive={handleReceive}
        open={receiveOpen}
        products={productsQuery.data ?? []}
        suppliers={suppliersQuery.data ?? []}
        taxRates={taxRatesQuery.data ?? []}
        units={unitsQuery.data ?? []}
      />

      <PurchaseReturnDialog
        onClose={() => setReturnReceipt(null)}
        open={returnReceipt !== null}
        receipt={returnReceipt}
        stockLocations={stockLocationsQuery.data ?? []}
      />

      <Dialog
        open={pendingAction !== null}
        onOpenChange={(open) => (!open ? setPendingAction(null) : undefined)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingAction?.type === "post" ? "Post receive goods" : "Cancel receive goods"}
            </DialogTitle>
            <DialogDescription>
              {pendingAction?.type === "post"
                ? "Posting confirms received goods and updates inventory. No accounting journal is posted from receive goods."
                : "Cancelling posted receive goods may create reversal stock movements."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setPendingAction(null)} type="button" variant="outline">
              Cancel
            </Button>
            <Button
              disabled={postMutation.isPending || cancelMutation.isPending}
              onClick={() => void confirmAction()}
              type="button"
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
