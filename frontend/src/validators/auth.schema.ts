import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .regex(/[A-Z]/, "Password must include at least one uppercase letter.")
  .regex(/[a-z]/, "Password must include at least one lowercase letter.")
  .regex(/[0-9]/, "Password must include at least one number.");

export const signupSchema = z
  .object({
    fullName: z.string().min(2, "Full name must be at least 2 characters."),
    businessName: z.string().min(2, "Business name is required."),
    email: z.string().email("Enter a valid email address."),
    phone: z
      .string()
      .min(8, "Phone number must be at least 8 digits.")
      .regex(/^[0-9+\-\s()]+$/, "Enter a valid phone number."),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid email address."),
});

/**
 * The two providers prove a reset request differently: Appwrite sends a user id
 * plus a secret, Supabase sends a single-use token. Both shapes are accepted
 * for as long as both providers are live, so a link that was emailed before the
 * cutover still works after it -- reset emails outlive the deploy that sent
 * them, and invalidating them would strand whoever asked for one that morning.
 *
 * Neither pair is individually required, because which one arrives depends on
 * who sent the email. The refine below rejects a submission carrying neither.
 */
export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
    userId: z.string(),
    secret: z.string(),
    token: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  })
  .refine(
    (value) => value.token.length > 0 || (value.userId.length > 0 && value.secret.length > 0),
    {
      path: ["password"],
      message: "This reset link is incomplete. Request a new one.",
    },
  );

export type SignupSchema = z.infer<typeof signupSchema>;
export type LoginSchema = z.infer<typeof loginSchema>;
export type ForgotPasswordSchema = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordSchema = z.infer<typeof resetPasswordSchema>;
