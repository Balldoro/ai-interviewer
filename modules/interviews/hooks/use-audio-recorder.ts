import { useEffect, useRef, useState } from 'react';

import { AUDIO_BITS_PER_SECOND, MIME_TYPES } from '../lib/constants';
import type { AudioRecorderState, MicrophoneError } from '../lib/types';

function microphoneErrorOf(error: unknown): MicrophoneError {
  if (error instanceof DOMException && ['NotAllowedError', 'SecurityError'].includes(error.name)) {
    return 'denied';
  }
  return 'unavailable';
}

function release(stream: MediaStream) {
  stream.getTracks().forEach((track) => track.stop());
}

export function useAudioRecorder() {
  const [state, setState] = useState<AudioRecorderState>({ status: 'idle' });

  const recorderRef = useRef<MediaRecorder | null>(null);
  // `state` is read from the last render, so two clicks before a re-render would both pass the
  // status check. These refs stop the second one from opening another microphone stream.
  const isStartingRef = useRef(false);
  const isMountedRef = useRef(false);

  // Releases the microphone if the component unmounts mid-recording. Microphone access that is
  // granted after unmounting is released in `start`.
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (recorderRef.current) release(recorderRef.current.stream);
    };
  }, []);

  async function start() {
    if (isStartingRef.current || recorderRef.current) return;
    if (state.status !== 'idle' && state.status !== 'microphone_error') return;

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setState({ status: 'microphone_error', error: 'unsupported' });
      return;
    }

    isStartingRef.current = true;
    setState({ status: 'starting' });

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      setState({ status: 'microphone_error', error: microphoneErrorOf(error) });
      return;
    } finally {
      isStartingRef.current = false;
    }

    if (!isMountedRef.current) {
      release(stream);
      return;
    }

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, {
        mimeType: MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type)),
        audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
      });
      const chunks: Blob[] = [];

      recorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      });
      recorder.addEventListener(
        'stop',
        () => {
          release(stream);
          // The recorder also stops on its own, e.g. when the microphone is unplugged.
          if (recorderRef.current === recorder) recorderRef.current = null;
          // Releasing the microphone on unmount stops the recorder too, but the audio is no longer
          // needed.
          if (!isMountedRef.current) return;

          if (chunks.length === 0) {
            setState({ status: 'microphone_error', error: 'no_audio' });
            return;
          }

          setState({
            status: 'recorded',
            audio: new Blob(chunks, { type: recorder.mimeType || chunks[0].type }),
          });
        },
        { once: true },
      );

      recorder.start();
    } catch {
      release(stream);
      setState({ status: 'microphone_error', error: 'unavailable' });
      return;
    }

    recorderRef.current = recorder;
    setState({ status: 'recording' });
  }

  function stop() {
    recorderRef.current?.stop();
    recorderRef.current = null;
  }

  function discard() {
    if (state.status === 'recorded') setState({ status: 'idle' });
  }

  return { state, start, stop, discard };
}
