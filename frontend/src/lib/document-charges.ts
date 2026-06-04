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

export function calculateDocumentChargeTotals(charges: DocumentChargeDraft[]): {
  chargeAmount: number;
  chargeTaxAmount: number;
} {
  return {
    chargeAmount: roundChargeMoney(charges.reduce((sum, charge) => sum + charge.amount, 0)),
    chargeTaxAmount: roundChargeMoney(
      charges.reduce((sum, charge) => sum + calculateDocumentChargeTax(charge), 0),
    ),
  };
}
