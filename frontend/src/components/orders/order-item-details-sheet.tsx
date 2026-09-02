"use client";

import type { JSX } from "react";

import { OrderItemConversionActions } from "@/components/orders/order-item-conversion-actions";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { BakeryOrderItem } from "@/types/orders";

type OrderItemDetailsSheetProps = {
  canConvertToProduct: boolean;
  canConvertToVariant: boolean;
  item: BakeryOrderItem | null;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  orderId: string;
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

/**
 * `customizationsJson` is free-form from the order form. Render it as rows when
 * it is a flat object, and fall back to the raw text when it is anything else.
 */
function parseCustomizations(value: string | null): [string, string][] | null {
  if (!value) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return Object.entries(parsed).map(([key, entry]) => [
      key,
      typeof entry === "string" ? entry : JSON.stringify(entry),
    ]);
  } catch {
    return null;
  }
}

function DetailRow({
  label,
  numeric = false,
  value,
}: {
  label: string;
  numeric?: boolean;
  value: string;
}): JSX.Element {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <dt className="text-cell text-foreground-muted">{label}</dt>
      <dd className={`text-right text-cell text-brand-espresso ${numeric ? "tabular-nums" : ""}`}>
        {value}
      </dd>
    </div>
  );
}

function DetailGroup({ children, title }: { children: JSX.Element; title: string }): JSX.Element {
  return (
    <section>
      <h3 className="text-body font-medium text-brand-espresso">{title}</h3>
      <dl className="mt-2 divide-y divide-brand-cappuccino/40 rounded-2xl bg-muted px-4 py-1">
        {children}
      </dl>
    </section>
  );
}

/**
 * Everything the order stores about one line, in a sheet over the order page.
 *
 * The list row only has room for a one-line spec; design notes, the message,
 * customisations and the price breakdown live here, along with the actions
 * that turn a custom line into catalogue.
 */
export function OrderItemDetailsSheet({
  canConvertToProduct,
  canConvertToVariant,
  item,
  onOpenChange,
  open,
  orderId,
}: OrderItemDetailsSheetProps): JSX.Element {
  const customizations = item ? parseCustomizations(item.customizationsJson) : null;
  const showRawCustomizations = item?.customizationsJson && customizations === null;
  const canConvert = item?.itemSource === "custom" && (canConvertToProduct || canConvertToVariant);

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="text-title">{item?.itemNameSnapshot ?? "Item details"}</SheetTitle>
          <SheetDescription>
            {item?.itemSource === "custom"
              ? "Custom item entered on this order."
              : "Catalogue item snapshotted at the time of ordering."}
          </SheetDescription>
        </SheetHeader>

        {item ? (
          <div className="mt-6 grid gap-6">
            <DetailGroup title="Specification">
              <>
                {item.itemSource !== "custom" ? (
                  <DetailRow label="Product" value={item.productNameSnapshot || "Not recorded"} />
                ) : null}
                {item.productVariantNameSnapshot ? (
                  <DetailRow label="Variant" value={item.productVariantNameSnapshot} />
                ) : null}
                <DetailRow label="Quantity" numeric value={String(item.quantity)} />
                <DetailRow label="Unit" value={item.unitName} />
                {item.weight !== null ? (
                  <DetailRow label="Weight" numeric value={`${String(item.weight)} kg`} />
                ) : null}
                {item.flavor ? <DetailRow label="Flavour" value={item.flavor} /> : null}
                {item.messageText ? <DetailRow label="Message" value={item.messageText} /> : null}
              </>
            </DetailGroup>

            {item.designNotes ? (
              <section>
                <h3 className="text-body font-medium text-brand-espresso">Design notes</h3>
                <p className="mt-2 whitespace-pre-wrap rounded-2xl bg-muted p-4 text-cell text-brand-espresso">
                  {item.designNotes}
                </p>
              </section>
            ) : null}

            {customizations && customizations.length > 0 ? (
              <DetailGroup title="Customisations">
                <>
                  {customizations.map(([key, value]) => (
                    <DetailRow key={key} label={key} value={value} />
                  ))}
                </>
              </DetailGroup>
            ) : null}
            {showRawCustomizations ? (
              <section>
                <h3 className="text-body font-medium text-brand-espresso">Customisations</h3>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-2xl bg-muted p-4 font-mono text-meta text-brand-espresso">
                  {item.customizationsJson}
                </pre>
              </section>
            ) : null}

            <DetailGroup title="Pricing">
              <>
                <DetailRow label="Unit price" numeric value={formatCurrency(item.unitPrice)} />
                <DetailRow label="Discount" numeric value={formatCurrency(item.discountAmount)} />
                <DetailRow label="Tax" numeric value={formatCurrency(item.taxAmount)} />
                <div className="flex items-start justify-between gap-4 py-2">
                  <dt className="text-body font-medium text-brand-espresso">Line total</dt>
                  <dd className="text-body font-medium tabular-nums text-brand-espresso">
                    {formatCurrency(item.lineTotal)}
                  </dd>
                </div>
              </>
            </DetailGroup>

            {canConvert ? (
              <section>
                <h3 className="text-body font-medium text-brand-espresso">Add to catalogue</h3>
                <p className="mt-1 text-cell text-foreground-muted">
                  Reuse this custom item on future orders and at the counter.
                </p>
                <div className="mt-3">
                  <OrderItemConversionActions
                    canConvertToProduct={canConvertToProduct}
                    canConvertToVariant={canConvertToVariant}
                    item={item}
                    orderId={orderId}
                  />
                </div>
              </section>
            ) : null}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
