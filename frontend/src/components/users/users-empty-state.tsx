import { UserPlus, Users } from "lucide-react";
import type { JSX } from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

type UsersEmptyStateProps = {
  canCreate: boolean;
  onCreate: () => void;
};

export function UsersEmptyState({ canCreate, onCreate }: UsersEmptyStateProps): JSX.Element {
  return (
    <div className="space-y-5">
      <EmptyState
        title="No staff users found."
        description="Start building your bakery team by creating the first staff account with role-based access."
        icon={Users}
      />
      {canCreate ? (
        <div className="flex justify-center">
          <Button onClick={onCreate}>
            <UserPlus className="h-4 w-4" />
            Add staff user
          </Button>
        </div>
      ) : null}
    </div>
  );
}
