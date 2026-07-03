import { z } from "zod";

export const reportGroupBySchema = z.enum(["day", "week", "month", "payment_method", "category"]);

export const exportReportTypeSchema = z.string().min(1, "Select a report to export.");

const branchIdSchema = z
  .string()
  .optional()
  .refine((value) => !value || value === "all" || z.string().uuid().safeParse(value).success, {
    message: "Select a valid branch.",
  });

export const reportBaseFiltersSchema = z
  .object({
    branchId: branchIdSchema,
    dateFrom: z.string().min(1, "Start date is required."),
    dateTo: z.string().min(1, "End date is required."),
    groupBy: reportGroupBySchema.optional(),
    scope: z.enum(["current_branch", "all_branches"]).optional(),
    timezone: z.string().optional(),
  })
  .refine((value) => value.dateFrom <= value.dateTo, {
    message: "Start date must be before or equal to end date.",
    path: ["dateTo"],
  });

export const exportReportSchema = z.object({
  filters: reportBaseFiltersSchema,
  reportType: exportReportTypeSchema,
});

export type ReportBaseFiltersSchema = z.infer<typeof reportBaseFiltersSchema>;
export type ExportReportSchema = z.infer<typeof exportReportSchema>;
