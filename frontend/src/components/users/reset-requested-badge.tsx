import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";
import { formatUserRelativeDate } from "@/components/users/user-details-drawer";

// Sits beside the status badge, never replaces it: the account is still
// active; this is a request waiting on a manager.
export function ResetRequestedBadge({
  requestedAt,
}: {
  requestedAt: string | null;
}): JSX.Element | null {
  if (!requestedAt) {
    return null;
  }
  return (
    <Badge
      variant="warning"
      title={`Password reset requested ${formatUserRelativeDate(requestedAt)}`}
    >
      Reset requested · {formatUserRelativeDate(requestedAt)}
    </Badge>
  );
}
