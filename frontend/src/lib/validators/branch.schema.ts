import { z } from "zod";

export const branchSchema = z.object({
  name: z.string().min(2, "Branch name must be at least 2 characters."),
  code: z.string().min(2, "Branch code must be at least 2 characters."),
  managerUserId: z.string(),
  phone: z.string().regex(/^[0-9+\-\s()]*$/, "Enter a valid phone number."),
  email: z.string().email("Enter a valid email address.").or(z.literal("")),
  address: z.string().min(2, "Address is required."),
  timezone: z.string().min(2, "Timezone is required."),
  status: z.enum(["active", "inactive"]),
});

export type BranchSchema = z.infer<typeof branchSchema>;
