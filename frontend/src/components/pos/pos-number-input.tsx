"use client";

import type { ComponentProps, JSX } from "react";
import { useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";

// Non-negative decimal, allowing in-progress entries like "12." while typing.
const DECIMAL_PATTERN = /^\d*\.?\d*$/;

function parseDraft(raw: string): number | null {
  if (raw === "" || raw === ".") {
    return null;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatValue(value: number | null): string {
  return value === null ? "" : String(value);
}

type POSNumberInputProps = Omit<
  ComponentProps<typeof Input>,
  "inputMode" | "onChange" | "type" | "value"
> & {
  onValueChange: (value: number | null) => void;
  value: number | null;
};

// A controlled `<input type="number">` cannot hold partial entries such as "12.":
// the browser reports them as "", React writes "" back, and the cashier's keystrokes
// are destroyed (typing 12.50 ends up as 50). This input keeps the raw text as a
// local draft and only reports fully parsed values upward.
export function POSNumberInput({
  onValueChange,
  value,
  ...inputProps
}: POSNumberInputProps): JSX.Element {
  const [draft, setDraft] = useState(formatValue(value));
  const draftRef = useRef(draft);
  draftRef.current = draft;

  useEffect(() => {
    const parsed = parseDraft(draftRef.current);

    if (Object.is(parsed, value)) {
      return;
    }

    // An empty field whose owner coerces null to 0 stays empty until blur.
    if (parsed === null && value === 0) {
      return;
    }

    setDraft(formatValue(value));
  }, [value]);

  return (
    <Input
      {...inputProps}
      inputMode="decimal"
      onBlur={() => setDraft(formatValue(value))}
      onChange={(event) => {
        const raw = event.target.value;

        if (!DECIMAL_PATTERN.test(raw)) {
          return;
        }

        setDraft(raw);
        onValueChange(parseDraft(raw));
      }}
      type="text"
      value={draft}
    />
  );
}
