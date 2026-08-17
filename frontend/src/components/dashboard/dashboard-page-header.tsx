import type { JSX, ReactNode } from "react";

export function DashboardPageHeader({
  actions,
  description,
  eyebrow,
  title,
}: {
  actions?: ReactNode;
  description: string;
  eyebrow?: string;
  title: string;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-4 rounded-[2rem] border border-brand-cappuccino bg-card/85 p-6 shadow-soft lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-3">
        {eyebrow ? <p className="text-xs font-semibold text-brand-mocha">{eyebrow}</p> : null}
        <div>
          <h1 className="text-3xl font-semibold text-brand-espresso md:text-4xl">{title}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-brand-mocha">{description}</p>
        </div>
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
