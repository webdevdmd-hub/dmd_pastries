import { ArrowRight, ChevronDown, PauseCircle, RotateCcw, Store } from "lucide-react";
import type { JSX } from "react";

import { POSCartItem } from "@/components/pos/pos-cart-item";
import { POSCustomerSelector } from "@/components/pos/pos-customer-selector";
import { POSEmptyCartState } from "@/components/pos/pos-empty-cart-state";
import { DocumentChargesEditor } from "@/components/shared/document-charges-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
    <aside className="flex h-full min-h-0 flex-col overflow-hidden bg-white text-[#09090b]">
      <div className="shrink-0 space-y-2 border-b border-[#d4d4d8] p-3">
        <div className="rounded-md border border-[#d4d4d8] bg-white p-2.5">
          <POSCustomerSelector onChange={onCustomerChange} value={customerId} />
        </div>

        <div className="rounded-md border border-[#d4d4d8] bg-white p-2.5">
          <div className="mb-1.5 flex items-center gap-2 text-[#52525b]">
            <Store className="h-4 w-4" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#71717a]">
                Sales Channel
              </p>
              <p className="truncate text-sm font-black text-[#09090b]">
                {selectedChannel?.channelName ?? "Default channel"}
              </p>
            </div>
            <ChevronDown className="h-4 w-4" />
          </div>
          <Select
            value={salesChannelId || defaultChannelValue}
            onValueChange={(value) =>
              onSalesChannelChange(value === defaultChannelValue ? "" : value)
            }
          >
            <SelectTrigger className="h-9 rounded-md border-[#d4d4d8] bg-[#fafafa] text-sm font-semibold shadow-none">
              <SelectValue placeholder="Default channel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={defaultChannelValue}>Default channel</SelectItem>
              {salesChannels
                .filter((channel) => channel.status === "active")
                .map((channel) => (
                  <SelectItem key={channel.id} value={channel.id}>
                    {channel.channelName}
                    {channel.isDefault ? " (default)" : ""}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          {selectedChannel?.requiresExternalOrderNumber ? (
            <Input
              className="mt-2 h-9 rounded-md border-[#d4d4d8] bg-white font-mono text-sm shadow-none focus-visible:ring-black"
              onChange={(event) => onExternalOrderNumberChange(event.target.value)}
              placeholder="External order number"
              value={externalOrderNumber}
            />
          ) : null}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center justify-between border-b border-[#d4d4d8] bg-[#fafafa] px-4 py-2.5">
          <div>
            <p className="text-sm font-black text-[#09090b]">Cart</p>
            <p className="text-xs text-[#71717a]">Active billing session</p>
          </div>
          <p className="font-mono text-sm font-black text-[#09090b]">{itemCountLabel}</p>
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

      <div className="shrink-0 space-y-2 border-t border-[#d4d4d8] bg-white p-3">
        {items.length > 0 ? (
          <DocumentChargesEditor
            charges={charges}
            className="border-b border-[#d4d4d8] pb-2"
            compact
            onChange={onChargesChange}
            taxRates={taxRates}
          />
        ) : null}
        <div className="space-y-1.5 border-b border-[#d4d4d8] pb-2.5">
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-[#52525b]">Subtotal</span>
              <span className="font-mono font-bold text-[#09090b]">
                {formatMoney(totals.subtotal)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#52525b]">Discount</span>
              <span className="font-mono font-bold text-[#09090b]">
                {formatMoney(totals.discountAmount)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#52525b]">Item tax</span>
              <span className="font-mono font-bold text-[#09090b]">
                {formatMoney(totals.taxAmount)}
              </span>
            </div>
            {totals.chargeAmount > 0 || totals.chargeTaxAmount > 0 ? (
              <>
                <div className="flex justify-between">
                  <span className="text-[#52525b]">Charges</span>
                  <span className="font-mono font-bold text-[#09090b]">
                    {formatMoney(totals.chargeAmount)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#52525b]">Charge tax</span>
                  <span className="font-mono font-bold text-[#09090b]">
                    {formatMoney(totals.chargeTaxAmount)}
                  </span>
                </div>
              </>
            ) : null}
            <div className="mt-2 flex items-center justify-between border-t border-[#d4d4d8] pt-2">
              <span className="text-base font-black text-[#09090b]">Total Payable</span>
              <span className="font-mono text-lg font-black text-[#09090b]">
                {formatMoney(totals.total)}
              </span>
            </div>
            {totals.paidAmount > 0 ? (
              <div className="grid grid-cols-2 gap-2 border-t border-[#d4d4d8] pt-1.5 text-xs">
                <div className="flex justify-between text-[#52525b]">
                  <span>Paid</span>
                  <span className="font-mono font-semibold text-[#09090b]">
                    {formatMoney(totals.paidAmount)}
                  </span>
                </div>
                <div className="flex justify-between text-[#52525b]">
                  <span>Change</span>
                  <span className="font-mono font-semibold text-[#09090b]">
                    {formatMoney(totals.changeAmount)}
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            className="h-10 rounded-md border-[#d4d4d8] bg-white text-sm font-black text-[#09090b] shadow-none hover:bg-[#f4f4f5]"
            onClick={onHoldSale}
            type="button"
            variant="outline"
          >
            <PauseCircle className="mr-2 h-4 w-4" />
            Hold / Resume
          </Button>
          <Button
            className="h-10 rounded-md border-[#d4d4d8] bg-white text-sm font-black text-red-700 shadow-none hover:bg-red-50"
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
          className="h-14 w-full rounded-md bg-black text-base font-black text-white shadow-none hover:bg-[#18181b]"
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
