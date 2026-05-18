"use client";

import type { JSX } from "react";

import {
  SearchableCombobox,
  type SearchableComboboxOption,
} from "@/components/shared/searchable-combobox";

type AsyncSearchableComboboxProps = {
  className?: string;
  disabled?: boolean;
  emptyMessage?: string;
  errorMessage?: string | null;
  isLoading: boolean;
  onRetry?: () => void;
  onSearchChange: (search: string) => void;
  onValueChange: (value: string) => void;
  options: SearchableComboboxOption[];
  placeholder: string;
  searchPlaceholder?: string;
  searchValue: string;
  value: string;
};

export function AsyncSearchableCombobox({
  className,
  disabled,
  emptyMessage,
  errorMessage,
  isLoading,
  onRetry,
  onSearchChange,
  onValueChange,
  options,
  placeholder,
  searchPlaceholder,
  searchValue,
  value,
}: AsyncSearchableComboboxProps): JSX.Element {
  return (
    <SearchableCombobox
      className={className}
      disabled={disabled}
      emptyMessage={emptyMessage}
      errorMessage={errorMessage}
      isLoading={isLoading}
      onRetry={onRetry}
      onSearchChange={onSearchChange}
      onValueChange={onValueChange}
      options={options}
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      searchValue={searchValue}
      value={value}
    />
  );
}
