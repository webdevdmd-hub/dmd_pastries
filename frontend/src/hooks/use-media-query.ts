"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Whether a CSS media query currently matches.
 *
 * For the cases where `hidden lg:block` is not enough because the thing being
 * hidden brings something else with it. A Radix Sheet is the example: hiding
 * its content with a CSS class still mounts the overlay, so a desktop user who
 * opened one saw the page dim and blur behind nothing at all.
 *
 * Renders false on the server and on the first client pass, so anything gated
 * on this must be safe to be absent for a frame.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void): (() => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);

      return () => {
        list.removeEventListener("change", onChange);
      };
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Matches Tailwind's `lg` breakpoint, where the split views gain a column. */
export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 1024px)");
}
