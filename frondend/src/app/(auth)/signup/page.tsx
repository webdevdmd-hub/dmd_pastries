import type { JSX } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";

export default function SignupPage(): JSX.Element {
  return (
    <AuthShell
      description="Create the owner account for your business, validate it through the backend, and continue into the POS platform with a clean typed flow."
      title="Create your bakery workspace"
    >
      <SignupForm />
    </AuthShell>
  );
}
