import { ShieldAlert } from "lucide-react";
import type { JSX } from "react";

import { Card, CardContent } from "@/components/ui/card";

export function POSAccessDenied(): JSX.Element {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f9f9fa] p-6">
      <Card className="max-w-lg rounded-lg border-zinc-300 bg-white text-center shadow-none">
        <CardContent className="space-y-4 p-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-red-100 text-red-700">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-zinc-950">POS access denied</h1>
            <p className="mt-2 text-sm text-zinc-600">
              You do not have permission to open POS Billing.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
