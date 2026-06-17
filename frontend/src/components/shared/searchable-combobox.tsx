"use client";

import { Check, ChevronsUpDown, Loader2, RotateCcw, X } from "lucide-react";
import type { JSX, ReactNode } from "react";
import { useId, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
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

export type SearchableComboboxOption = {
  value: string;
  label: string;
  description?: string | null;
  keywords?: string[];
  disabled?: boolean | undefined;
};

type SearchableComboboxProps = {
  clearLabel?: string | undefined;
  className?: string | undefined;
  contentClassName?: string | undefined;
  disabled?: boolean | undefined;
  emptyMessage?: string | undefined;
  errorMessage?: string | null | undefined;
  groupLabel?: string | undefined;
  isLoading?: boolean | undefined;
  loadingMessage?: string | undefined;
  onRetry?: (() => void) | undefined;
  onSearchChange?: ((search: string) => void) | undefined;
  onValueChange: (value: string) => void;
  options: SearchableComboboxOption[];
  optionTextWrap?: boolean | undefined;
  placeholder: string;
  searchPlaceholder?: string | undefined;
  searchValue?: string | undefined;
  triggerClassName?: string | undefined;
  value: string;
};

function optionSearchText(option: SearchableComboboxOption): string {
  return [option.label, option.description, ...(option.keywords ?? [])]
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .join(" ")
    .toLowerCase();
}

export function SearchableCombobox({
  clearLabel = "Clear selection",
  className,
  contentClassName,
  disabled = false,
  emptyMessage = "No results found.",
  errorMessage = null,
  groupLabel,
  isLoading = false,
  loadingMessage = "Searching...",
  onRetry,
  onSearchChange,
  onValueChange,
  options,
  optionTextWrap = false,
  placeholder,
  searchPlaceholder = "Search...",
  searchValue,
  triggerClassName,
  value,
}: SearchableComboboxProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [internalSearch, setInternalSearch] = useState("");
  const triggerId = useId();
  const selectedOption = options.find((option) => option.value === value) ?? null;
  const activeSearch = searchValue ?? internalSearch;
  const normalizedSearch = activeSearch.trim().toLowerCase();
  const visibleOptions = useMemo(() => {
    if (onSearchChange || normalizedSearch.length === 0) {
      return options;
    }

    return options.filter((option) => optionSearchText(option).includes(normalizedSearch));
  }, [normalizedSearch, onSearchChange, options]);

  const updateSearch = (nextSearch: string): void => {
    if (searchValue === undefined) {
      setInternalSearch(nextSearch);
    }
    onSearchChange?.(nextSearch);
  };

  const stateContent = useMemo<ReactNode>(() => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center gap-2 py-6 text-sm text-brand-mocha">
          <Loader2 className="h-4 w-4 animate-spin" />
          {loadingMessage}
        </div>
      );
    }

    if (errorMessage) {
      return (
        <div className="grid gap-3 py-5 text-center text-sm text-red-800">
          <span>{errorMessage}</span>
          {onRetry ? (
            <Button className="mx-auto" onClick={onRetry} size="sm" type="button" variant="outline">
              <RotateCcw className="h-4 w-4" />
              Retry
            </Button>
          ) : null}
        </div>
      );
    }

    return null;
  }, [errorMessage, isLoading, loadingMessage, onRetry]);

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <div className={cn("relative", className)}>
        <PopoverTrigger asChild>
          <Button
            aria-controls={`${triggerId}-listbox`}
            aria-expanded={open}
            className={cn(
              "h-11 w-full justify-between overflow-hidden px-3 text-left font-normal",
              triggerClassName,
            )}
            disabled={disabled}
            id={triggerId}
            role="combobox"
            type="button"
            variant="outline"
          >
            <span className="min-w-0 flex-1 truncate">
              {selectedOption ? selectedOption.label : placeholder}
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-60" />
          </Button>
        </PopoverTrigger>
        {value && !disabled ? (
          <Button
            aria-label={clearLabel}
            className="absolute right-9 top-1/2 h-7 w-7 -translate-y-1/2 rounded-full"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onValueChange("");
              updateSearch("");
            }}
            size="icon"
            type="button"
            variant="ghost"
          >
            <X className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
      <PopoverContent className={cn("w-[--radix-popover-trigger-width] p-0", contentClassName)}>
        <Command shouldFilter={false}>
          <CommandInput
            onValueChange={updateSearch}
            placeholder={searchPlaceholder}
            value={activeSearch}
          />
          <CommandList id={`${triggerId}-listbox`}>
            {stateContent}
            {!stateContent ? (
              <>
                <CommandEmpty>{emptyMessage}</CommandEmpty>
                <CommandGroup heading={groupLabel}>
                  {visibleOptions.map((option) => (
                    <CommandItem
                      key={option.value}
                      onSelect={() => {
                        onValueChange(option.value === value ? "" : option.value);
                        updateSearch("");
                        setOpen(false);
                      }}
                      value={option.value}
                      {...(option.disabled === undefined ? {} : { disabled: option.disabled })}
                      {...(option.keywords === undefined ? {} : { keywords: option.keywords })}
                    >
                      <Check
                        className={cn(
                          "h-4 w-4 shrink-0",
                          option.value === value ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span
                          className={cn(
                            "block font-medium",
                            optionTextWrap ? "whitespace-normal leading-snug" : "truncate",
                          )}
                        >
                          {option.label}
                        </span>
                        {option.description ? (
                          <span
                            className={cn(
                              "block text-xs text-brand-mocha",
                              optionTextWrap ? "whitespace-normal leading-snug" : "truncate",
                            )}
                          >
                            {option.description}
                          </span>
                        ) : null}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
