import { UserRoundPlus } from "lucide-react";
import type { JSX } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type CustomersEmptyStateProps = {
  canManage: boolean;
  onCreate: () => void;
};

export function CustomersEmptyState({
  canManage,
  onCreate,
}: CustomersEmptyStateProps): JSX.Element {
  return (
    <Card className="border-brand-cappuccino bg-white/80">
      <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
        <div className="rounded-2xl bg-brand-cappuccino/40 p-4 text-brand-mocha">
          <UserRoundPlus className="h-8 w-8" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-brand-espresso">No customers found.</h2>
          <p className="mt-2 text-sm text-brand-mocha">
            Create customer profiles for POS lookup, notes, and purchase history.
          </p>
        </div>
        {canManage ? (
          <Button onClick={onCreate} type="button">
            Add customer
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
