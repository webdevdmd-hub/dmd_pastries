import * as React from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils/cn";

type AppInputProps = React.ComponentPropsWithoutRef<typeof Input> & {
  error?: string;
  helperText?: string;
  label?: string;
};

export const AppInput = React.forwardRef<HTMLInputElement, AppInputProps>(
  ({ className, error, helperText, id, label, ...props }, ref) => {
    const inputId = id ?? props.name;
    const helperId = inputId ? `${inputId}-helper` : undefined;
    const errorId = inputId ? `${inputId}-error` : undefined;

    return (
      <div className="grid gap-2">
        {label && inputId ? <Label htmlFor={inputId}>{label}</Label> : null}
        <Input
          aria-describedby={error ? errorId : helperText ? helperId : undefined}
          aria-invalid={error ? true : undefined}
          className={cn(error ? "border-red-300 focus-visible:ring-red-700" : "", className)}
          id={inputId}
          ref={ref}
          {...props}
        />
        {helperText && !error ? (
          <p className="text-xs text-brand-mocha" id={helperId}>
            {helperText}
          </p>
        ) : null}
        {error ? (
          <p className="text-xs font-medium text-red-700" id={errorId}>
            {error}
          </p>
        ) : null}
      </div>
    );
  },
);

AppInput.displayName = "AppInput";
