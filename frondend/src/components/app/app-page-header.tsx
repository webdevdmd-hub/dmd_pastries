import type { JSX, ReactNode } from "react";

type AppPageHeaderProps = {
  actions?: ReactNode;
  description: string;
  eyebrow?: string;
  title: string;
};

export function AppPageHeader({
  actions,
  description,
  eyebrow,
  title,
}: AppPageHeaderProps): JSX.Element {
  return (
    <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        {eyebrow ? (
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.28em] text-brand-caramel">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="font-display text-4xl text-brand-espresso md:text-5xl">{title}</h1>
        <p className="mt-3 max-w-3xl text-brand-mocha">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}
