import type { JSX } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

/**
 * Reset links arrive in two shapes while both providers are live.
 *
 * Appwrite puts `userId` and `secret` in the query string. Supabase puts a
 * single-use token there, named `token_hash` by its current email templates and
 * `token` by older ones -- both are read, because which one a given link uses
 * depends on when the template was last edited, not on anything this app
 * controls.
 *
 * Supabase can also be configured to return the token in the URL *fragment*
 * (`#access_token=...`), which never reaches the server and so cannot be read
 * here at all. Keep the recovery template on the query-parameter form; the
 * fragment form would need this page rewritten as a client component for no
 * benefit.
 */
type ResetPasswordPageProps = {
  searchParams: Promise<{
    secret?: string;
    token?: string;
    token_hash?: string;
    userId?: string;
  }>;
};

export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps): Promise<JSX.Element> {
  const params = await searchParams;

  return (
    <AuthShell description="Choose a new password for your account." title="Create a new password">
      <ResetPasswordForm
        secret={params.secret ?? ""}
        token={params.token_hash ?? params.token ?? ""}
        userId={params.userId ?? ""}
      />
    </AuthShell>
  );
}
