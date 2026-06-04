import { z } from "zod";

export const documentChargeSchema = z.object({
  chargeType: z.enum([
    "delivery",
    "service",
    "packing",
    "platform",
    "freight",
    "handling",
    "other",
  ]),
  chargeName: z.string().trim().min(1, "Charge name is required."),
  description: z
    .string()
    .trim()
    .nullable()
    .optional()
    .transform((value) => (typeof value === "string" && value.length > 0 ? value : null)),
  amount: z.coerce.number().positive("Charge amount must be greater than zero."),
  taxRateId: z
    .string()
    .trim()
    .nullable()
    .optional()
    .transform((value) => (typeof value === "string" && value.length > 0 ? value : null)),
  taxRateName: z
    .string()
    .trim()
    .nullable()
    .optional()
    .transform((value) => (typeof value === "string" && value.length > 0 ? value : null)),
  taxRatePercentage: z.coerce.number().min(0).default(0),
  isRefundable: z.boolean().default(true),
});

export const documentChargesSchema = z.array(documentChargeSchema).default([]);
