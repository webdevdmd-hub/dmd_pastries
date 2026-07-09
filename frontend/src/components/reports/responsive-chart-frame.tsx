"use client";

import type { JSX, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils/cn";

type ChartSize = {
  height: number;
  width: number;
};

type ResponsiveChartFrameProps = {
  ariaLabel: string;
  children: (size: ChartSize) => ReactNode;
  className?: string;
  fallback?: ReactNode;
};

function measureElement(element: HTMLDivElement): ChartSize | null {
  const rect = element.getBoundingClientRect();
  const width = Math.floor(rect.width);
  const height = Math.floor(rect.height);

  return width > 0 && height > 0 ? { height, width } : null;
}

export function ResponsiveChartFrame({
  ariaLabel,
  children,
  className,
  fallback,
}: ResponsiveChartFrameProps): JSX.Element {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<ChartSize | null>(null);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return undefined;

    const updateSize = (): void => {
      const nextSize = measureElement(frame);
      setSize((currentSize) => {
        if (
          currentSize?.height === nextSize?.height &&
          currentSize?.width === nextSize?.width
        ) {
          return currentSize;
        }

        return nextSize;
      });
    };

    updateSize();

    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(frame);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div ref={frameRef} aria-label={ariaLabel} className={cn("w-full", className)} role="img">
      {size ? (
        children(size)
      ) : (
        (fallback ?? <div aria-hidden="true" className="h-full w-full rounded-3xl bg-brand-latte/40" />)
      )}
    </div>
  );
}
