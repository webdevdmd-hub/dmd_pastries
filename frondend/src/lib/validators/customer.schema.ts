import { z } from "zod";

const optionalTrimmedString = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? value : null))
  .nullable()
  .optional();

const optionalEmail = z
  .string()
  .trim()
  .email("Enter a valid email address.")
  .or(z.literal(""))
  .transform((value) => (value.length > 0 ? value : null))
  .nullable()
  .optional();

const customerGenderSchema = z.enum(["male", "female", "other", "prefer_not_to_say"]);
const customerStatusSchema = z.enum(["active", "inactive", "blocked"]);

function requireContact(
  data: {
    phone?: string | null | undefined;
    email?: string | null | undefined;
  },
  context: z.RefinementCtx,
): void {
  if (!data.phone && !data.email) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Provide at least a phone number or email.",
      path: ["phone"],
    });
  }
}

const customerBaseSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is required."),
  phone: optionalTrimmedString,
  email: optionalEmail,
  dateOfBirth: optionalTrimmedString,
  gender: customerGenderSchema.nullable().optional(),
  addressLine1: optionalTrimmedString,
  addressLine2: optionalTrimmedString,
  city: optionalTrimmedString,
  state: optionalTrimmedString,
  country: optionalTrimmedString,
  postalCode: optionalTrimmedString,
  notes: optionalTrimmedString,
  tagIds: z.array(z.string()).optional(),
});

export const createCustomerSchema = customerBaseSchema.superRefine(requireContact);

export const updateCustomerSchema = customerBaseSchema.partial().superRefine(requireContact);

export const updateCustomerStatusSchema = z.object({
  status: customerStatusSchema,
});

export const quickCreateCustomerSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is required."),
  phone: optionalTrimmedString,
  email: optionalEmail,
});

export const createCustomerNoteSchema = z.object({
  note: z
    .string()
    .trim()
    .min(1, "Note is required.")
    .max(1000, "Note must be 1000 characters or fewer."),
});

export const createCustomerTagSchema = z.object({
  tagName: z.string().trim().min(1, "Tag name is required."),
  color: optionalTrimmedString.refine(
    (value) => value === undefined || value === null || /^#[0-9A-Fa-f]{6}$/.test(value),
    "Use a valid hex color, for example #B08968.",
  ),
});

export type CreateCustomerFormValues = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerFormValues = z.infer<typeof updateCustomerSchema>;
export type QuickCreateCustomerFormValues = z.infer<typeof quickCreateCustomerSchema>;
export type CreateCustomerNoteFormValues = z.infer<typeof createCustomerNoteSchema>;
export type CreateCustomerTagFormValues = z.infer<typeof createCustomerTagSchema>;
