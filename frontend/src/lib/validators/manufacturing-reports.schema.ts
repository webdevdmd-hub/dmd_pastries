import { z } from "zod";

const uuidOrAllSchema = z
  .string()
  .refine((value) => value === "all" || z.string().uuid().safeParse(value).success, {
    message: "Select a valid branch.",
  });

const optionalUuidSchema = z.string().uuid().optional().or(z.literal(""));

export const manufacturingPaginationSchema = z.object({
  limit: z.number().int().positive().max(100).optional(),
  page: z.number().int().positive().optional(),
});

export const manufacturingReportFiltersSchema = z
  .object({
    batchStatus: z.string().optional(),
    branchId: uuidOrAllSchema.optional(),
    dateFrom: z.string().min(1, "Date from is required."),
    dateTo: z.string().min(1, "Date to is required."),
    groupBy: z.enum(["day", "week", "month"]).optional(),
    limit: z.number().int().positive().max(100).optional(),
    page: z.number().int().positive().optional(),
    productId: optionalUuidSchema,
    recipeId: optionalUuidSchema,
    sortBy: z.string().optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
  })
  .refine((value) => new Date(value.dateFrom).getTime() <= new Date(value.dateTo).getTime(), {
    message: "Date from must be before date to.",
    path: ["dateFrom"],
  });
