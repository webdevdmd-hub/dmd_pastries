"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ReceiptText, RotateCcw } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { JSX } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { AccessDeniedCard } from "@/components/payments/access-denied-card";
import { PaymentMethodBadge } from "@/components/payments/payment-method-badge";
import { PaymentStatusBadge } from "@/components/payments/payment-status-badge";
import { parseSaleDetailTab, type SaleDetailTabKey } from "@/components/payments/sale-detail-tabs";
import {
  SALE_DETAIL_TABPANEL_ID,
  SaleDetailViewTabs,
} from "@/components/payments/sale-detail-view-tabs";
import { SalesReturnDialog } from "@/components/payments/sales-return-dialog";
import { SalesReturnsCardGrid } from "@/components/payments/sales-returns-card-grid";
import { SalesReturnsTable } from "@/components/payments/sales-returns-table";
import { POSReceiptDialog } from "@/components/pos/pos-receipt-dialog";
import { NoBranchScopeCard } from "@/components/shared/no-branch-scope-card";
import { PageHeader } from "@/components/shared/page-header";
import { ReturnReversalDialog } from "@/components/shared/return-reversal-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

/** A loading, error or empty line inside a table card. */
function PanelNote({ children, tone }: { children: string; tone?: "danger" }): JSX.Element {
  return (
    <p
      className={
        tone === "danger" ? "p-6 text-cell text-danger-text" : "p-6 text-cell text-foreground-muted"
      }
    >
      {children}
    </p>
  );
}

export function SaleDetailPageClient({ saleId }: SaleDetailPageClientProps): JSX.Element {
  const branchScope = useBranchScope();
  const { hasAnyPermission } = usePermission();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
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
    branchScope.effectiveBranchId,
  );
  const hasReturnableItems = (returnableItemsQuery.data ?? []).some(
    (item) => item.returnableQuantity > 0,
  );

  const activeTab = parseSaleDetailTab(searchParams.get("tab"));

  const changeTab = (tab: SaleDetailTabKey): void => {
    const next = new URLSearchParams(searchParams.toString());
    if (tab === "items") {
      next.delete("tab");
    } else {
      next.set("tab", tab);
    }
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

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

  const salePayments = paymentsQuery.data ?? [];
  const returnableItems = returnableItemsQuery.data ?? [];
  const saleReturns = saleReturnsQuery.data ?? [];
  const returnHandlers = {
    canManage: canReturn,
    canReverse,
    isCancelling: cancelMutation.isPending,
    isPosting: postMutation.isPending,
    isReversing: reverseMutation.isPending,
    onCancel: (salesReturn: SalesReturn) => void handleCancelReturn(salesReturn),
    onPost: (salesReturn: SalesReturn) => void handlePostReturn(salesReturn),
    onReverse: setReversalReturn,
    returns: saleReturns,
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
          <CardContent className="p-8 text-cell text-foreground-muted">
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
        // One strip, not four tiles. Balance due leads because it is the
        // only figure here anyone acts on; the rest are context.
        <div className="flex flex-wrap items-center gap-x-7 gap-y-2 rounded bg-muted px-4 py-3">
          <div className="flex items-baseline gap-2.5">
            <span className="text-meta text-foreground-muted">Balance due</span>
            <span className="text-kpi tabular-nums">{formatMoney(receipt.balanceDue)}</span>
          </div>
          <span aria-hidden="true" className="hidden h-5 w-px bg-border sm:block" />
          <div className="flex items-baseline gap-2">
            <span className="text-meta text-foreground-muted">Total</span>
            <span className="text-cell font-medium tabular-nums">{formatMoney(receipt.total)}</span>
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
      ) : null}

      <SaleDetailViewTabs
        active={activeTab}
        creditNotesCount={saleReturnsQuery.data?.length}
        onTabChange={changeTab}
        paymentsCount={paymentsQuery.data?.length}
        saleId={saleId}
      />

      {/* One panel element that swaps, which is what `aria-controls` on every
          tab points at. Tables scroll inside their card on a phone rather
          than forcing the page wide. */}
      <div id={SALE_DETAIL_TABPANEL_ID} role="tabpanel" tabIndex={-1}>
        {activeTab === "items" ? (
          <Card className="overflow-hidden">
            <CardContent className="overflow-x-auto p-0">
              {receipt ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead className="text-right">Unit price</TableHead>
                      <TableHead className="text-right">Line total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {receipt.items.map((item, index) => (
                      <TableRow key={`${item.name}-${String(index)}`}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell className="text-right tabular-nums">{item.quantity}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMoney(item.unitPrice)}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatMoney(item.lineTotal)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <PanelNote>Sale items appear once the receipt has loaded.</PanelNote>
              )}
            </CardContent>
          </Card>
        ) : null}

        {activeTab === "payments" ? (
          <Card className="overflow-hidden">
            <CardContent className="overflow-x-auto p-0">
              {paymentsQuery.isLoading ? <PanelNote>Loading payments...</PanelNote> : null}
              {paymentsQuery.error ? (
                <PanelNote tone="danger">{getErrorMessage(paymentsQuery.error)}</PanelNote>
              ) : null}
              {!paymentsQuery.isLoading && !paymentsQuery.error && salePayments.length === 0 ? (
                <PanelNote>No payments recorded against this sale.</PanelNote>
              ) : null}
              {!paymentsQuery.isLoading && !paymentsQuery.error && salePayments.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Method</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Paid at</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {salePayments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>
                          <PaymentMethodBadge methodName={payment.paymentMethodNameSnapshot} />
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatMoney(payment.amount)}
                        </TableCell>
                        <TableCell>
                          <PaymentStatusBadge status={payment.paymentStatus} />
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {formatDateTime(payment.paidAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {activeTab === "returnable" ? (
          <Card className="overflow-hidden">
            <CardContent className="overflow-x-auto p-0">
              {returnableItemsQuery.isLoading ? (
                <PanelNote>Loading returnable items...</PanelNote>
              ) : null}
              {returnableItemsQuery.error ? (
                <PanelNote tone="danger">{getErrorMessage(returnableItemsQuery.error)}</PanelNote>
              ) : null}
              {!returnableItemsQuery.isLoading &&
              !returnableItemsQuery.error &&
              returnableItems.length === 0 ? (
                <PanelNote>Nothing on this sale can be returned.</PanelNote>
              ) : null}
              {!returnableItemsQuery.isLoading &&
              !returnableItemsQuery.error &&
              returnableItems.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Sold</TableHead>
                      <TableHead className="text-right">Returned</TableHead>
                      <TableHead className="text-right">Available</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {returnableItems.map((item) => (
                      <TableRow key={item.saleItemId}>
                        <TableCell className="font-medium">{item.itemName}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {item.soldQuantity}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {item.returnedQuantity}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {item.returnableQuantity}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {activeTab === "credit-notes" ? (
          <>
            {saleReturnsQuery.isLoading ? (
              <Card>
                <PanelNote>Loading credit notes...</PanelNote>
              </Card>
            ) : null}
            {saleReturnsQuery.error ? (
              <Card>
                <PanelNote tone="danger">{getErrorMessage(saleReturnsQuery.error)}</PanelNote>
              </Card>
            ) : null}
            {!saleReturnsQuery.isLoading && !saleReturnsQuery.error && saleReturns.length === 0 ? (
              <Card>
                <PanelNote>No credit notes for this sale yet.</PanelNote>
              </Card>
            ) : null}
            {!saleReturnsQuery.isLoading && !saleReturnsQuery.error && saleReturns.length > 0 ? (
              <>
                <div className="md:hidden">
                  <SalesReturnsCardGrid {...returnHandlers} />
                </div>
                <Card className="hidden overflow-hidden md:block">
                  <CardContent className="p-0">
                    <SalesReturnsTable {...returnHandlers} />
                  </CardContent>
                </Card>
              </>
            ) : null}
          </>
        ) : null}
      </div>

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
