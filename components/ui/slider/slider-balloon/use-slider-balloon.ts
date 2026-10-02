import { useEffect, useRef } from 'react';

// Spring that pulls the balloon after the thumb. Only slightly underdamped, so it settles with a small sway.
const STIFFNESS = 260;
const DAMPING = 30;
// Degrees of tilt per px/s of balloon speed, so it leans back like a balloon dragged on a string.
const TILT_PER_SPEED = 0.04;
const MAX_TILT = 15;

/**
 * Makes the balloon trail its thumb when the value changes. The balloon sits inside the thumb, so it
 * is always centred on it at rest; while the thumb moves, this springs a sideways offset after it
 * and tilts the balloon by its speed, then settles back to no offset. Writes styles straight to the
 * returned refs, so the animation doesn't re-render React every frame.
 */
export function useSliderBalloon() {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const tiltRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const anchor = anchorRef.current;
    const tilt = tiltRef.current;
    const thumb = anchor?.parentElement;
    const control = thumb?.parentElement;
    const input = thumb?.querySelector('input');
    if (!anchor || !tilt || !thumb || !control || !input) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    // Where the thumb is drawn right now, partway through its own transition.
    const thumbCentre = () => {
      const rect = thumb.getBoundingClientRect();
      return rect.left + rect.width / 2;
    };
    // Where the thumb is heading: Base UI centres it at `inset-inline-start`, a percentage of the
    // control's width.
    const thumbDestination = () => {
      const rect = control.getBoundingClientRect();
      return rect.left + (rect.width * parseFloat(thumb.style.insetInlineStart)) / 100;
    };

    let value = input.value;
    // Where the balloon is drawn, in the same page coordinates as `thumbCentre()`.
    let position = thumbCentre();
    let velocity = 0;
    let frame = 0;
    let last = 0;

    const step = (now: number) => {
      const target = thumbDestination();
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      velocity += (STIFFNESS * (target - position) - DAMPING * velocity) * dt;
      position += velocity * dt;

      // The balloon is drawn inside the thumb, so its offset is measured from where the thumb is now.
      const offset = position - thumbCentre();
      if (Math.abs(target - position) < 0.1 && Math.abs(velocity) < 1 && Math.abs(offset) < 0.1) {
        anchor.style.translate = '';
        tilt.style.rotate = '';
        frame = 0;
        return;
      }
      anchor.style.translate = `calc(-50% + ${offset}px) 0`;
      const degrees = Math.max(-MAX_TILT, Math.min(MAX_TILT, -velocity * TILT_PER_SPEED));
      tilt.style.rotate = `${degrees}deg`;
      frame = requestAnimationFrame(step);
    };

    // Base UI moves the thumb by rewriting its inline style. Only a change of value swings the
    // balloon; anything else, like a resize, moves the thumb and balloon together.
    const observer = new MutationObserver(() => {
      if (input.value === value) return;
      value = input.value;
      if (frame) return;
      // The thumb's own transition hasn't started yet, so this is still where it was.
      position = thumbCentre();
      velocity = 0;
      last = performance.now();
      frame = requestAnimationFrame(step);
    });
    observer.observe(thumb, { attributes: true, attributeFilter: ['style'] });
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  return { anchorRef, tiltRef };
}
