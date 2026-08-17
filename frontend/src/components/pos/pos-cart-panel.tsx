import { ArrowRight, PauseCircle, RotateCcw, Store } from "lucide-react";
import type { JSX } from "react";

import { POSCartItem } from "@/components/pos/pos-cart-item";
import { POSCustomerSelector } from "@/components/pos/pos-customer-selector";
import { POSEmptyCartState } from "@/components/pos/pos-empty-cart-state";
import { DocumentChargesEditor } from "@/components/shared/document-charges-editor";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DocumentTaxMode } from "@/lib/document-charges";
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
  onTaxModeChange: (mode: DocumentTaxMode | null) => void;
  canApplyNoTax: boolean;
  externalOrderNumber: string;
  salesChannelId: string;
  salesChannels: SalesChannel[];
  taxMode: DocumentTaxMode | null;
  taxRates: TaxRate[];
  totals: CartTotals;
};

const taxModeOptions: { label: string; value: DocumentTaxMode | null }[] = [
  { label: "Default", value: null },
  { label: "Incl.", value: "inclusive" },
  { label: "Excl.", value: "exclusive" },
  { label: "No tax", value: "no_tax" },
];

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
  onTaxModeChange,
  canApplyNoTax,
  externalOrderNumber,
  salesChannelId,
  salesChannels,
  taxMode,
  taxRates,
  totals,
}: POSCartPanelProps): JSX.Element {
  const itemCountLabel = items.length === 1 ? "1 item" : `${String(items.length)} items`;
  const selectedChannel = salesChannels.find((channel) => channel.id === salesChannelId) ?? null;

  return (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden bg-card text-foreground">
      <div className="grid shrink-0 grid-cols-1 gap-2 border-b border-border p-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="min-w-0 rounded-md border border-border bg-card p-2.5">
          <POSCustomerSelector onChange={onCustomerChange} value={customerId} />
        </div>

        <div className="grid min-w-0 grid-rows-[24px_36px] gap-1 rounded-md border border-border bg-card p-2.5">
          <div className="flex h-6 items-center gap-2 text-foreground-muted">
            <Store className="h-4 w-4" />
            <p className="text-meta text-foreground-muted">Sales channel</p>
          </div>
          <SearchableSelect
            ariaLabel="Select sales channel"
            clearable={false}
            contentClassName="rounded-md border-border bg-card"
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
            triggerClassName="h-9 min-h-9 rounded-md border-border bg-muted text-sm font-semibold shadow-none hover:bg-card focus-visible:ring-ring"
            value={salesChannelId || defaultChannelValue}
          />
        </div>
        {selectedChannel?.requiresExternalOrderNumber ? (
          <Input
            className="h-9 rounded-md border-border bg-card font-mono text-sm shadow-none focus-visible:ring-ring sm:col-span-2"
            onChange={(event) => onExternalOrderNumberChange(event.target.value)}
            placeholder="External order number"
            value={externalOrderNumber}
          />
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center justify-between border-b border-border bg-muted px-4 py-2.5">
          <div>
            <p className="text-body font-medium text-foreground">Cart</p>
            <p className="text-xs text-foreground-muted">Active billing session</p>
          </div>
          <p className="font-mono text-body font-medium text-foreground">{itemCountLabel}</p>
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

      <div className="shrink-0 space-y-2 border-t border-border bg-card p-3">
        {items.length > 0 ? (
          <DocumentChargesEditor
            charges={charges}
            className="border-b border-border pb-2"
            compact
            onChange={onChargesChange}
            taxRates={taxRates}
          />
        ) : null}
        <div className="flex items-center justify-between gap-2 border-b border-border pb-2">
          <span className="text-meta text-foreground-muted">VAT</span>
          {/* Segmented control, not a row of buttons. Previously the selected
              option was a solid black fill and the rest were outlines, so a
              mode *indicator* read as several competing primary actions next to
              the real one. A muted track with a raised card thumb says "one of
              these is current" instead. DESIGN.md §6. */}
          <div className="inline-flex gap-0.5 rounded-md bg-muted p-0.5" role="group">
            {taxModeOptions
              .filter((option) => option.value !== "no_tax" || canApplyNoTax)
              .map((option) => (
                <button
                  aria-pressed={taxMode === option.value}
                  className={`text-meta rounded px-2.5 py-1 font-medium transition-colors ${
                    taxMode === option.value
                      ? "bg-card text-foreground shadow-xs"
                      : "text-foreground-muted hover:text-foreground"
                  }`}
                  key={option.label}
                  onClick={() => onTaxModeChange(option.value)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
          </div>
        </div>
        <div className="space-y-1.5 border-b border-border pb-2.5">
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-foreground-muted">Subtotal</span>
              <span className="font-mono font-medium tabular-nums text-foreground">
                {formatMoney(totals.subtotal)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-foreground-muted">Discount</span>
              <span className="font-mono font-medium tabular-nums text-foreground">
                {formatMoney(totals.discountAmount)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-foreground-muted">Item tax</span>
              <span className="font-mono font-medium tabular-nums text-foreground">
                {formatMoney(totals.taxAmount)}
              </span>
            </div>
            {totals.chargeAmount > 0 || totals.chargeTaxAmount > 0 ? (
              <>
                <div className="flex justify-between">
                  <span className="text-foreground-muted">Charges</span>
                  <span className="font-mono font-medium tabular-nums text-foreground">
                    {formatMoney(totals.chargeAmount)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground-muted">Charge tax</span>
                  <span className="font-mono font-medium tabular-nums text-foreground">
                    {formatMoney(totals.chargeTaxAmount)}
                  </span>
                </div>
              </>
            ) : null}
            {/* The total is the one thing on this screen a cashier reads from a
                metre away, so it gets the size instead of the weight: 32px mono
                at -0.045em tracking, weight 500. Previously it was 18px at
                weight 900 competing with five other font-medium elements.
                DESIGN.md §2 (text-total). */}
            <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-border pt-2">
              <span className="text-body font-medium text-foreground">Total payable</span>
              <span className="text-total font-mono tabular-nums text-foreground">
                {formatMoney(totals.total)}
              </span>
            </div>
            {totals.paidAmount > 0 ? (
              <div className="grid grid-cols-2 gap-2 border-t border-border pt-1.5 text-xs">
                <div className="flex justify-between text-foreground-muted">
                  <span>Paid</span>
                  <span className="font-mono font-medium tabular-nums text-foreground">
                    {formatMoney(totals.paidAmount)}
                  </span>
                </div>
                <div className="flex justify-between text-foreground-muted">
                  <span>Change</span>
                  <span className="font-mono font-medium tabular-nums text-foreground">
                    {formatMoney(totals.changeAmount)}
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            className="min-h-tap text-body rounded border-border bg-card font-medium text-foreground shadow-none hover:bg-muted"
            onClick={onHoldSale}
            type="button"
            variant="outline"
          >
            <PauseCircle className="mr-2 h-4 w-4" />
            Hold / Resume
          </Button>
          <Button
            className="min-h-tap text-body rounded border-border bg-card font-medium text-danger-text shadow-none hover:border-danger hover:bg-danger-tint"
            disabled={items.length === 0}
            onClick={onClear}
            type="button"
            variant="outline"
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Clear
          </Button>
        </div>
        {/* The commit action: the one saturated thing on the screen, because it
            is the one control that moves money (DESIGN.md §3.2, §6). It was a
            black fill, identical in weight to Exit POS in the header, so nothing
            marked the difference between leaving the till and taking payment.
            The label now carries the amount — a cashier confirms the figure on
            the button against the customer's receipt, not just the word. */}
        <Button
          className="text-body h-14 w-full rounded bg-money font-medium text-primary-foreground shadow-none hover:bg-money-hover disabled:bg-muted disabled:text-foreground-disabled"
          disabled={!canSell || items.length === 0 || isCheckingOut}
          onClick={onCheckout}
          type="button"
        >
          {isCheckingOut ? (
            "Processing..."
          ) : !canSell ? (
            "Sell permission required"
          ) : items.length === 0 ? (
            "Charge"
          ) : (
            <>
              Charge <span className="font-mono tabular-nums">{formatMoney(totals.total)}</span>
            </>
          )}
          <ArrowRight className="ml-3 h-6 w-6" />
        </Button>
      </div>
    </aside>
  );
}
