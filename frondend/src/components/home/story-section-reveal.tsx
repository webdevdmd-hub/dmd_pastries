"use client";

import type { CSSProperties, JSX, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils/cn";

type StoryRevealVariant = "rise" | "scale" | "slide-left" | "slide-right";

type StorySectionRevealProps = {
  children: ReactNode;
  className?: string;
  delayMs?: number;
  variant?: StoryRevealVariant;
};

export function StorySectionReveal({
  children,
  className,
  delayMs = 0,
  variant = "rise",
}: StorySectionRevealProps): JSX.Element {
  const ref = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;

    if (!element) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(element);
        }
      },
      {
        rootMargin: "0px 0px -12% 0px",
        threshold: 0.16,
      },
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, []);

  const style = {
    transitionDelay: `${delayMs.toString()}ms`,
  } satisfies CSSProperties;

  return (
    <div
      className={cn(
        "story-section-reveal",
        `story-section-reveal-${variant}`,
        isVisible ? "story-section-reveal-visible" : null,
        className,
      )}
      ref={ref}
      style={style}
    >
      {children}
    </div>
  );
}
