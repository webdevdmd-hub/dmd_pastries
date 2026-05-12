import type { JSX } from "react";

import { AccessDeniedCard as SharedAccessDeniedCard } from "@/components/payments/access-denied-card";

export function AccessDeniedCard(): JSX.Element {
  return (
    <SharedAccessDeniedCard message="You need dashboard access or a dashboard-supported module permission." />
  );
}
