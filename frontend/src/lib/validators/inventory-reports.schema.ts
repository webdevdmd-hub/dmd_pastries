import { z } from "zod";

const uuidOrAllSchema = z
  .string()
  .refine((value) => value === "all" || z.string().uuid().safeParse(value).success, {
    message: "Select a valid branch.",
  });

const optionalDateSchema = z.string().optional();

export const inventoryPaginationSchema = z.object({
  limit: z.number().int().positive().max(100).optional(),
  page: z.number().int().positive().optional(),
});

export const inventoryReportFiltersSchema = z
  .object({
    branchId: uuidOrAllSchema.optional(),
    dateFrom: optionalDateSchema,
    dateTo: optionalDateSchema,
    itemType: z.enum(["product", "product_variant", "ingredient", "packaging"]).optional(),
    limit: z.number().int().positive().max(100).optional(),
    page: z.number().int().positive().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
    status: z.string().optional(),
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
