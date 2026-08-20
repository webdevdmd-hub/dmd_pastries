import type { JSX } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { reportDatePresets } from "@/constants/report-presets";
import type { ReportDatePreset } from "@/types/reports";

export function ReportPresetSelector({
  onChange,
  value,
}: {
  onChange: (value: ReportDatePreset) => void;
  value: ReportDatePreset;
}): JSX.Element {
  return (
    <div className="space-y-2">
      <label
        htmlFor="report-preset-selector-date-preset"
        className="text-sm font-medium text-brand-espresso"
      >
        Date preset
      </label>
      <Select value={value} onValueChange={(nextValue: ReportDatePreset) => onChange(nextValue)}>
        <SelectTrigger id="report-preset-selector-date-preset">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {reportDatePresets.map((preset) => (
            <SelectItem key={preset.value} value={preset.value}>
              {preset.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
