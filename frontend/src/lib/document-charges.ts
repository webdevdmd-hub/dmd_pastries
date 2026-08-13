import {
  defaultDocumentChargeNames,
  type DocumentChargeDraft,
  type DocumentChargeType,
  documentChargeTypes,
} from "@/types/document-charges";

export function roundChargeMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function isDocumentChargeType(value: unknown): value is DocumentChargeType {
  return typeof value === "string" && (documentChargeTypes as readonly string[]).includes(value);
}

export function createDefaultDocumentCharge(
  chargeType: DocumentChargeType = "delivery",
): DocumentChargeDraft {
  return {
    amount: 0,
    chargeName: defaultDocumentChargeNames[chargeType],
    chargeType,
    description: null,
    isRefundable: true,
    taxRateId: null,
    taxRateName: null,
    taxRatePercentage: 0,
  };
}

export function calculateDocumentChargeTax(charge: DocumentChargeDraft): number {
  return roundChargeMoney(charge.amount * (charge.taxRatePercentage / 100));
}

// W3: the owning document's tax mode decides how charge tax applies.
// Without a mode (null/undefined), the legacy exclusive-style preview holds.
export type DocumentTaxMode = "inclusive" | "exclusive" | "no_tax";

export function calculateDocumentChargeTotals(
  charges: DocumentChargeDraft[],
  taxMode?: DocumentTaxMode | null,
): {
  chargeAmount: number;
  chargeTaxAmount: number;
  chargeTotal: number;
} {
  let amountSum = 0;
  let taxSum = 0;
  let totalSum = 0;
  charges.forEach((charge) => {
    const amount = charge.amount;
    amountSum += amount;
    let tax = 0;
    let total = amount;
    if (charge.taxRatePercentage > 0 && amount > 0 && taxMode !== "no_tax") {
      if (taxMode === "inclusive") {
        tax = roundChargeMoney(amount - amount / (1 + charge.taxRatePercentage / 100));
      } else {
        tax = calculateDocumentChargeTax(charge);
        total = roundChargeMoney(amount + tax);
      }
    }
    taxSum += tax;
    totalSum += total;
  });
  return {
    chargeAmount: roundChargeMoney(amountSum),
    chargeTaxAmount: roundChargeMoney(taxSum),
    chargeTotal: roundChargeMoney(totalSum),
  };
}
