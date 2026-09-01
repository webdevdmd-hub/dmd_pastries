import type { JSX } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export default function ForgotPasswordPage(): JSX.Element {
  return (
    <AuthShell
      description="We will email you a secure link to set a new password."
      title="Reset your password"
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
