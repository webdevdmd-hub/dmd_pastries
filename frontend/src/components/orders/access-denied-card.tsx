import { ShieldAlert } from "lucide-react";
import type { JSX } from "react";

import { Card, CardContent } from "@/components/ui/card";

export function AccessDeniedCard({
  message = "You do not have permission to view bakery orders.",
}: {
  message?: string;
}): JSX.Element {
  return (
    <Card className="border-brand-cappuccino/70 bg-card/85">
      <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
        <ShieldAlert className="h-10 w-10 text-brand-mocha" />
        <h2 className="text-xl font-semibold text-brand-espresso">Access denied</h2>
        <p className="max-w-md text-sm leading-6 text-brand-mocha">{message}</p>
      </CardContent>
    </Card>
  );
}
