"use client";

import type { CSSProperties, JSX, ReactNode } from "react";
import { createContext, useContext, useMemo, useState } from "react";

type HeroPointer = {
  x: number;
  y: number;
};

type FoundationHeroEffectsProps = {
  children: ReactNode;
};

type ParallaxLayerProps = {
  children: ReactNode;
  className?: string;
  depth?: number;
};

const HeroPointerContext = createContext<HeroPointer>({ x: 0, y: 0 });

export function FoundationHeroEffects({ children }: FoundationHeroEffectsProps): JSX.Element {
  const [pointer, setPointer] = useState<HeroPointer>({ x: 0, y: 0 });
  const contextValue = useMemo(() => pointer, [pointer]);

  return (
    <HeroPointerContext.Provider value={contextValue}>
      <div
        className="relative"
        onMouseMove={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect();
          const x = (event.clientX - bounds.left) / bounds.width - 0.5;
          const y = (event.clientY - bounds.top) / bounds.height - 0.5;
          setPointer({ x, y });
        }}
        onMouseLeave={() => {
          setPointer({ x: 0, y: 0 });
        }}
      >
        {children}
      </div>
    </HeroPointerContext.Provider>
  );
}

export function ParallaxLayer({
  children,
  className,
  depth = 20,
}: ParallaxLayerProps): JSX.Element {
  const pointer = useContext(HeroPointerContext);
  const offsetX = (pointer.x * depth).toFixed(2);
  const offsetY = (pointer.y * depth).toFixed(2);
  const style = {
    transform: `translate3d(${offsetX}px, ${offsetY}px, 0)`,
  } satisfies CSSProperties;

  return (
    <div className={className} style={style}>
      {children}
    </div>
  );
}
