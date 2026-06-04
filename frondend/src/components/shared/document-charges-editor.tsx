"use client";

import { Plus, Trash2 } from "lucide-react";
import type { JSX } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  calculateDocumentChargeTax,
  createDefaultDocumentCharge,
  roundChargeMoney,
} from "@/lib/document-charges";
import {
  defaultDocumentChargeNames,
  type DocumentChargeDraft,
  type DocumentChargeType,
  documentChargeTypeLabels,
  documentChargeTypes,
} from "@/types/document-charges";
import type { TaxRate } from "@/types/settings";

const noTaxValue = "__no_tax__";

type DocumentChargesEditorProps = {
  charges: DocumentChargeDraft[];
  className?: string;
  compact?: boolean;
  onChange: (charges: DocumentChargeDraft[]) => void;
  taxRates: TaxRate[];
};

function normalizeAmount(value: string): number {
  if (!value.trim()) {
    return 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(parsed, 0) : 0;
}

function updateChargeType(
  charge: DocumentChargeDraft,
  nextType: DocumentChargeType,
): DocumentChargeDraft {
  const previousDefaultName = defaultDocumentChargeNames[charge.chargeType];
  const shouldUseDefaultName =
    charge.chargeName.trim().length === 0 || charge.chargeName === previousDefaultName;

  return {
    ...charge,
    chargeName: shouldUseDefaultName ? defaultDocumentChargeNames[nextType] : charge.chargeName,
    chargeType: nextType,
  };
}

export function DocumentChargesEditor({
  charges,
  className,
  compact = false,
  onChange,
  taxRates,
}: DocumentChargesEditorProps): JSX.Element {
  const activeTaxRates = taxRates.filter((taxRate) => taxRate.status === "active");
  const chargeAmount = roundChargeMoney(charges.reduce((sum, charge) => sum + charge.amount, 0));
  const chargeTaxAmount = roundChargeMoney(
    charges.reduce((sum, charge) => sum + calculateDocumentChargeTax(charge), 0),
  );

  const updateCharge = (index: number, patch: Partial<DocumentChargeDraft>): void => {
    onChange(
      charges.map((charge, entryIndex) =>
        entryIndex === index ? { ...charge, ...patch } : charge,
      ),
    );
  };

  return (
    <section className={className}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3
            className={
              compact
                ? "text-sm font-black text-[#09090b]"
                : "text-lg font-semibold text-brand-espresso"
            }
          >
            Charges
          </h3>
          <p className={compact ? "text-xs text-[#71717a]" : "text-sm text-brand-mocha"}>
            Optional document-level charges such as delivery, packing, or service fees.
          </p>
        </div>
        <Button
          className={compact ? "h-8 rounded-md px-2 text-xs" : undefined}
          onClick={() => onChange([...charges, createDefaultDocumentCharge()])}
          type="button"
          variant="outline"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add charge
        </Button>
      </div>

      {charges.length === 0 ? (
        <p
          className={
            compact
              ? "mt-2 rounded-md border border-dashed border-[#d4d4d8] p-2 text-xs text-[#71717a]"
              : "mt-4 rounded-2xl border border-dashed border-brand-cappuccino p-4 text-sm text-brand-mocha"
          }
        >
          No charges added.
        </p>
      ) : (
        <div className={compact ? "mt-2 grid gap-2" : "mt-4 grid gap-3"}>
          {charges.map((charge, index) => {
            const selectedTaxRate = activeTaxRates.find(
              (taxRate) => taxRate.id === charge.taxRateId,
            );
            const taxAmount = calculateDocumentChargeTax(charge);

            return (
              <div
                className={
                  compact
                    ? "rounded-md border border-[#d4d4d8] bg-white p-2"
                    : "rounded-2xl border border-brand-cappuccino/60 bg-white/80 p-4"
                }
                key={`${charge.chargeType}-${String(index)}`}
              >
                <div className={compact ? "grid gap-2" : "grid gap-3 md:grid-cols-2"}>
                  <Select
                    onValueChange={(value) =>
                      onChange(
                        charges.map((entry, entryIndex) =>
                          entryIndex === index
                            ? updateChargeType(entry, value as DocumentChargeType)
                            : entry,
                        ),
                      )
                    }
                    value={charge.chargeType}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Charge type" />
                    </SelectTrigger>
                    <SelectContent>
                      {documentChargeTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {documentChargeTypeLabels[type]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    onChange={(event) => updateCharge(index, { chargeName: event.target.value })}
                    placeholder="Charge name"
                    value={charge.chargeName}
                  />
                  <Input
                    min={0}
                    onChange={(event) =>
                      updateCharge(index, { amount: normalizeAmount(event.target.value) })
                    }
                    placeholder="Amount"
                    step="0.01"
                    type="number"
                    value={charge.amount === 0 ? "" : String(charge.amount)}
                  />
                  <Select
                    onValueChange={(value) => {
                      if (value === noTaxValue) {
                        updateCharge(index, {
                          taxRateId: null,
                          taxRateName: null,
                          taxRatePercentage: 0,
                        });
                        return;
                      }

                      const taxRate = activeTaxRates.find((entry) => entry.id === value);
                      updateCharge(index, {
                        taxRateId: taxRate?.id ?? null,
                        taxRateName: taxRate?.taxName ?? null,
                        taxRatePercentage: taxRate?.ratePercentage ?? 0,
                      });
                    }}
                    value={charge.taxRateId ?? noTaxValue}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Tax rate" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={noTaxValue}>No tax</SelectItem>
                      {activeTaxRates.map((taxRate) => (
                        <SelectItem key={taxRate.id} value={taxRate.id}>
                          {taxRate.taxName} ({taxRate.ratePercentage}%)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {!compact ? (
                  <Textarea
                    className="mt-3 min-h-16"
                    onChange={(event) =>
                      updateCharge(index, {
                        description:
                          event.target.value.trim().length > 0 ? event.target.value : null,
                      })
                    }
                    placeholder="Optional charge note"
                    value={charge.description ?? ""}
                  />
                ) : null}

                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <label className="flex items-center gap-2 font-medium text-[#52525b]">
                    <Checkbox
                      checked={charge.isRefundable}
                      onCheckedChange={(checked) =>
                        updateCharge(index, { isRefundable: checked === true })
                      }
                    />
                    Refundable
                  </label>
                  <div className="flex items-center gap-3 text-[#52525b]">
                    {selectedTaxRate ? (
                      <span>
                        Tax {selectedTaxRate.ratePercentage}%: AED {taxAmount.toFixed(2)}
                      </span>
                    ) : null}
                    <Button
                      className={compact ? "h-7 rounded-md px-2 text-xs" : undefined}
                      onClick={() =>
                        onChange(charges.filter((_, entryIndex) => entryIndex !== index))
                      }
                      type="button"
                      variant="outline"
                    >
                      <Trash2 className="mr-2 h-3 w-3" />
                      Remove
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
          <div
            className={
              compact
                ? "rounded-md bg-[#fafafa] p-2 text-xs"
                : "rounded-2xl bg-brand-latte/70 p-3 text-sm"
            }
          >
            <div className="flex justify-between">
              <span>Charges</span>
              <strong>AED {chargeAmount.toFixed(2)}</strong>
            </div>
            <div className="flex justify-between">
              <span>Charge tax</span>
              <strong>AED {chargeTaxAmount.toFixed(2)}</strong>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
