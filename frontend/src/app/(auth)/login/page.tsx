import type { JSX } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage(): JSX.Element {
  return (
    <AuthShell description="Sign in to your bakery." title="Welcome back">
      <LoginForm />
    </AuthShell>
  );
}
