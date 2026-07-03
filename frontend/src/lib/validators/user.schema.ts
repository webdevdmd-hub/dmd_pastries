import { z } from "zod";

const unassignedBranchValue = "__unassigned__";
const userStatusOptions = ["active", "inactive", "suspended", "invited"] as const;

const createUserStatusSchema = z
  .union([z.enum(userStatusOptions), z.literal("")])
  .refine((status) => status !== "", "Please select the user status before saving.");

const createUserBranchSchema = z
  .string()
  .min(1, "Please select a branch before creating the user.")
  .refine(
    (branchId) => branchId !== unassignedBranchValue,
    "Please select a branch before creating the user.",
  );

const baseUserSchema = {
  fullName: z.string().min(2, "Full name must be at least 2 characters."),
  email: z.string().email("Enter a valid email address."),
  phone: z
    .string()
    .min(1, "Phone is required.")
    .regex(/^[0-9+\-\s()]+$/, "Enter a valid phone number."),
  roleId: z.string().min(1, "Role is required."),
  status: z.enum(userStatusOptions),
  branchId: z.string(),
};

export const createUserSchema = z.object({
  ...baseUserSchema,
  roleId: z.string().min(1, "Please select a role before creating the user."),
  status: createUserStatusSchema,
  branchId: createUserBranchSchema,
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .regex(/[A-Z]/, "Password must include at least one uppercase letter.")
    .regex(/[a-z]/, "Password must include at least one lowercase letter.")
    .regex(/[0-9]/, "Password must include at least one number."),
});

export const updateUserSchema = z.object({
  ...baseUserSchema,
  email: z.string().email("Enter a valid email address."),
});

export const inviteUserSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters."),
  email: z.string().email("Enter a valid email address."),
  phone: z.string().regex(/^[0-9+\-\s()]*$/, "Enter a valid phone number."),
  roleId: z.string().min(1, "Please select a role before sending the invitation."),
  branchId: z.string().min(1, "Please select a branch before sending the invitation."),
});

export const acceptInvitationSchema = z
  .object({
    token: z.string().min(1, "Invitation token is missing."),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters.")
      .regex(/[A-Z]/, "Password must include at least one uppercase letter.")
      .regex(/[a-z]/, "Password must include at least one lowercase letter.")
      .regex(/[0-9]/, "Password must include at least one number."),
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

export type CreateUserSchema = z.input<typeof createUserSchema>;
export type UpdateUserSchema = z.input<typeof updateUserSchema>;
export type InviteUserSchema = z.input<typeof inviteUserSchema>;
export type AcceptInvitationSchema = z.input<typeof acceptInvitationSchema>;
