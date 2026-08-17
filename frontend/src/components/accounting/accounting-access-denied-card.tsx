import { ShieldAlert } from "lucide-react";
import type { JSX } from "react";

import { Card, CardContent } from "@/components/ui/card";

export function AccountingAccessDeniedCard({
  message = "You need accounting access to view Chart of Accounts.",
}: {
  message?: string;
}): JSX.Element {
  return (
    <Card className="border-brand-cappuccino/70 bg-card/80">
      <CardContent className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
        <ShieldAlert className="h-10 w-10 text-brand-mocha" />
        <h2 className="text-2xl font-semibold text-brand-espresso">Access denied</h2>
        <p className="max-w-md text-sm text-brand-mocha">{message}</p>
      </CardContent>
    </Card>
  );
}
