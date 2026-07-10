"use client";

import { Check, ChevronsUpDown, Loader2, X } from "lucide-react";
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils/cn";

export type SearchableSelectOption = {
  description?: string;
  disabled?: boolean;
  keywords?: readonly string[];
  label: string;
  meta?: string;
  value: string;
};

type SearchableSelectProps = {
  ariaLabel?: string;
  className?: string;
  clearable?: boolean;
  contentClassName?: string;
  disabled?: boolean;
  emptyMessage?: string;
  loading?: boolean;
  loadingMessage?: string;
  onSearchChange?: (value: string) => void;
  onValueChange: (value: string | null) => void;
  optionGroupLabel?: string;
  options: readonly SearchableSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  searchValue?: string;
  showSelectedDescription?: boolean;
  triggerClassName?: string;
  value: string | null;
};

export function SearchableSelect({
  ariaLabel,
  className,
  clearable = true,
  contentClassName,
  disabled = false,
  emptyMessage = "No options found.",
  loading = false,
  loadingMessage = "Loading options...",
  onSearchChange,
  onValueChange,
  optionGroupLabel,
  options,
  placeholder = "Select an option",
  searchPlaceholder = "Search...",
  searchValue,
  showSelectedDescription = true,
  triggerClassName,
  value,
}: SearchableSelectProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [localSearch, setLocalSearch] = useState("");
  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value],
  );
  const commandSearch = searchValue ?? localSearch;
  const shouldUseRemoteSearch = Boolean(onSearchChange);

  useEffect(() => {
    if (open) {
      return;
    }

    if (onSearchChange) {
      onSearchChange("");
    } else {
      setLocalSearch("");
    }
  }, [onSearchChange, open]);

  const handleSearchChange = (nextValue: string): void => {
    if (onSearchChange) {
      onSearchChange(nextValue);
      return;
    }

    setLocalSearch(nextValue);
  };

  const handleClear = (): void => {
    onValueChange(null);
    setOpen(false);
  };

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <div className={cn("relative min-w-0 max-w-full", className)}>
        <PopoverTrigger asChild>
          <button
            aria-expanded={open}
            aria-label={ariaLabel ?? placeholder}
            className={cn(
              "flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-input bg-background px-3 py-2 text-left text-sm text-brand-espresso shadow-sm transition-colors hover:bg-brand-latte/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
              clearable && selectedOption ? "pr-9" : "",
              triggerClassName,
            )}
            disabled={disabled}
            role="combobox"
            type="button"
          >
            <span className="min-w-0 flex-1">
              {selectedOption ? (
                <span className="block truncate font-semibold">{selectedOption.label}</span>
              ) : (
                <span className="block truncate text-muted-foreground">{placeholder}</span>
              )}
              {showSelectedDescription && selectedOption?.description ? (
                <span className="block truncate text-xs font-normal text-brand-mocha">
                  {selectedOption.description}
                </span>
              ) : null}
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-brand-mocha" />
          </button>
        </PopoverTrigger>

        {clearable && selectedOption && !disabled ? (
          <button
            aria-label="Clear selected option"
            className="absolute right-8 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-brand-mocha transition hover:bg-brand-latte hover:text-brand-espresso focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              handleClear();
            }}
            type="button"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      <PopoverContent
        className={cn(
          "w-[var(--radix-popover-trigger-width)] overflow-hidden p-0",
          contentClassName,
        )}
      >
        <Command shouldFilter={!shouldUseRemoteSearch}>
          <CommandInput
            onValueChange={handleSearchChange}
            placeholder={searchPlaceholder}
            value={commandSearch}
          />
          <CommandList>
            <CommandEmpty>{loading ? loadingMessage : emptyMessage}</CommandEmpty>
            {!loading ? (
              <CommandGroup heading={optionGroupLabel}>
                {options.map((option) => (
                  <CommandItem
                    disabled={option.disabled === true}
                    key={option.value}
                    keywords={[
                      option.label,
                      option.description ?? "",
                      option.meta ?? "",
                      ...(option.keywords ?? []),
                    ]}
                    onSelect={() => {
                      onValueChange(option.value);
                      setOpen(false);
                    }}
                    value={option.value}
                  >
                    <Check
                      className={cn(
                        "h-4 w-4 shrink-0",
                        selectedOption?.value === option.value ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{option.label}</span>
                      {option.description ? (
                        <span className="block truncate text-xs text-brand-mocha">
                          {option.description}
                        </span>
                      ) : null}
                    </span>
                    {option.meta ? (
                      <span className="shrink-0 rounded-md bg-brand-latte px-2 py-0.5 font-mono text-[0.68rem] font-semibold text-brand-mocha">
                        {option.meta}
                      </span>
                    ) : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : (
              <div className="flex items-center gap-2 px-4 py-3 text-sm text-brand-mocha">
                <Loader2 className="h-4 w-4 animate-spin" />
                {loadingMessage}
              </div>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
