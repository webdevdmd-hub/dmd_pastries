import { z } from "zod";

const baseUserSchema = {
  fullName: z.string().min(2, "Full name must be at least 2 characters."),
  email: z.string().email("Enter a valid email address."),
  phone: z
    .string()
    .min(1, "Phone is required.")
    .regex(/^[0-9+\-\s()]+$/, "Enter a valid phone number."),
  roleId: z.string().min(1, "Role is required."),
  status: z.enum(["active", "inactive", "suspended", "invited"]),
  branchId: z.string(),
};

export const createUserSchema = z.object({
  ...baseUserSchema,
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
  roleId: z.string().min(1, "Role is required."),
  branchId: z.string(),
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

export type CreateUserSchema = z.infer<typeof createUserSchema>;
export type UpdateUserSchema = z.infer<typeof updateUserSchema>;
export type InviteUserSchema = z.infer<typeof inviteUserSchema>;
export type AcceptInvitationSchema = z.infer<typeof acceptInvitationSchema>;
