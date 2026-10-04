import 'server-only';

import * as z from 'zod';

import { env } from '@/env';

import type { Voice } from './voice';

const SPEECH_TO_TEXT_URL = 'https://api.elevenlabs.io/v1/speech-to-text';

const transcriptionSchema = z.object({ text: z.string() });

export const elevenLabsVoice: Voice = {
  async transcribe(audio) {
    const body = new FormData();
    body.set('model_id', 'scribe_v2');
    body.set('file', audio);
    // Interviews are held in English; fixing it stops a strong accent being taken for another
    // language.
    body.set('language_code', 'en');
    // Otherwise silence comes back as tags like "(silence)" rather than empty text.
    body.set('tag_audio_events', 'false');

    const response = await fetch(SPEECH_TO_TEXT_URL, {
      method: 'POST',
      headers: { 'xi-api-key': env.ELEVENLABS_API_KEY },
      body,
    });

    if (!response.ok) {
      throw new Error(`ElevenLabs speech-to-text responded ${response.status}`, {
        cause: await response.text(),
      });
    }

    return transcriptionSchema.parse(await response.json()).text;
  },
};
