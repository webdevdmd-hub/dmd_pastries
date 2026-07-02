import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";
import type { MovementDirection } from "@/types/stock-movements";

type MovementDirectionBadgeProps = {
  direction: MovementDirection;
};

export function MovementDirectionBadge({ direction }: MovementDirectionBadgeProps): JSX.Element {
  if (direction === "in") {
    return <Badge className="bg-emerald-100 text-emerald-900 hover:bg-emerald-100">In</Badge>;
  }

  if (direction === "out") {
    return <Badge className="bg-orange-100 text-orange-900 hover:bg-orange-100">Out</Badge>;
  }

  if (direction === "transfer") {
    return <Badge className="bg-sky-100 text-sky-900 hover:bg-sky-100">Transfer</Badge>;
  }

  return <Badge variant="secondary">Neutral</Badge>;
}
