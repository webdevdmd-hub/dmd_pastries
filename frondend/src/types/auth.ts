import type { SafeUserProfile } from "@/types/user";

export type RegisterOwnerInput = {
  fullName: string;
  businessName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type ForgotPasswordInput = {
  email: string;
};

export type ResetPasswordInput = {
  password: string;
  confirmPassword: string;
  userId: string;
  secret: string;
};

export type RegisterOwnerResult = {
  user: SafeUserProfile | null;
  redirectTo: string;
  message: string;
};

export type LoginSyncResult = {
  user: SafeUserProfile;
  message: string;
};

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export type PasswordResetRequestResult = {
  sent: boolean;
};

export type PasswordResetCompleteResult = {
  reset: boolean;
};

export type LogoutSyncResult = {
  loggedOut: boolean;
};
