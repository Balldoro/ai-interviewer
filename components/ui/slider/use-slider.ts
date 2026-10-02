import type { Slider as SliderPrimitive } from '@base-ui/react/slider';
import { useEffect, useState } from 'react';

/**
 * Tracks whether the slider is being held so the thumb can swell while dragged.
 */
export function useSlider(onPointerDown: SliderPrimitive.Root.Props['onPointerDown']) {
  const [isPressed, setIsPressed] = useState(false);

  useEffect(() => {
    if (!isPressed) return;
    const controller = new AbortController();
    const release = () => setIsPressed(false);

    window.addEventListener('pointerup', release, { signal: controller.signal });
    window.addEventListener('pointercancel', release, { signal: controller.signal });
    return () => controller.abort();
  }, [isPressed]);

  const handlePointerDown: SliderPrimitive.Root.Props['onPointerDown'] = (event) => {
    setIsPressed(true);
    onPointerDown?.(event);
  };

  return { isPressed, handlePointerDown };
}
