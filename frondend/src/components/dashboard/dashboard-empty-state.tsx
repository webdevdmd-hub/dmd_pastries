import { LayoutDashboard } from "lucide-react";
import type { JSX } from "react";

export function DashboardEmptyState({ message }: { message: string }): JSX.Element {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed border-brand-cappuccino bg-brand-latte/50 p-6 text-center">
      <LayoutDashboard className="mb-3 h-8 w-8 text-brand-mocha" aria-hidden="true" />
      <p className="font-medium text-brand-espresso">{message}</p>
    </div>
  );
}
