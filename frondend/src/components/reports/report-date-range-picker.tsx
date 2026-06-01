import type { JSX } from "react";

import { Input } from "@/components/ui/input";

type ReportDateRangePickerProps = {
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
};

export function ReportDateRangePicker({
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
}: ReportDateRangePickerProps): JSX.Element {
  return (
    <>
      <div className="space-y-2">
        <label className="text-sm font-medium text-brand-espresso" htmlFor="report-date-from">
          Date from
        </label>
        <Input
          id="report-date-from"
          type="date"
          value={dateFrom}
          onChange={(event) => onDateFromChange(event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-brand-espresso" htmlFor="report-date-to">
          Date to
        </label>
        <Input
          id="report-date-to"
          type="date"
          value={dateTo}
          onChange={(event) => onDateToChange(event.target.value)}
        />
      </div>
    </>
  );
}
