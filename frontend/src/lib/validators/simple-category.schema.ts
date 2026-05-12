import { z } from "zod";

export const simpleCategorySchema = z.object({
  categoryName: z.string().trim().min(2, "Category name must be at least 2 characters."),
  description: z.string().trim().optional(),
});

export type SimpleCategorySchema = z.infer<typeof simpleCategorySchema>;
