"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ReceiptText, RotateCcw } from "lucide-react";
import Link from "next/link";
import type { JSX } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { AccessDeniedCard } from "@/components/payments/access-denied-card";
import { PaymentMethodBadge } from "@/components/payments/payment-method-badge";
import { PaymentStatusBadge } from "@/components/payments/payment-status-badge";
import { SalesReturnDialog } from "@/components/payments/sales-return-dialog";
import { SalesReturnsTable } from "@/components/payments/sales-returns-table";
import { POSReceiptDialog } from "@/components/pos/pos-receipt-dialog";
import { NoBranchScopeCard } from "@/components/shared/no-branch-scope-card";
import { PageHeader } from "@/components/shared/page-header";
import { ReturnReversalDialog } from "@/components/shared/return-reversal-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useBranchScope } from "@/hooks/use-branch-scope";
import { useStockLocations } from "@/hooks/use-inventory";
import { usePaymentMethods, useSalePayments } from "@/hooks/use-payments";
import { usePermission } from "@/hooks/use-permission";
import {
  useCancelSalesReturn,
  usePostSalesReturn,
  useReturnableSaleItems,
  useReverseSalesReturn,
  useSaleSalesReturns,
} from "@/hooks/use-sales-returns";
import { useReceiptLayouts } from "@/hooks/use-settings-data";
import { getErrorMessage } from "@/lib/api/client";
import { getSaleReceipt } from "@/lib/api/pos";
import type { SaleReceipt } from "@/types/pos";
import type { SalesReturn } from "@/types/sales-return";
import type { ReceiptLayout } from "@/types/settings";

type SaleDetailPageClientProps = {
  saleId: string;
};

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

function formatDateTime(value: string): string {
  return value ? new Date(value).toLocaleString("en-AE") : "Not recorded";
}

function selectReceiptLayout(
  layouts: ReceiptLayout[],
  branchId: string | null,
): ReceiptLayout | null {
  const activeLayouts = layouts.filter((layout) => layout.status === "active");
  const branchLayouts = branchId
    ? activeLayouts.filter((layout) => layout.branchId === branchId)
    : [];
  const businessWideLayouts = activeLayouts.filter((layout) => layout.branchId === null);

  return (
    branchLayouts.find((layout) => layout.isDefault) ??
    branchLayouts.find((layout) => Boolean(layout.counterId ?? layout.printerType)) ??
    branchLayouts[0] ??
    businessWideLayouts.find((layout) => layout.isDefault) ??
    activeLayouts.find((layout) => layout.isDefault) ??
    activeLayouts[0] ??
    null
  );
}

export function SaleDetailPageClient({ saleId }: SaleDetailPageClientProps): JSX.Element {
  const branchScope = useBranchScope();
  const { hasAnyPermission } = usePermission();
  const canView = hasAnyPermission([PERMISSIONS.paymentsView, PERMISSIONS.posView]);
  const canReturn = hasAnyPermission([PERMISSIONS.paymentsRefund, PERMISSIONS.posRefund]);
  const canReverse = hasAnyPermission([
    PERMISSIONS.salesReturnsReverse,
    PERMISSIONS.salesReturnsManage,
    PERMISSIONS.paymentsRefund,
    PERMISSIONS.posRefund,
  ]);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [reversalReturn, setReversalReturn] = useState<SalesReturn | null>(null);
  const receiptQuery = useQuery<SaleReceipt>({
    queryKey: ["pos-sale", "receipt", saleId],
    queryFn: async () => getSaleReceipt(saleId),
    enabled: canView && branchScope.hasBranchScope && Boolean(saleId),
  });
  const paymentsQuery = useSalePayments(saleId, canView && branchScope.hasBranchScope);
  const returnableItemsQuery = useReturnableSaleItems(
    saleId,
    canView && branchScope.hasBranchScope,
  );
  const saleReturnsQuery = useSaleSalesReturns(saleId, canView && branchScope.hasBranchScope);
  const paymentMethodsQuery = usePaymentMethods(canView);
  const stockLocationsQuery = useStockLocations(canReturn && branchScope.hasBranchScope);
  const receiptLayoutsQuery = useReceiptLayouts(canView && branchScope.hasBranchScope);
  const postMutation = usePostSalesReturn();
  const cancelMutation = useCancelSalesReturn();
  const reverseMutation = useReverseSalesReturn();
  const receipt = receiptQuery.data ?? null;
  const receiptLayout = selectReceiptLayout(
    receiptLayoutsQuery.data ?? [],
    receipt?.saleId ? branchScope.effectiveBranchId : branchScope.effectiveBranchId,
  );
  const hasReturnableItems = (returnableItemsQuery.data ?? []).some(
    (item) => item.returnableQuantity > 0,
  );

  if (!canView) {
    return (
      <AccessDeniedCard message="You need `payments.view` or `pos.view` to view sale details." />
    );
  }

  if (!branchScope.hasBranchScope) {
    return <NoBranchScopeCard />;
  }

  const handlePostReturn = async (salesReturn: SalesReturn): Promise<void> => {
    try {
      await postMutation.mutateAsync(salesReturn.id);
      toast.success("Credit note posted.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleCancelReturn = async (salesReturn: SalesReturn): Promise<void> => {
    try {
      await cancelMutation.mutateAsync(salesReturn.id);
      toast.success("Draft credit note cancelled.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleReverseReturn = async (reason: string): Promise<void> => {
    if (!reversalReturn) return;

    try {
      await reverseMutation.mutateAsync({
        id: reversalReturn.id,
        payload: { reason },
      });
      toast.success("Credit note reversed.");
      setReversalReturn(null);
      await receiptQuery.refetch();
      await paymentsQuery.refetch();
      await returnableItemsQuery.refetch();
      await saleReturnsQuery.refetch();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        title={receipt ? `Sale ${receipt.saleNumber}` : "Sale details"}
        description="Review POS sale receipt, payment history, returnable items, and credit notes."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild type="button" variant="outline">
              <Link href={ROUTES.payments}>
                <ArrowLeft className="h-4 w-4" />
                Payments
              </Link>
            </Button>
            <Button
              disabled={!receipt}
              onClick={() => setReceiptOpen(true)}
              type="button"
              variant="outline"
            >
              <ReceiptText className="h-4 w-4" />
              Open receipt
            </Button>
            {canReturn ? (
              <Button
                disabled={!hasReturnableItems}
                onClick={() => setReturnDialogOpen(true)}
                type="button"
              >
                <RotateCcw className="h-4 w-4" />
                Return items
              </Button>
            ) : null}
          </div>
        }
      />

      {receiptQuery.isLoading ? (
        <Card>
          <CardContent className="p-8 text-sm text-brand-mocha">
            Loading sale details...
          </CardContent>
        </Card>
      ) : null}

      {receiptQuery.error ? (
        <Card className="border-danger/30 bg-danger-tint/60">
          <CardContent className="p-6 text-danger-text">
            Unable to load sale receipt: {getErrorMessage(receiptQuery.error)}
          </CardContent>
        </Card>
      ) : null}

      {receipt ? (
        <>
          {/* One strip, not four tiles. Balance due leads because it is the
              only figure here anyone acts on; the rest are context. */}
          <div className="flex flex-wrap items-center gap-x-7 gap-y-2 rounded bg-muted px-4 py-3">
            <div className="flex items-baseline gap-2.5">
              <span className="text-meta text-foreground-muted">Balance due</span>
              <span className="text-kpi tabular-nums">{formatMoney(receipt.balanceDue)}</span>
            </div>
            <span aria-hidden="true" className="hidden h-5 w-px bg-border sm:block" />
            <div className="flex items-baseline gap-2">
              <span className="text-meta text-foreground-muted">Total</span>
              <span className="text-cell font-medium tabular-nums">
                {formatMoney(receipt.total)}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-meta text-foreground-muted">Paid</span>
              <span className="text-cell font-medium tabular-nums">
                {formatMoney(receipt.paidAmount)}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-meta text-foreground-muted">Sold at</span>
              <span className="text-cell font-medium tabular-nums">
                {formatDateTime(receipt.soldAt)}
              </span>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Sale items</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Unit Price</TableHead>
                    <TableHead className="text-right">Line Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receipt.items.map((item, index) => (
                    <TableRow key={`${item.name}-${String(index)}`}>
                      <TableCell className="font-semibold text-brand-espresso">
                        {item.name}
                      </TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>{formatMoney(item.unitPrice)}</TableCell>
                      <TableCell className="text-right font-bold">
                        {formatMoney(item.lineTotal)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Payments</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {paymentsQuery.isLoading ? (
              <div className="p-6 text-sm text-brand-mocha">Loading payments...</div>
            ) : null}
            {paymentsQuery.error ? (
              <div className="p-6 text-sm text-danger-text">
                {getErrorMessage(paymentsQuery.error)}
              </div>
            ) : null}
            {!paymentsQuery.isLoading && !paymentsQuery.error ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Method</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Paid At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(paymentsQuery.data ?? []).map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>
                        <PaymentMethodBadge methodName={payment.paymentMethodNameSnapshot} />
                      </TableCell>
                      <TableCell className="font-bold">{formatMoney(payment.amount)}</TableCell>
                      <TableCell>
                        <PaymentStatusBadge status={payment.paymentStatus} />
                      </TableCell>
                      <TableCell>{formatDateTime(payment.paidAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Returnable items</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {returnableItemsQuery.isLoading ? (
              <div className="p-6 text-sm text-brand-mocha">Loading returnable items...</div>
            ) : null}
            {returnableItemsQuery.error ? (
              <div className="p-6 text-sm text-danger-text">
                {getErrorMessage(returnableItemsQuery.error)}
              </div>
            ) : null}
            {!returnableItemsQuery.isLoading && !returnableItemsQuery.error ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Sold</TableHead>
                    <TableHead>Returned</TableHead>
                    <TableHead>Available</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(returnableItemsQuery.data ?? []).map((item) => (
                    <TableRow key={item.saleItemId}>
                      <TableCell className="font-semibold text-brand-espresso">
                        {item.itemName}
                      </TableCell>
                      <TableCell>{item.soldQuantity}</TableCell>
                      <TableCell>{item.returnedQuantity}</TableCell>
                      <TableCell>{item.returnableQuantity}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Returns / Credit Notes</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {saleReturnsQuery.isLoading ? (
            <div className="p-6 text-sm text-brand-mocha">Loading credit notes...</div>
          ) : null}
          {saleReturnsQuery.error ? (
            <div className="p-6 text-sm text-danger-text">
              {getErrorMessage(saleReturnsQuery.error)}
            </div>
          ) : null}
          {!saleReturnsQuery.isLoading &&
          !saleReturnsQuery.error &&
          (saleReturnsQuery.data ?? []).length === 0 ? (
            <div className="p-6 text-sm text-brand-mocha">No credit notes for this sale yet.</div>
          ) : null}
          {!saleReturnsQuery.isLoading &&
          !saleReturnsQuery.error &&
          (saleReturnsQuery.data ?? []).length > 0 ? (
            <SalesReturnsTable
              canManage={canReturn}
              canReverse={canReverse}
              isCancelling={cancelMutation.isPending}
              isPosting={postMutation.isPending}
              isReversing={reverseMutation.isPending}
              onCancel={(salesReturn) => void handleCancelReturn(salesReturn)}
              onPost={(salesReturn) => void handlePostReturn(salesReturn)}
              onReverse={setReversalReturn}
              returns={saleReturnsQuery.data ?? []}
            />
          ) : null}
        </CardContent>
      </Card>

      <POSReceiptDialog
        layout={receiptLayout}
        onNewSale={() => setReceiptOpen(false)}
        onOpenChange={setReceiptOpen}
        open={receiptOpen}
        primaryActionLabel="Close"
        receipt={receipt}
      />

      <SalesReturnDialog
        onOpenChange={setReturnDialogOpen}
        onPosted={() => {
          void receiptQuery.refetch();
          void paymentsQuery.refetch();
          void returnableItemsQuery.refetch();
          void saleReturnsQuery.refetch();
        }}
        open={returnDialogOpen}
        paymentMethods={paymentMethodsQuery.data ?? []}
        saleId={saleId}
        saleNumber={receipt?.saleNumber ?? null}
        stockLocations={stockLocationsQuery.data ?? []}
      />

      <ReturnReversalDialog
        description="Reversing a posted credit note creates a correction while preserving the original sale and credit-note history."
        isSubmitting={reverseMutation.isPending}
        noteNumber={reversalReturn?.returnNumber ?? null}
        onConfirm={(reason) => void handleReverseReturn(reason)}
        onOpenChange={(open) => {
          if (!open) setReversalReturn(null);
        }}
        open={reversalReturn !== null}
        title="Reverse credit note"
      />
    </div>
  );
}
