"use client";

import { useEffect, useState } from "react";

/**
 * Returns a value that trails the input by `delay` ms. Use it between a
 * fast-changing input (search box keystrokes) and anything expensive keyed on
 * the value — React Query keys in particular: an un-debounced search string in
 * a query key creates a new cache entry and a network fetch per keystroke.
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timeout);
  }, [delay, value]);

  return debounced;
}
