import type { LucideIcon } from "lucide-react";
import type { JSX } from "react";

type EmptyStateProps = {
  title: string;
  description: string;
  icon: LucideIcon;
};

export function EmptyState({ title, description, icon: Icon }: EmptyStateProps): JSX.Element {
  return (
    <div className="rounded-2xl border border-dashed border-workspace-border bg-workspace-panel p-8 text-center shadow-panel">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-brand-latte text-workspace-muted">
        <Icon className="h-6 w-6" />
      </div>
      <h2 className="text-lg font-semibold text-brand-espresso">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-workspace-muted">{description}</p>
    </div>
  );
}
