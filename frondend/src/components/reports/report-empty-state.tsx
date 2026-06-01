import { FileText } from "lucide-react";
import type { JSX } from "react";

export function ReportEmptyState({ message }: { message: string }): JSX.Element {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-brand-cappuccino bg-brand-latte/60 p-6 text-center text-brand-mocha">
      <FileText className="h-8 w-8" />
      <p className="text-sm">{message}</p>
    </div>
  );
}
