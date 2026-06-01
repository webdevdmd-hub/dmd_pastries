import { Settings } from "lucide-react";
import type { JSX } from "react";

import { Card, CardContent } from "@/components/ui/card";

export function SettingsEmptyState(): JSX.Element {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-cappuccino/30 text-brand-caramel">
          <Settings className="h-6 w-6" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-brand-espresso">
            No settings sections available
          </h2>
          <p className="max-w-xl text-sm leading-6 text-brand-mocha">
            No settings sections available for your role.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
