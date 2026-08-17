import { ShieldAlert } from "lucide-react";
import type { JSX } from "react";

import { Card, CardContent } from "@/components/ui/card";

export function AccessDeniedCard({ message }: { message?: string }): JSX.Element {
  return (
    <Card className="border-danger/30 bg-danger-tint/80">
      <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
        <div className="rounded-2xl bg-danger-tint p-4 text-danger-text">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-semibold text-brand-espresso">Access denied</h2>
        <p className="max-w-md text-sm leading-6 text-brand-mocha">
          {message ?? "You do not have permission to view Customers."}
        </p>
      </CardContent>
    </Card>
  );
}
