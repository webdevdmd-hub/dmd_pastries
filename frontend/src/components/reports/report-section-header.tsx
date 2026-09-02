import type { JSX, ReactNode } from "react";

type ReportSectionHeaderProps = {
  actions?: ReactNode;
  description: string;
  title: string;
};

/**
 * The title line of one report inside an area's tab panel.
 *
 * The area layout owns the page heading, so a report renders this rather than
 * a second `ReportPageHeader`: a panel title in `text-title`, one line of
 * description, and any actions on the right.
 */
export function ReportSectionHeader({
  actions,
  description,
  title,
}: ReportSectionHeaderProps): JSX.Element {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h2 className="text-title text-foreground">{title}</h2>
        <p className="mt-1 text-cell text-foreground-muted">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
