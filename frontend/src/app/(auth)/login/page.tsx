import type { JSX } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

type LoginPageProps = {
  searchParams: Promise<{
    activated?: string;
  }>;
};

// Read on the server, like accept-invitation does with its token, so the
// client form needs no Suspense boundary for useSearchParams.
export default async function LoginPage({ searchParams }: LoginPageProps): Promise<JSX.Element> {
  const params = await searchParams;

  return (
    <AuthShell description="Sign in to your bakery." title="Welcome back">
      <LoginForm activated={params.activated === "1"} />
    </AuthShell>
  );
}
