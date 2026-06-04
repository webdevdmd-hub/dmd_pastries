import {
  calculateDocumentChargeTax,
  isDocumentChargeType,
  roundChargeMoney,
} from "@/lib/document-charges";
import {
  defaultDocumentChargeNames,
  type DocumentCharge,
  type DocumentChargeDraft,
} from "@/types/document-charges";

export type BackendDocumentChargePayload = {
  charge_type: string;
  charge_name: string;
  description: string | null;
  amount: number;
  tax_rate_id: string | null;
  is_refundable: boolean;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function numberValue(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function toBackendDocumentChargePayload(
  charge: DocumentChargeDraft,
): BackendDocumentChargePayload {
  const description = charge.description?.trim();

  return {
    amount: charge.amount,
    charge_name: charge.chargeName.trim(),
    charge_type: charge.chargeType,
    description: description !== undefined && description.length > 0 ? description : null,
    is_refundable: charge.isRefundable,
    tax_rate_id: charge.taxRateId,
  };
}

export function parseDocumentCharge(value: unknown): DocumentCharge {
  if (!isObject(value)) {
    throw new Error("Backend charge payload is invalid.");
  }

  const chargeType = isDocumentChargeType(value.charge_type) ? value.charge_type : "other";
  const chargeName = stringValue(value.charge_name, defaultDocumentChargeNames[chargeType]);
  const amount = numberValue(value.amount);
  const taxRatePercentage = numberValue(value.tax_rate_percentage);
  const draft: DocumentChargeDraft = {
    amount,
    chargeName,
    chargeType,
    description: optionalString(value.description),
    isRefundable: value.is_refundable !== false,
    taxRateId: optionalString(value.tax_rate_id),
    taxRateName: optionalString(value.tax_rate_name),
    taxRatePercentage,
  };

  return {
    ...draft,
    id: stringValue(value.id),
    sourceChargeId: optionalString(value.source_charge_id),
    taxAmount: numberValue(value.tax_amount, calculateDocumentChargeTax(draft)),
    totalAmount: numberValue(
      value.total_amount,
      roundChargeMoney(amount + calculateDocumentChargeTax(draft)),
    ),
  };
}

export function parseDocumentCharges(value: unknown): DocumentCharge[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(parseDocumentCharge);
}
