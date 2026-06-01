import type { JSX } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage(): JSX.Element {
  return (
    <AuthShell
      description="Enter your secure operations cockpit and restore your branch, role, and live workspace context."
      title="Welcome back"
    >
      <LoginForm />
    </AuthShell>
  );
}
