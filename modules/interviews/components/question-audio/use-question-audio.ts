import { useEffect, useState } from 'react';

import { logger } from '@/lib/logger';

import { getQuestionAudioPlayer } from '../../lib/question-audio-player';

export function useQuestionAudio(src: string) {
  const [isBlocked, setIsBlocked] = useState(false);

  useEffect(() => {
    const audio = getQuestionAudioPlayer();
    audio.src = src;

    play(audio, setIsBlocked);

    return () => audio.pause();
  }, [src]);

  // Replays the audio already received, so the server isn't asked again.
  function replay() {
    const audio = getQuestionAudioPlayer();

    audio.currentTime = 0;
    play(audio, setIsBlocked);
  }

  return { isBlocked, replay };
}

function play(audio: HTMLAudioElement, setIsBlocked: (isBlocked: boolean) => void) {
  audio
    .play()
    .then(() => setIsBlocked(false))
    .catch((error: unknown) => {
      // Browsers block audio until the User has interacted with the page, e.g. after a reload, so
      // the User is asked to press play instead.
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        setIsBlocked(true);
        return;
      }
      // Interrupted by `pause`, e.g. when the page is left before the audio starts.
      if (error instanceof DOMException && error.name === 'AbortError') return;

      logger.error('Playing the Interview Question failed', error);
    });
}
