import type { JSX } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export default function ForgotPasswordPage(): JSX.Element {
  return (
    <AuthShell
      description="Request a secure Appwrite recovery link to reset the password for your owner or staff account."
      title="Reset your password"
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
