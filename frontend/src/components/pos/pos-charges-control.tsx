"use client";

import { Check, Plus, X } from "lucide-react";
import type { JSX } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { calculateDocumentChargeTax, createDefaultDocumentCharge } from "@/lib/document-charges";
import {
  type DocumentChargeDraft,
  type DocumentChargeType,
  documentChargeTypeLabels,
  documentChargeTypes,
} from "@/types/document-charges";

type POSChargesControlProps = {
  charges: DocumentChargeDraft[];
  className?: string | undefined;
  onChange: (charges: DocumentChargeDraft[]) => void;
};

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-AE", {
    currency: "AED",
    style: "currency",
  }).format(value);
}

function normalizeAmount(value: string): number {
  if (!value.trim()) {
    return 0;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? Math.max(parsed, 0) : 0;
}

/**
 * Charges at the counter: tap a type, type an amount.
 *
 * The shared DocumentChargesEditor gives each charge a type select, a name, an
 * amount, a tax rate, a description and a refundable checkbox. That is the
 * right form on the order screen, where an order is built deliberately. At a
 * till it is six controls deep for what is nearly always "delivery, twelve
 * dirhams", and it filled the panel above the total.
 *
 * So: the types are chips you add from, and each added charge is one line. A
 * type already on the sale has its chip disabled rather than hidden -- the row
 * of chips is also the list of what is available, and a chip that vanishes when
 * used makes that list change shape under the cashier's hand. Removing is the
 * line's own control, so no tap can silently discard a typed amount.
 *
 * Charges still carry the same defaults the full editor creates, including no
 * tax rate. Name, description, refundable and tax remain editable on the order
 * screen, which is the surface that has room to explain them.
 */
export function POSChargesControl({
  charges,
  className,
  onChange,
}: POSChargesControlProps): JSX.Element {
  const usedTypes = new Set(charges.map((charge) => charge.chargeType));
  const total = charges.reduce(
    (sum, charge) => sum + charge.amount + calculateDocumentChargeTax(charge),
    0,
  );

  const addCharge = (chargeType: DocumentChargeType): void => {
    onChange([...charges, createDefaultDocumentCharge(chargeType)]);
  };

  const setAmount = (index: number, value: string): void => {
    onChange(
      charges.map((charge, entryIndex) =>
        entryIndex === index ? { ...charge, amount: normalizeAmount(value) } : charge,
      ),
    );
  };

  const removeCharge = (index: number): void => {
    onChange(charges.filter((_, entryIndex) => entryIndex !== index));
  };

  return (
    <section className={className}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-body font-medium text-foreground">Charges</h3>
        {charges.length > 0 ? (
          <span className="text-meta font-mono tabular-nums text-foreground-muted">
            {formatMoney(total)}
          </span>
        ) : null}
      </div>

      <div className="scrollbar-hidden -mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {documentChargeTypes.map((chargeType) => {
          const isUsed = usedTypes.has(chargeType);

          return (
            <button
              className={`text-meta flex min-h-tap shrink-0 items-center gap-1.5 rounded-full border px-3 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                isUsed
                  ? "cursor-default border-border bg-muted text-foreground-muted"
                  : "border-border bg-card text-foreground hover:bg-muted"
              }`}
              disabled={isUsed}
              key={chargeType}
              onClick={() => addCharge(chargeType)}
              type="button"
            >
              {isUsed ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              {documentChargeTypeLabels[chargeType]}
            </button>
          );
        })}
      </div>

      {charges.length > 0 ? (
        <ul className="mt-2 grid gap-1.5">
          {charges.map((charge, index) => (
            <li className="flex items-center gap-2" key={`${charge.chargeType}-${String(index)}`}>
              <span className="text-body min-w-0 flex-1 truncate text-foreground">
                {charge.chargeName}
              </span>
              <Input
                aria-label={`${charge.chargeName} amount`}
                className="text-body h-12 w-24 rounded-md border-border text-right font-mono tabular-nums shadow-none"
                inputMode="decimal"
                min={0}
                onChange={(event) => setAmount(index, event.target.value)}
                step="0.01"
                type="number"
                value={charge.amount === 0 ? "" : String(charge.amount)}
                placeholder="0.00"
              />
              <Button
                aria-label={`Remove ${charge.chargeName}`}
                className="h-12 w-12 shrink-0 rounded-md text-foreground-muted hover:bg-danger-tint hover:text-danger-text"
                onClick={() => removeCharge(index)}
                size="icon"
                type="button"
                variant="ghost"
              >
                <X className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
