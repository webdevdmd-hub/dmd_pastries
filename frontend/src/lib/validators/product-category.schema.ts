import { z } from "zod";

export const productCategorySchema = z.object({
  parentCategoryId: z.string().trim().optional(),
  categoryName: z.string().trim().min(2, "Category name must be at least 2 characters."),
  categoryCode: z.string().trim().min(2, "Category code must be at least 2 characters."),
  description: z.string().trim().optional(),
  imageUrl: z.string().trim().optional(),
  sortOrder: z.coerce.number().int().min(0, "Sort order cannot be negative."),
});

export type ProductCategorySchema = z.infer<typeof productCategorySchema>;
