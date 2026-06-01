import { z } from "zod";

export const unitSchema = z.object({
  unitCategoryId: z.string().trim().min(1, "Unit category is required."),
  unitName: z.string().trim().min(1, "Unit name is required."),
  symbol: z.string().trim().min(1, "Symbol is required."),
  baseUnitId: z.string().trim().optional(),
  conversionFactor: z.coerce.number().positive("Conversion factor must be greater than 0."),
  decimalPrecision: z.coerce
    .number()
    .int("Decimal precision must be a whole number.")
    .min(0, "Decimal precision cannot be negative.")
    .max(6, "Decimal precision should not be more than 6."),
});

export type UnitSchema = z.infer<typeof unitSchema>;
