import 'server-only';

import * as z from 'zod';

import { env } from '@/env';

import type { Voice } from './voice';

const SPEECH_TO_TEXT_URL = 'https://api.elevenlabs.io/v1/speech-to-text';
// A capped 3-minute Answer normally takes seconds; past this the User is better off retrying.
const TIMEOUT_MS = 30_000;

const transcriptionSchema = z.object({ text: z.string() });

export const elevenLabsVoice: Voice = {
  async transcribe(audio) {
    const body = new FormData();
    body.set('model_id', 'scribe_v2');
    // A fixed name, so nothing the client chose is forwarded.
    body.set('file', audio, 'answer');
    // Interviews are held in English; fixing it stops a strong accent being taken for another
    // language.
    body.set('language_code', 'en');
    // Otherwise silence comes back as tags like "(silence)" rather than empty text.
    body.set('tag_audio_events', 'false');

    const response = await fetch(SPEECH_TO_TEXT_URL, {
      method: 'POST',
      headers: { 'xi-api-key': env.ELEVENLABS_API_KEY },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`ElevenLabs speech-to-text responded ${response.status}`, {
        cause: await response.text(),
      });
    }

    return transcriptionSchema.parse(await response.json()).text;
  },
};
