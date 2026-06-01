import { CakeSlice } from "lucide-react";
import type { JSX } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function OrdersEmptyState({
  canManage,
  onCreate,
}: {
  canManage: boolean;
  onCreate: () => void;
}): JSX.Element {
  return (
    <Card className="border-brand-cappuccino/70 bg-white/85">
      <CardContent className="flex flex-col items-center gap-4 p-12 text-center">
        <CakeSlice className="h-12 w-12 text-brand-mocha" />
        <div>
          <h2 className="text-2xl font-semibold text-brand-espresso">No bakery orders found.</h2>
          <p className="mt-2 text-sm text-brand-mocha">
            Create custom cake and made-to-order workflows with schedule, items, and deposits.
          </p>
        </div>
        {canManage ? (
          <Button onClick={onCreate} type="button">
            Create Order
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
