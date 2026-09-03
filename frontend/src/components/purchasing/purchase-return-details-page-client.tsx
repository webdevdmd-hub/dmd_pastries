"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { JSX } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { AccessDeniedCard } from "@/components/purchasing/access-denied-card";
import { PurchaseErrorState } from "@/components/purchasing/purchase-error-state";
import {
  parsePurchaseReturnDetailTab,
  type PurchaseReturnDetailTabKey,
} from "@/components/purchasing/purchase-return-detail-tabs";
import {
  formatPurchaseReturnMoney,
  PurchaseReturnDetailsPanel,
} from "@/components/purchasing/purchase-return-details-panel";
import { PurchaseReturnStatusBadge } from "@/components/purchasing/purchase-return-status-badge";
import { PurchaseTableSkeleton } from "@/components/purchasing/purchase-table-skeleton";
import { ReturnReversalDialog } from "@/components/shared/return-reversal-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import { usePermission } from "@/hooks/use-permission";
import {
  useCancelPurchaseReturn,
  usePostPurchaseReturn,
  usePurchaseReturn,
  useReversePurchaseReturn,
} from "@/hooks/use-purchasing";
import { getErrorMessage } from "@/lib/api/client";

type PendingAction = "post" | "cancel" | null;

export function PurchaseReturnDetailsPageClient({
  purchaseReturnId,
}: {
  purchaseReturnId: string;
}): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const canView = hasAnyPermission([PERMISSIONS.purchasingReturnsView, PERMISSIONS.purchasingView]);
  const canPost = hasAnyPermission([
    PERMISSIONS.purchasingReturnsPost,
    PERMISSIONS.purchasingReturnsManage,
  ]);
  const canCancel = hasAnyPermission([
    PERMISSIONS.purchasingReturnsCancel,
    PERMISSIONS.purchasingReturnsManage,
  ]);
  const canReverse = hasAnyPermission([
    PERMISSIONS.purchasingReturnsReverse,
    PERMISSIONS.purchasingReturnsManage,
  ]);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [reverseDialogOpen, setReverseDialogOpen] = useState(false);
  const returnQuery = usePurchaseReturn(purchaseReturnId, canView);
  const postMutation = usePostPurchaseReturn();
  const cancelMutation = useCancelPurchaseReturn();
  const reverseMutation = useReversePurchaseReturn();

  const activeTab = parsePurchaseReturnDetailTab(searchParams.get("tab"));

  const changeTab = (tab: PurchaseReturnDetailTabKey): void => {
    const next = new URLSearchParams(searchParams.toString());
    if (tab === "overview") {
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

  if (returnQuery.isLoading) {
    return <PurchaseTableSkeleton />;
  }

  if (returnQuery.error || !returnQuery.data) {
    return (
      <PurchaseErrorState
        description={
          returnQuery.error ? getErrorMessage(returnQuery.error) : "Vendor credit not found."
        }
        onRetry={() => {
          void returnQuery.refetch();
        }}
      />
    );
  }

  const purchaseReturn = returnQuery.data;
  const isDraft = purchaseReturn.status === "draft";
  const isPosted = purchaseReturn.status === "posted";

  const confirmAction = async (): Promise<void> => {
    if (!pendingAction) return;

    try {
      if (pendingAction === "post") {
        await postMutation.mutateAsync(purchaseReturn.id);
        toast.success("Vendor credit posted.");
      } else {
        await cancelMutation.mutateAsync(purchaseReturn.id);
        toast.success("Draft vendor credit cancelled.");
      }
      setPendingAction(null);
      await returnQuery.refetch();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleReverse = async (reason: string): Promise<void> => {
    try {
      await reverseMutation.mutateAsync({
        id: purchaseReturn.id,
        payload: { reason },
      });
      toast.success("Vendor credit reversed.");
      setReverseDialogOpen(false);
      await returnQuery.refetch();
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
            href={ROUTES.purchasingReturns}
          >
            Back to vendor credits
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-page">{purchaseReturn.returnNumber}</h1>
            <PurchaseReturnStatusBadge status={purchaseReturn.status} />
          </div>
          <p className="mt-1 text-meta text-foreground-muted">
            {purchaseReturn.supplierName} · {purchaseReturn.branchName}
          </p>
          <p className="mt-2 text-kpi tabular-nums">
            {formatPurchaseReturnMoney(purchaseReturn.returnTotal)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canPost && isDraft ? (
            <Button onClick={() => setPendingAction("post")} type="button">
              Post vendor credit
            </Button>
          ) : null}
          {canCancel && isDraft ? (
            <Button onClick={() => setPendingAction("cancel")} type="button" variant="outline">
              Cancel draft
            </Button>
          ) : null}
          {canReverse && isPosted ? (
            <Button onClick={() => setReverseDialogOpen(true)} type="button" variant="outline">
              Reverse vendor credit
            </Button>
          ) : null}
        </div>
      </div>

      <PurchaseReturnDetailsPanel
        activeTab={activeTab}
        onTabChange={changeTab}
        purchaseReturn={purchaseReturn}
      />

      <Dialog
        open={pendingAction !== null}
        onOpenChange={(open) => (!open ? setPendingAction(null) : undefined)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingAction === "post" ? "Post vendor credit" : "Cancel vendor credit"}
            </DialogTitle>
            <DialogDescription>
              {pendingAction === "post"
                ? "Posting is final. It creates stock return movement and accounting entries."
                : "This cancels the draft vendor credit without affecting stock or accounting."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setPendingAction(null)} type="button" variant="outline">
              Close
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

      <ReturnReversalDialog
        description="Reversing a posted vendor credit creates a linked correction while keeping the original note read-only."
        isSubmitting={reverseMutation.isPending}
        noteNumber={purchaseReturn.returnNumber}
        onConfirm={(reason) => void handleReverse(reason)}
        onOpenChange={setReverseDialogOpen}
        open={reverseDialogOpen}
        title="Reverse vendor credit"
      />
    </div>
  );
}
