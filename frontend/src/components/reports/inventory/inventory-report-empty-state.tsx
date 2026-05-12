import { PackageSearch } from "lucide-react";
import type { JSX } from "react";

export function InventoryReportEmptyState({ message }: { message: string }): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-brand-cappuccino bg-brand-latte/50 p-8 text-center">
      <PackageSearch className="h-8 w-8 text-brand-mocha" aria-hidden="true" />
      <p className="mt-3 font-semibold text-brand-espresso">{message}</p>
    </div>
  );
}
