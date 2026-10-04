import { z } from 'zod';

import { AUDIO_TYPES, MAX_AUDIO_BYTES } from './constants';

// The client sets the type, so this only filters out honest mistakes; it doesn't prove the
// bytes are audio.
function isAllowedAudioType(type: string) {
  return AUDIO_TYPES.includes(type.split(';')[0].trim().toLowerCase());
}

const answerSubmissionSchema = z.object({
  interviewId: z.string(),
  position: z.coerce.number().int().min(1),
  audio: z
    .file()
    .min(1)
    .max(MAX_AUDIO_BYTES)
    .refine((file) => isAllowedAudioType(file.type)),
});

export function parseAnswerSubmission(formData: FormData) {
  return answerSubmissionSchema.safeParse(Object.fromEntries(formData));
}
