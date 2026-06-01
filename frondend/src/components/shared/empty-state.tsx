import type { LucideIcon } from "lucide-react";
import type { JSX } from "react";

type EmptyStateProps = {
  title: string;
  description: string;
  icon: LucideIcon;
};

export function EmptyState({ title, description, icon: Icon }: EmptyStateProps): JSX.Element {
  return (
    <div className="rounded-3xl border border-dashed border-brand-cappuccino bg-brand-latte/60 p-8 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-cappuccino/40 text-brand-mocha">
        <Icon className="h-6 w-6" />
      </div>
      <h2 className="text-lg font-semibold text-brand-espresso">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-brand-mocha">{description}</p>
    </div>
  );
}
