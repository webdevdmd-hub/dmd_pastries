import type { JSX, ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  description: string;
  actions?: ReactNode;
};

export function PageHeader({ title, description, actions }: PageHeaderProps): JSX.Element {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight text-brand-espresso md:text-3xl">
          {title}
        </h1>
        <p className="max-w-3xl text-sm leading-6 text-workspace-muted">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </div>
  );
}
