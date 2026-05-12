import type { JSX } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { VerifyEmailPanel } from "@/components/auth/verify-email-panel";

type VerifyEmailPageProps = {
  searchParams: Promise<{
    secret?: string;
    userId?: string;
  }>;
};

export default async function VerifyEmailPage({
  searchParams,
}: VerifyEmailPageProps): Promise<JSX.Element> {
  const params = await searchParams;

  return (
    <AuthShell
      description="Verify the email attached to your account to strengthen access security and complete onboarding."
      title="Confirm your email"
    >
      <VerifyEmailPanel secret={params.secret ?? ""} userId={params.userId ?? ""} />
    </AuthShell>
  );
}
