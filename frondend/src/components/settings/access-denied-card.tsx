import { ShieldAlert } from "lucide-react";
import type { JSX } from "react";

import { Card, CardContent } from "@/components/ui/card";

export function AccessDeniedCard(): JSX.Element {
  return (
    <Card>
      <CardContent className="p-8">
        <div className="mx-auto flex max-w-xl flex-col items-center gap-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-cappuccino/30 text-brand-caramel">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-brand-espresso">Settings unavailable</h2>
            <p className="text-sm leading-6 text-brand-mocha">
              You do not have permission to view Settings.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
