import * as React from "react";

import { cn } from "@/lib/utils/cn";

/**
 * Ledger table (DESIGN.md §4).
 *
 * Row height and cell padding come from `--row-h` / `--cell-pad-x`, which the
 * token layer sets from `[data-table-density]` — so a density change is a single
 * attribute on the document element, not a re-render of every table. See
 * components/density/table-density.tsx.
 *
 * House rules encoded here: no vertical rules, `--muted` row hover, a sticky
 * header in `text-meta`/`--foreground-muted`, and a totals row filled `--muted`
 * with a top border.
 */
const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <div className="relative w-full overflow-auto">
      <table ref={ref} className={cn("w-full caption-bottom text-cell", className)} {...props} />
    </div>
  ),
);
Table.displayName = "Table";

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("[&_tr]:border-b [&_tr]:border-border", className)} {...props} />
));
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />
));
TableBody.displayName = "TableBody";

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn("border-t border-border bg-muted font-medium [&>tr]:last:border-b-0", className)}
    {...props}
  />
));
TableFooter.displayName = "TableFooter";

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn(
        "h-row border-b border-border transition-colors duration-fast ease-out hover:bg-muted data-[state=selected]:bg-muted",
        className,
      )}
      {...props}
    />
  ),
);
TableRow.displayName = "TableRow";

/**
 * `numeric` marks a column that holds money, counts, dates or percentages.
 * It sets `data-numeric`, which globals.css already styles with
 * `font-variant-numeric: tabular-nums`, right alignment and the tighter
 * tracking those columns want.
 *
 * The primitive owns this because leaving it to the call site does not work:
 * measured live, /purchasing/orders had tabular figures on its money cells
 * while /dashboard/admin had none on nine, the recipe editor none on eleven,
 * and /products none on eighteen -- all rendering the same TableCell. Counting
 * files that mention `tabular-nums` says the migration is progressing; counting
 * money cells that carry it says otherwise.
 */
type NumericCellProps = { numeric?: boolean };

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement> & NumericCellProps
>(({ className, numeric, ...props }, ref) => (
  <th
    ref={ref}
    data-numeric={numeric ? "" : undefined}
    className={cn(
      // Sticky so the column names survive a long ledger. Was `text-[0.7rem]`
      // (11.2px), under the 12px floor in DESIGN.md §9.
      "sticky top-0 z-10 h-10 whitespace-nowrap bg-card px-cell-x text-left align-middle text-meta font-medium text-foreground-muted",
      className,
    )}
    {...props}
  />
));
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement> & NumericCellProps
>(({ className, numeric, ...props }, ref) => (
  <td
    ref={ref}
    data-numeric={numeric ? "" : undefined}
    className={cn("px-cell-x align-middle text-foreground", className)}
    {...props}
  />
));
TableCell.displayName = "TableCell";

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption ref={ref} className={cn("mt-4 text-cell text-foreground-muted", className)} {...props} />
));
TableCaption.displayName = "TableCaption";

export { Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow };
