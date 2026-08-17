import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";
import type { MovementDirection } from "@/types/stock-movements";

type MovementDirectionBadgeProps = {
  direction: MovementDirection;
};

export function MovementDirectionBadge({ direction }: MovementDirectionBadgeProps): JSX.Element {
  if (direction === "in") {
    return <Badge className="bg-money-tint text-money-text hover:bg-money-tint">In</Badge>;
  }

  if (direction === "out") {
    return <Badge className="bg-muted text-foreground-muted hover:bg-muted">Out</Badge>;
  }

  if (direction === "transfer") {
    return <Badge className="bg-info-tint text-info-text hover:bg-info-tint">Transfer</Badge>;
  }

  return <Badge variant="secondary">Neutral</Badge>;
}
