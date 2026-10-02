import type { Slider as SliderPrimitive } from '@base-ui/react/slider';
import { useEffect, useState } from 'react';

type UseSliderOptions = Pick<
  SliderPrimitive.Root.Props,
  'value' | 'defaultValue' | 'onPointerDown'
>;

/**
 * Works out how many thumbs to draw, and tracks whether the slider is being held so the thumb can
 * swell while dragged.
 */
export function useSlider({ value, defaultValue, onPointerDown }: UseSliderOptions) {
  // A single number renders one thumb; with no value at all, render a range of two.
  const thumbCount = Array.isArray(value)
    ? value.length
    : Array.isArray(defaultValue)
      ? defaultValue.length
      : value !== undefined || defaultValue !== undefined
        ? 1
        : 2;

  const [isPressed, setIsPressed] = useState(false);

  useEffect(() => {
    if (!isPressed) return;
    const release = () => setIsPressed(false);
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    return () => {
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
    };
  }, [isPressed]);

  const handlePointerDown: SliderPrimitive.Root.Props['onPointerDown'] = (event) => {
    setIsPressed(true);
    onPointerDown?.(event);
  };

  return { thumbCount, isPressed, handlePointerDown };
}
