import type { JSX } from "react";

import { AcceptInvitationForm } from "@/components/auth/accept-invitation-form";
import { AuthShell } from "@/components/auth/auth-shell";

type AcceptInvitationPageProps = {
  searchParams: Promise<{
    token?: string;
  }>;
};

export default async function AcceptInvitationPage({
  searchParams,
}: AcceptInvitationPageProps): Promise<JSX.Element> {
  const params = await searchParams;

  return (
    <AuthShell
      title="Accept your invitation"
      description="Create your staff password and activate your bakery workspace account."
    >
      <AcceptInvitationForm token={params.token ?? ""} />
    </AuthShell>
  );
}
