'use client';

import { Slider as SliderPrimitive } from '@base-ui/react/slider';
import type { ReactNode } from 'react';
import { SliderBalloon } from '@/components/ui/slider/slider-balloon/slider-balloon';
import { useSlider } from '@/components/ui/slider/use-slider';
import { cn } from '@/lib/utils';

function Slider({
  className,
  min = 0,
  max = 100,
  thumbLabel,
  onPointerDown,
  ...props
}: SliderPrimitive.Root.Props<number> & {
  /**
   * Shown in a balloon above the thumb that trails it as it moves.
   */
  thumbLabel?: ReactNode;
}) {
  const { isPressed, handlePointerDown } = useSlider(onPointerDown);

  return (
    <SliderPrimitive.Root
      className={cn(
        'group/slider data-horizontal:w-full data-vertical:h-full',
        // The balloon is absolutely positioned, so reserve the space it takes above the thumb here;
        // otherwise it overlaps whatever sits above the slider. Its height is the 2.5rem teardrop
        // plus the 0.25rem gap and 0.25rem knot below it, and its tip sits 1.0625rem above the
        // thumb's centre, which is half the 0.375rem track below the top of the control.
        thumbLabel !== undefined &&
          '[--slider-balloon-height:3rem] [--slider-balloon-offset:1.0625rem] pt-[calc(var(--slider-balloon-height)+var(--slider-balloon-offset)-0.1875rem)]',
        className,
      )}
      data-slot="slider"
      data-pressed={isPressed || undefined}
      min={min}
      max={max}
      onPointerDown={handlePointerDown}
      {...props}
    >
      <SliderPrimitive.Control className="relative flex w-full touch-none items-center select-none data-disabled:opacity-50 data-vertical:h-full data-vertical:min-h-40 data-vertical:w-auto data-vertical:flex-col">
        <SliderPrimitive.Track
          data-slot="slider-track"
          className="relative grow overflow-hidden rounded-full bg-input select-none data-horizontal:h-1.5 data-horizontal:w-full data-vertical:h-full data-vertical:w-1"
        >
          <SliderPrimitive.Indicator
            data-slot="slider-range"
            className="bg-primary transition-[width,height] duration-150 ease-out select-none data-horizontal:h-full data-vertical:w-full motion-reduce:transition-none"
          />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          className={cn(
            'relative block shrink-0 rounded-full ring-ring/50 transition-[color,box-shadow,left,right,bottom,width,height] duration-150 ease-out select-none motion-reduce:transition-none after:absolute after:-inset-2 hover:ring-3 focus-visible:ring-3 focus-visible:outline-hidden active:ring-3 disabled:pointer-events-none disabled:opacity-50',
            thumbLabel === undefined
              ? 'size-3 border border-ring bg-white'
              : // With a balloon, the thumb is a ring the balloon rises from, swelling a little while held.
                'size-5 border-2 border-primary bg-background group-data-pressed/slider:size-6',
          )}
        >
          {thumbLabel !== undefined && <SliderBalloon>{thumbLabel}</SliderBalloon>}
        </SliderPrimitive.Thumb>
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  );
}

export { Slider };
