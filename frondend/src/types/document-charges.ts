export const documentChargeTypes = [
  "delivery",
  "service",
  "packing",
  "platform",
  "freight",
  "handling",
  "other",
] as const;

export type DocumentChargeType = (typeof documentChargeTypes)[number];

export const documentChargeTypeLabels: Record<DocumentChargeType, string> = {
  delivery: "Delivery",
  service: "Service",
  packing: "Packing",
  platform: "Platform",
  freight: "Freight",
  handling: "Handling",
  other: "Other",
};

export const defaultDocumentChargeNames: Record<DocumentChargeType, string> = {
  delivery: "Delivery Charge",
  service: "Service Charge",
  packing: "Packing Charge",
  platform: "Platform Charge",
  freight: "Freight",
  handling: "Handling Fee",
  other: "Other Charge",
};

export type DocumentChargeDraft = {
  chargeType: DocumentChargeType;
  chargeName: string;
  description: string | null;
  amount: number;
  taxRateId: string | null;
  taxRateName: string | null;
  taxRatePercentage: number;
  isRefundable: boolean;
};

export type DocumentCharge = DocumentChargeDraft & {
  id: string;
  taxAmount: number;
  totalAmount: number;
  sourceChargeId: string | null;
};
