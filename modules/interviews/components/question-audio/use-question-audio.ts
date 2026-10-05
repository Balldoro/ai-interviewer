import { useEffect, useRef } from 'react';

import { logger } from '@/lib/logger';

export function useQuestionAudio(src: string) {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = new Audio(src);
    audioRef.current = audio;

    play(audio);

    return () => audio.pause();
  }, [src]);

  // Replays the audio already received, so the server isn't asked again.
  function replay() {
    const audio = audioRef.current;
    if (!audio) return;

    audio.currentTime = 0;
    play(audio);
  }

  return { replay };
}

function play(audio: HTMLAudioElement) {
  audio.play().catch((error: unknown) => {
    // Browsers block autoplay until the User has interacted with the page, e.g. after a reload.
    // The replay control still works then.
    if (error instanceof DOMException && error.name === 'NotAllowedError') return;
    // Interrupted by `pause`, e.g. when the page is left before the audio starts.
    if (error instanceof DOMException && error.name === 'AbortError') return;

    logger.error('Playing the Interview Question failed', error);
  });
}
