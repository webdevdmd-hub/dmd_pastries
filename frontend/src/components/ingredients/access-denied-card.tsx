import { ShieldAlert } from "lucide-react";
import type { JSX } from "react";

import { Card, CardContent } from "@/components/ui/card";

type AccessDeniedCardProps = {
  message?: string;
};

export function AccessDeniedCard({
  message = "You do not have permission to view ingredients.",
}: AccessDeniedCardProps): JSX.Element {
  return (
    <Card className="border-danger/30 bg-danger-tint/70">
      <CardContent className="flex items-center gap-3 p-6 text-danger-text">
        <ShieldAlert className="h-5 w-5" />
        <p className="font-medium">{message}</p>
      </CardContent>
    </Card>
  );
}
