import { ShieldAlert } from "lucide-react";
import type { JSX } from "react";

import { Card, CardContent } from "@/components/ui/card";

type AccessDeniedCardProps = {
  message?: string;
};

export function AccessDeniedCard({
  message = "You do not have permission to view stock movements.",
}: AccessDeniedCardProps): JSX.Element {
  return (
    <Card className="border-danger/30 bg-danger-tint/70">
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <ShieldAlert className="h-10 w-10 text-danger-text" />
        <h2 className="text-xl font-bold text-brand-espresso">Access denied</h2>
        <p className="max-w-md text-sm text-brand-mocha">{message}</p>
      </CardContent>
    </Card>
  );
}
