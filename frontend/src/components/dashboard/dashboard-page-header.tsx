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
    <div className="flex flex-col gap-4 rounded-[2rem] border border-border bg-card p-6 shadow-xs lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-3">
        {eyebrow ? <p className="text-xs font-semibold text-foreground-muted">{eyebrow}</p> : null}
        <div>
          <h1 className="text-3xl font-semibold text-foreground md:text-4xl">{title}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-foreground-muted">{description}</p>
        </div>
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
