import type { JSX } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ExportHistoryPlaceholder(): JSX.Element {
  return (
    <Card className="bg-white/85 shadow-soft">
      <CardHeader>
        <CardTitle className="text-brand-espresso">Export history</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-2xl border border-dashed border-brand-cappuccino bg-brand-latte/60 p-6 text-sm text-brand-mocha">
          Export history will be added in a future sprint.
        </div>
      </CardContent>
    </Card>
  );
}
