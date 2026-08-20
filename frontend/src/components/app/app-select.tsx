"use client";

import type { JSX } from "react";

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
  return (
    <div className="grid gap-2">
      {label ? <Label htmlFor="app-select-field">{label}</Label> : null}
      <Select onValueChange={onValueChange} value={value}>
        <SelectTrigger id="app-select-field" aria-invalid={error ? true : undefined}>
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
