import { Store } from "lucide-react";
import type { JSX } from "react";

import { EmptyState } from "@/components/shared/empty-state";

export function BranchesEmptyState(): JSX.Element {
  return (
    <EmptyState
      icon={Store}
      title="No branches found."
      description="Create your first branch to manage locations, staff assignment, and branch-level operations."
    />
  );
}
