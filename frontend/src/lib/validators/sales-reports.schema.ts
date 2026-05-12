import { z } from "zod";

export const salesReportGroupBySchema = z.enum(["day", "week", "month"]);

const optionalUuidSchema = z
  .string()
  .optional()
  .refine((value) => !value || value === "all" || z.string().uuid().safeParse(value).success, {
    message: "Select a valid record.",
  });

export const salesPaginationSchema = z.object({
  limit: z.number().int().min(1).max(100).optional(),
  page: z.number().int().min(1).optional(),
});

export const salesReportFiltersSchema = z
  .object({
    branchId: optionalUuidSchema,
    cashierUserId: optionalUuidSchema,
    categoryId: optionalUuidSchema,
    dateFrom: z.string().min(1, "Start date is required."),
    dateTo: z.string().min(1, "End date is required."),
    groupBy: salesReportGroupBySchema.optional(),
    limit: z.number().int().min(1).max(100).optional(),
    page: z.number().int().min(1).optional(),
    paymentStatus: z.string().optional(),
    productId: optionalUuidSchema,
    saleStatus: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
    timezone: z.string().optional(),
  })
  .refine((value) => value.dateFrom <= value.dateTo, {
    message: "Start date must be before or equal to end date.",
    path: ["dateTo"],
  });

export type SalesReportFiltersSchema = z.infer<typeof salesReportFiltersSchema>;
