import type { JSX } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

type ResetPasswordPageProps = {
  searchParams: Promise<{
    secret?: string;
    userId?: string;
  }>;
};

export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps): Promise<JSX.Element> {
  const params = await searchParams;

  return (
    <AuthShell
      description="Set a new secure password after confirming your Appwrite recovery link."
      title="Create a new password"
    >
      <ResetPasswordForm secret={params.secret ?? ""} userId={params.userId ?? ""} />
    </AuthShell>
  );
}
