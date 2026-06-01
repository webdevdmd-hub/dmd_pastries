import { ShieldPlus } from "lucide-react";
import type { JSX } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type RolesEmptyStateProps = {
  canCreate: boolean;
  onCreate: () => void;
};

export function RolesEmptyState({ canCreate, onCreate }: RolesEmptyStateProps): JSX.Element {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-cappuccino/30 text-brand-caramel">
          <ShieldPlus className="h-6 w-6" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-brand-espresso">No custom roles found.</h2>
          <p className="max-w-xl text-sm leading-6 text-brand-mocha">
            Create staff roles to control access across your POS system.
          </p>
        </div>
        {canCreate ? <Button onClick={onCreate}>Create Role</Button> : null}
      </CardContent>
    </Card>
  );
}
