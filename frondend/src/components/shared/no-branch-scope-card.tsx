import { MapPinOff } from "lucide-react";
import type { JSX } from "react";

import { Card, CardContent } from "@/components/ui/card";

export function NoBranchScopeCard(): JSX.Element {
  return (
    <Card className="border-brand-cappuccino bg-white/80 shadow-soft">
      <CardContent className="p-8">
        <div className="space-y-3 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-cappuccino/30 text-brand-caramel">
            <MapPinOff className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-semibold text-brand-espresso">No active branch assigned</h2>
          <p className="mx-auto max-w-xl text-sm leading-6 text-brand-mocha">
            Ask an owner or admin to assign an active branch, then sign in again or switch to that
            branch before using operational screens.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
