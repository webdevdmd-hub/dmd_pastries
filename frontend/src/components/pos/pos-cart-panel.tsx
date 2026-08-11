import { ArrowRight, PauseCircle, RotateCcw, Store } from "lucide-react";
import type { JSX } from "react";

import { POSCartItem } from "@/components/pos/pos-cart-item";
import { POSCustomerSelector } from "@/components/pos/pos-customer-selector";
import { POSEmptyCartState } from "@/components/pos/pos-empty-cart-state";
import { DocumentChargesEditor } from "@/components/shared/document-charges-editor";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DocumentChargeDraft } from "@/types/document-charges";
import type { CartDiscountType, CartItem, CartTotals } from "@/types/pos";
import type { SalesChannel, TaxRate } from "@/types/settings";

const defaultChannelValue = "__default__";

type POSCartPanelProps = {
  canSell: boolean;
  charges: DocumentChargeDraft[];
  customerId: string | null;
  isCheckingOut: boolean;
  items: CartItem[];
  onCheckout: () => void;
  onChargesChange: (charges: DocumentChargeDraft[]) => void;
  onClear: () => void;
  onCustomerChange: (customerId: string | null) => void;
  onExternalOrderNumberChange: (value: string) => void;
  onHoldSale: () => void;
  onLineDiscountChange: (
    cartItemId: string,
    type: CartDiscountType | null,
    value: number | null,
  ) => void;
  onQuantityChange: (cartItemId: string, quantity: number) => void;
  onRemoveItem: (cartItemId: string) => void;
  onSalesChannelChange: (value: string) => void;
  externalOrderNumber: string;
  salesChannelId: string;
  salesChannels: SalesChannel[];
  taxRates: TaxRate[];
  totals: CartTotals;
};

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-AE", {
    currency: "AED",
    style: "currency",
  }).format(value);
}

export function POSCartPanel({
  canSell,
  charges,
  customerId,
  isCheckingOut,
  items,
  onCheckout,
  onChargesChange,
  onClear,
  onCustomerChange,
  onExternalOrderNumberChange,
  onHoldSale,
  onLineDiscountChange,
  onQuantityChange,
  onRemoveItem,
  onSalesChannelChange,
  externalOrderNumber,
  salesChannelId,
  salesChannels,
  taxRates,
  totals,
}: POSCartPanelProps): JSX.Element {
  const itemCountLabel = items.length === 1 ? "1 item" : `${String(items.length)} items`;
  const selectedChannel = salesChannels.find((channel) => channel.id === salesChannelId) ?? null;

  return (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden bg-white text-zinc-950">
      <div className="grid shrink-0 grid-cols-1 gap-2 border-b border-zinc-300 p-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="min-w-0 rounded-md border border-zinc-300 bg-white p-2.5">
          <POSCustomerSelector onChange={onCustomerChange} value={customerId} />
        </div>

        <div className="grid min-w-0 grid-rows-[24px_36px] gap-1 rounded-md border border-zinc-300 bg-white p-2.5">
          <div className="flex h-6 items-center gap-2 text-zinc-600">
            <Store className="h-4 w-4" />
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-500">
              Sales Channel
            </p>
          </div>
          <SearchableSelect
            ariaLabel="Select sales channel"
            clearable={false}
            contentClassName="rounded-md border-zinc-300 bg-white"
            emptyMessage="No sales channels found."
            onValueChange={(value) =>
              onSalesChannelChange(!value || value === defaultChannelValue ? "" : value)
            }
            options={[
              {
                description: "Use the normal branch billing flow",
                label: "Default channel",
                value: defaultChannelValue,
              },
              ...salesChannels
                .filter((channel) => channel.status === "active")
                .map((channel) => ({
                  description: channel.requiresExternalOrderNumber
                    ? "External order number required"
                    : channel.defaultPaymentMethodName || "No default payment method",
                  keywords: [
                    channel.channelType,
                    channel.defaultPaymentMethodName,
                    channel.isDefault ? "default" : "",
                  ],
                  label: `${channel.channelName}${channel.isDefault ? " (default)" : ""}`,
                  value: channel.id,
                })),
            ]}
            placeholder="Default channel"
            searchPlaceholder="Search channels..."
            showSelectedDescription={false}
            triggerClassName="h-9 min-h-9 rounded-md border-zinc-300 bg-zinc-50 text-sm font-semibold shadow-none hover:bg-white focus-visible:ring-black"
            value={salesChannelId || defaultChannelValue}
          />
        </div>
        {selectedChannel?.requiresExternalOrderNumber ? (
          <Input
            className="h-9 rounded-md border-zinc-300 bg-white font-mono text-sm shadow-none focus-visible:ring-black sm:col-span-2"
            onChange={(event) => onExternalOrderNumberChange(event.target.value)}
            placeholder="External order number"
            value={externalOrderNumber}
          />
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-300 bg-zinc-50 px-4 py-2.5">
          <div>
            <p className="text-sm font-black text-zinc-950">Cart</p>
            <p className="text-xs text-zinc-500">Active billing session</p>
          </div>
          <p className="font-mono text-sm font-black text-zinc-950">{itemCountLabel}</p>
        </div>

        <div className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3">
          {items.length === 0 ? (
            <POSEmptyCartState />
          ) : (
            <div className="space-y-2 pb-2">
              {items.map((item) => (
                <POSCartItem
                  item={item}
                  key={item.cartItemId}
                  onDiscountChange={onLineDiscountChange}
                  onQuantityChange={onQuantityChange}
                  onRemove={onRemoveItem}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 space-y-2 border-t border-zinc-300 bg-white p-3">
        {items.length > 0 ? (
          <DocumentChargesEditor
            charges={charges}
            className="border-b border-zinc-300 pb-2"
            compact
            onChange={onChargesChange}
            taxRates={taxRates}
          />
        ) : null}
        <div className="space-y-1.5 border-b border-zinc-300 pb-2.5">
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-600">Subtotal</span>
              <span className="font-mono font-bold text-zinc-950">
                {formatMoney(totals.subtotal)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-600">Discount</span>
              <span className="font-mono font-bold text-zinc-950">
                {formatMoney(totals.discountAmount)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-600">Item tax</span>
              <span className="font-mono font-bold text-zinc-950">
                {formatMoney(totals.taxAmount)}
              </span>
            </div>
            {totals.chargeAmount > 0 || totals.chargeTaxAmount > 0 ? (
              <>
                <div className="flex justify-between">
                  <span className="text-zinc-600">Charges</span>
                  <span className="font-mono font-bold text-zinc-950">
                    {formatMoney(totals.chargeAmount)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-600">Charge tax</span>
                  <span className="font-mono font-bold text-zinc-950">
                    {formatMoney(totals.chargeTaxAmount)}
                  </span>
                </div>
              </>
            ) : null}
            <div className="mt-2 flex items-center justify-between border-t border-zinc-300 pt-2">
              <span className="text-base font-black text-zinc-950">Total Payable</span>
              <span className="font-mono text-lg font-black text-zinc-950">
                {formatMoney(totals.total)}
              </span>
            </div>
            {totals.paidAmount > 0 ? (
              <div className="grid grid-cols-2 gap-2 border-t border-zinc-300 pt-1.5 text-xs">
                <div className="flex justify-between text-zinc-600">
                  <span>Paid</span>
                  <span className="font-mono font-semibold text-zinc-950">
                    {formatMoney(totals.paidAmount)}
                  </span>
                </div>
                <div className="flex justify-between text-zinc-600">
                  <span>Change</span>
                  <span className="font-mono font-semibold text-zinc-950">
                    {formatMoney(totals.changeAmount)}
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            className="h-10 rounded-md border-zinc-300 bg-white text-sm font-black text-zinc-950 shadow-none hover:bg-zinc-100"
            onClick={onHoldSale}
            type="button"
            variant="outline"
          >
            <PauseCircle className="mr-2 h-4 w-4" />
            Hold / Resume
          </Button>
          <Button
            className="h-10 rounded-md border-zinc-300 bg-white text-sm font-black text-red-700 shadow-none hover:bg-red-50"
            disabled={items.length === 0}
            onClick={onClear}
            type="button"
            variant="outline"
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Clear
          </Button>
        </div>
        <Button
          className="h-14 w-full rounded-md bg-black text-base font-black text-white shadow-none hover:bg-zinc-900"
          disabled={!canSell || items.length === 0 || isCheckingOut}
          onClick={onCheckout}
          type="button"
        >
          {isCheckingOut
            ? "Processing..."
            : canSell
              ? "Complete checkout"
              : "Sell permission required"}
          <ArrowRight className="ml-3 h-6 w-6" />
        </Button>
      </div>
    </aside>
  );
}
