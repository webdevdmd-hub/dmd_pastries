"use client";

import type { JSX } from "react";
import { useId } from "react";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type AppSelectOption = {
  disabled?: boolean;
  label: string;
  value: string;
};

type AppSelectProps = {
  error?: string;
  label?: string;
  onValueChange: (value: string) => void;
  options: AppSelectOption[];
  placeholder?: string;
  value: string;
};

export function AppSelect({
  error,
  label,
  onValueChange,
  options,
  placeholder = "Select option",
  value,
}: AppSelectProps): JSX.Element {
  // Every AppSelect on a page shared one hardcoded id, so a second instance
  // stole the first one's label. useId gives each render its own.
  const fieldId = useId();

  return (
    <div className="grid gap-2">
      {label ? <Label htmlFor={fieldId}>{label}</Label> : null}
      <Select onValueChange={onValueChange} value={value}>
        <SelectTrigger aria-invalid={error ? true : undefined} id={fieldId}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem
              {...(option.disabled !== undefined ? { disabled: option.disabled } : {})}
              key={option.value}
              value={option.value}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error ? <p className="text-xs font-medium text-danger-text">{error}</p> : null}
    </div>
  );
}
