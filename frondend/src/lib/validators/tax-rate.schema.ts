import { z } from "zod";

export const taxRateSchema = z.object({
  taxName: z.string().trim().min(2, "Tax name must be at least 2 characters."),
  taxType: z.string().trim().min(2, "Tax type is required."),
  ratePercentage: z.coerce
    .number()
    .min(0, "Rate cannot be negative.")
    .max(100, "Rate cannot be more than 100."),
  isInclusive: z.boolean(),
  country: z.string().trim().min(2, "Country is required."),
  region: z.string().trim().optional(),
  isDefault: z.boolean(),
});

export type TaxRateSchema = z.infer<typeof taxRateSchema>;
