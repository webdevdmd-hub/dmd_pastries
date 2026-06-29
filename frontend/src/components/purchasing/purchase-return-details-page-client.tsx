"use client";

import Link from "next/link";
import type { JSX } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { AccessDeniedCard } from "@/components/purchasing/access-denied-card";
import { PurchaseErrorState } from "@/components/purchasing/purchase-error-state";
import { PurchaseReturnStatusBadge } from "@/components/purchasing/purchase-return-status-badge";
import { PurchaseTableSkeleton } from "@/components/purchasing/purchase-table-skeleton";
import { ReturnReversalDialog } from "@/components/shared/return-reversal-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

function formatDate(value: string | null): string {
  return value
    ? new Intl.DateTimeFormat("en-AE", { dateStyle: "medium" }).format(new Date(value))
    : "Not set";
}

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
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [reverseDialogOpen, setReverseDialogOpen] = useState(false);
  const returnQuery = usePurchaseReturn(purchaseReturnId, canView);
  const postMutation = usePostPurchaseReturn();
  const cancelMutation = useCancelPurchaseReturn();
  const reverseMutation = useReversePurchaseReturn();

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
          returnQuery.error ? getErrorMessage(returnQuery.error) : "Purchase return not found."
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
      <div>
        <Link
          className="text-sm font-semibold text-brand-mocha hover:text-brand-espresso"
          href={ROUTES.purchasingReturns}
        >
          Back to Purchase Returns
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-4xl font-semibold text-brand-espresso">
            {purchaseReturn.returnNumber}
          </h1>
          <PurchaseReturnStatusBadge status={purchaseReturn.status} />
          {canPost && isDraft ? (
            <Button onClick={() => setPendingAction("post")} type="button">
              Post Vendor Credit
            </Button>
          ) : null}
          {canCancel && isDraft ? (
            <Button onClick={() => setPendingAction("cancel")} type="button" variant="outline">
              Cancel Draft
            </Button>
          ) : null}
          {canReverse && isPosted ? (
            <Button onClick={() => setReverseDialogOpen(true)} type="button" variant="outline">
              Reverse Vendor Credit
            </Button>
          ) : null}
        </div>
        <p className="mt-2 text-sm text-brand-mocha">
          {purchaseReturn.supplierName} - {purchaseReturn.branchName}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-brand-mocha">Return total</p>
            <p className="text-2xl font-semibold text-brand-espresso">
              {formatCurrency(purchaseReturn.returnTotal)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-brand-mocha">Applied credit</p>
            <p className="text-2xl font-semibold text-brand-espresso">
              {formatCurrency(purchaseReturn.appliedCreditAmount)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-brand-mocha">Open credit</p>
            <p className="text-2xl font-semibold text-brand-espresso">
              {formatCurrency(purchaseReturn.openCreditAmount)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-brand-mocha">Return date</p>
            <p className="text-lg font-semibold text-brand-espresso">
              {formatDate(purchaseReturn.returnDate)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-brand-mocha">Linked receipt</p>
            <Link
              className="text-lg font-semibold text-brand-espresso hover:text-brand-mocha"
              href={`${ROUTES.purchasingReceipts}/${purchaseReturn.purchaseReceiptId}`}
            >
              {purchaseReturn.purchaseReceiptNumber}
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-brand-mocha">Linked invoice</p>
            {purchaseReturn.purchaseInvoiceId ? (
              <Link
                className="text-lg font-semibold text-brand-espresso hover:text-brand-mocha"
                href={`${ROUTES.purchasingInvoices}/${purchaseReturn.purchaseInvoiceId}`}
              >
                {purchaseReturn.purchaseInvoiceNumber ?? "Bill number unavailable"}
              </Link>
            ) : (
              <p className="text-lg font-semibold text-brand-espresso">Not linked</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-brand-mocha">Journal reference</p>
            {purchaseReturn.journalEntryId ? (
              <Link
                className="text-lg font-semibold text-brand-espresso hover:text-brand-mocha"
                href={`${ROUTES.accountingJournalEntries}?search=${purchaseReturn.journalEntryId}`}
              >
                View journal
              </Link>
            ) : (
              <p className="text-lg font-semibold text-brand-espresso">Not posted</p>
            )}
          </CardContent>
        </Card>
      </div>

      {purchaseReturn.status === "reversed" ||
      purchaseReturn.reversalReturnNumber ||
      purchaseReturn.originalReturnNumber ? (
        <Card className="border-sky-200 bg-sky-50/60">
          <CardHeader>
            <CardTitle>Reversal details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-sm text-brand-mocha">Original note</p>
              <p className="font-semibold text-brand-espresso">
                {purchaseReturn.originalReturnNumber ?? purchaseReturn.returnNumber}
              </p>
            </div>
            <div>
              <p className="text-sm text-brand-mocha">Reversal note</p>
              {purchaseReturn.reversalReturnId ? (
                <Link
                  className="font-semibold text-brand-espresso hover:text-brand-mocha"
                  href={`${ROUTES.purchasingReturns}/${purchaseReturn.reversalReturnId}`}
                >
                  {purchaseReturn.reversalReturnNumber ?? purchaseReturn.reversalReturnId}
                </Link>
              ) : (
                <p className="font-semibold text-brand-espresso">
                  {purchaseReturn.reversalReturnNumber ?? "Not linked"}
                </p>
              )}
            </div>
            <div>
              <p className="text-sm text-brand-mocha">Reversed by</p>
              <p className="font-semibold text-brand-espresso">
                {purchaseReturn.reversedByUserName ?? "System"}
              </p>
              <p className="text-xs text-brand-mocha">{formatDate(purchaseReturn.reversedAt)}</p>
            </div>
            <div className="md:col-span-2">
              <p className="text-sm text-brand-mocha">Reason</p>
              <p className="font-semibold text-brand-espresso">
                {purchaseReturn.reversalReason ?? "No reversal reason returned."}
              </p>
            </div>
            <div>
              <p className="text-sm text-brand-mocha">Reversal journal</p>
              {purchaseReturn.reversalJournalEntryId ? (
                <Link
                  className="font-semibold text-brand-espresso hover:text-brand-mocha"
                  href={`${ROUTES.accountingJournalEntries}?search=${purchaseReturn.reversalJournalEntryId}`}
                >
                  View reversal journal
                </Link>
              ) : (
                <p className="font-semibold text-brand-espresso">Not linked</p>
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Returned items</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Line total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchaseReturn.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-semibold text-brand-espresso">
                    {item.itemNameSnapshot}
                  </TableCell>
                  <TableCell>{item.itemType}</TableCell>
                  <TableCell>
                    {item.quantity} {item.unitSymbol}
                  </TableCell>
                  <TableCell>{item.stockLocationName ?? "Default location"}</TableCell>
                  <TableCell>{item.reason ?? purchaseReturn.reason ?? "Not set"}</TableCell>
                  <TableCell>{formatCurrency(item.lineTotal)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="bg-white/85">
        <CardHeader>
          <CardTitle>Return reason</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-brand-mocha">{purchaseReturn.reason ?? "No reason added."}</p>
          {purchaseReturn.supplierReferenceNumber ? (
            <p className="mt-3 text-sm text-brand-mocha">
              Supplier reference:{" "}
              <span className="font-semibold text-brand-espresso">
                {purchaseReturn.supplierReferenceNumber}
              </span>
            </p>
          ) : null}
        </CardContent>
      </Card>

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
