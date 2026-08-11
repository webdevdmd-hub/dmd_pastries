import { z } from "zod";

const uuidOrAllSchema = z
  .string()
  .refine((value) => value === "all" || z.string().uuid().safeParse(value).success, {
    message: "Select a valid branch.",
  });

const optionalUuidSchema = z.string().uuid().optional().or(z.literal(""));

export const bakeryOrdersPaginationSchema = z.object({
  limit: z.number().int().positive().max(100).optional(),
  page: z.number().int().positive().optional(),
});

const bakeryOrdersReportFiltersBaseSchema = z.object({
  branchId: uuidOrAllSchema.optional(),
  customerId: optionalUuidSchema,
  dateFrom: z.string().min(1, "Date from is required."),
  dateTo: z.string().min(1, "Date to is required."),
  groupBy: z.enum(["day", "week", "month"]).optional(),
  limit: z.number().int().positive().max(100).optional(),
  orderStatus: z.string().optional(),
  orderType: z.enum(["pickup", "delivery"]).optional(),
  page: z.number().int().positive().optional(),
  paymentStatus: z.string().optional(),
});

export const bakeryOrdersReportFiltersSchema = bakeryOrdersReportFiltersBaseSchema.refine(
  (value) => new Date(value.dateFrom).getTime() <= new Date(value.dateTo).getTime(),
  {
    message: "Date from must be before date to.",
    path: ["dateFrom"],
  },
);

export const bakeryOrdersPendingPaymentsFiltersSchema = bakeryOrdersReportFiltersBaseSchema
  .extend({
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
  })
  .refine(
    (value) => {
      if (!value.dateFrom || !value.dateTo) {
        return true;
      }
      return new Date(value.dateFrom).getTime() <= new Date(value.dateTo).getTime();
    },
    {
      message: "Date from must be before date to.",
      path: ["dateFrom"],
    },
  );
