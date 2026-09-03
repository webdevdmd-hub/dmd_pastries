"use client";

import type { JSX } from "react";

import { PurchaseDocumentChain } from "@/components/purchasing/purchase-document-chain";
import type { PurchaseOrderDetailTabKey } from "@/components/purchasing/purchase-order-detail-tabs";
import {
  PURCHASE_ORDER_DETAIL_TABPANEL_ID,
  PurchaseOrderDetailViewTabs,
} from "@/components/purchasing/purchase-order-detail-view-tabs";
import { PurchasingItemLines } from "@/components/purchasing/purchasing-item-lines";
import { usePurchaseOrderDocumentChain } from "@/hooks/use-purchasing";
import { hasOutstandingStock, unreceivedValue } from "@/lib/purchasing/purchase-order-quantities";
import type { PurchaseOrder } from "@/types/purchasing";

type PurchaseOrderDetailsPanelProps = {
  activeTab: PurchaseOrderDetailTabKey;
  canView: boolean;
  onTabChange: (tab: PurchaseOrderDetailTabKey) => void;
  order: PurchaseOrder;
};

export function formatPurchaseOrderMoney(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

function SummaryRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-foreground-muted">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}

/**
 * The body of a purchase order: the tab strip and whichever panel is
 * selected. Shared by the full page and the drawer over the list, which is
 * why the tab is a prop rather than state. The document chain is fetched
 * here because both hosts need it for the Documents tab.
 */
export function PurchaseOrderDetailsPanel({
  activeTab,
  canView,
  onTabChange,
  order,
}: PurchaseOrderDetailsPanelProps): JSX.Element {
  // Loaded with the panel rather than only on its tab: the header's standing
  // line needs the active bill to say whether the order is billed or paid.
  const chainQuery = usePurchaseOrderDocumentChain(order.id, canView);
  const activeBill = chainQuery.data?.purchaseInvoices.find(
    (invoice) => invoice.status !== "cancelled",
  );

  return (
    <div className="grid gap-6">
      <PurchaseOrderDetailViewTabs
        active={activeTab}
        itemsCount={order.items.length}
        onTabChange={onTabChange}
        orderId={order.id}
      />

      <div id={PURCHASE_ORDER_DETAIL_TABPANEL_ID} role="tabpanel" tabIndex={-1}>
        {activeTab === "items" ? (
          <PurchasingItemLines
            lines={order.items}
            title="Purchase order items"
            totals={{
              discount: order.discountAmount,
              subtotal: order.subtotalAmount,
              tax: order.taxAmount,
              total: order.totalAmount,
            }}
          />
        ) : null}

        {activeTab === "documents" ? (
          <div className="grid gap-6">
            <div className="rounded-lg bg-muted p-4">
              <h3 className="text-meta font-medium text-foreground-muted">Document summary</h3>
              <dl className="mt-3 grid gap-2 text-cell">
                <SummaryRow
                  label="Bill"
                  value={
                    activeBill?.supplierBillNumber ?? activeBill?.invoiceNumber ?? "Not created"
                  }
                />
                <SummaryRow
                  label="Bill status"
                  value={activeBill ? activeBill.status : "Pending"}
                />
                <SummaryRow
                  label="Payment status"
                  value={activeBill ? activeBill.paymentStatus : "Pending"}
                />
                <SummaryRow
                  label="Not yet received"
                  value={
                    hasOutstandingStock(order)
                      ? formatPurchaseOrderMoney(unreceivedValue(order))
                      : "Nothing outstanding"
                  }
                />
                {/* Balance due is what the supplier is owed, which only a bill
                    can establish. Falling back to the order total presented an
                    un-billed PO as money owed. */}
                <div className="border-t border-border pt-2">
                  <SummaryRow
                    label="Balance due"
                    value={
                      activeBill
                        ? formatPurchaseOrderMoney(activeBill.balanceAmount)
                        : "No bill yet"
                    }
                  />
                </div>
              </dl>
            </div>

            <PurchaseDocumentChain
              chain={chainQuery.data}
              error={chainQuery.error}
              isLoading={chainQuery.isLoading}
              onRetry={() => {
                void chainQuery.refetch();
              }}
            />
          </div>
        ) : null}

        {activeTab === "notes" ? (
          <div className="rounded-lg bg-muted px-3 py-2">
            <span className="text-meta text-foreground-muted">Notes</span>
            <p className="mt-0.5 whitespace-pre-line text-cell">
              {order.notes ?? "No notes recorded."}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
