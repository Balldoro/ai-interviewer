'use client';

import type { ReactNode } from 'react';
import { useSliderBalloon } from '@/components/ui/slider/slider-balloon/use-slider-balloon';

function SliderBalloon({ children }: { children: ReactNode }) {
  const { anchorRef, tiltRef } = useSliderBalloon();

  return (
    <span
      ref={anchorRef}
      aria-hidden
      data-slot="slider-thumb-label"
      className="pointer-events-none absolute bottom-1/2 left-1/2 mb-(--slider-balloon-offset) h-(--slider-balloon-height) -translate-x-1/2"
    >
      <span ref={tiltRef} className="block h-full origin-bottom">
        <span className="flex h-full flex-col items-center justify-end">
          {/* A teardrop: a square with one sharp corner, turned so that corner points down. */}
          <span className="grid size-10 rotate-45 place-items-center rounded-[50%_50%_0_50%] bg-primary shadow-md">
            <span className="-rotate-45 text-sm font-semibold text-primary-foreground tabular-nums">
              {children}
            </span>
          </span>
          {/* The balloon's knot. */}
          <span className="mt-1 h-1 w-2 rounded-t-full bg-primary" />
        </span>
      </span>
    </span>
  );
}

export { SliderBalloon };
