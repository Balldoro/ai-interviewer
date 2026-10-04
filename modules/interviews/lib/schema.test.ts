import { describe, expect, it } from 'vitest';

import { MAX_AUDIO_BYTES } from './constants';
import { parseAnswerSubmission } from './schema';

const INTERVIEW_ID = '00000000-0000-4000-8000-000000000001';

function audio(content = 'audio', type = 'audio/webm;codecs=opus') {
  return new File([content], 'answer.webm', { type });
}

function formData(fields: Record<string, string | File>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

describe('parseAnswerSubmission', () => {
  it('reads the Interview, the position and the audio from the submitted fields', () => {
    const file = audio();

    const parsed = parseAnswerSubmission(
      formData({ interviewId: INTERVIEW_ID, position: '2', audio: file }),
    );

    expect(parsed.data).toMatchObject({ interviewId: INTERVIEW_ID, position: 2 });
    expect(parsed.data?.audio.size).toBe(file.size);
  });

  it.each([
    'audio/webm;codecs=opus',
    'audio/ogg;codecs=opus',
    'audio/mp4',
    'audio/mp4; codecs=mp4a',
  ])('accepts audio recorded as %s', (type) => {
    const fields = { interviewId: INTERVIEW_ID, position: '1', audio: audio('audio', type) };

    expect(parseAnswerSubmission(formData(fields)).success).toBe(true);
  });

  it('accepts audio of the largest allowed size', () => {
    const fields = {
      interviewId: INTERVIEW_ID,
      position: '1',
      audio: audio('a'.repeat(MAX_AUDIO_BYTES)),
    };

    expect(parseAnswerSubmission(formData(fields)).success).toBe(true);
  });

  it.each<[string, Record<string, string | File>]>([
    ['no audio', { interviewId: INTERVIEW_ID, position: '1' }],
    ['audio sent as text', { interviewId: INTERVIEW_ID, position: '1', audio: 'audio' }],
    ['empty audio', { interviewId: INTERVIEW_ID, position: '1', audio: audio('') }],
    [
      'a file that isn’t audio',
      { interviewId: INTERVIEW_ID, position: '1', audio: audio('x', 'text/plain') },
    ],
    [
      'audio in a format the recorder never produces',
      { interviewId: INTERVIEW_ID, position: '1', audio: audio('x', 'audio/x-made-up') },
    ],
    [
      'audio that is too large',
      {
        interviewId: INTERVIEW_ID,
        position: '1',
        audio: audio('a'.repeat(MAX_AUDIO_BYTES + 1)),
      },
    ],
    ['no position', { interviewId: INTERVIEW_ID, audio: audio() }],
    ['position 0', { interviewId: INTERVIEW_ID, position: '0', audio: audio() }],
    ['a fractional position', { interviewId: INTERVIEW_ID, position: '1.5', audio: audio() }],
    ['no Interview', { position: '1', audio: audio() }],
  ])('rejects a submission with %s', (_case, fields) => {
    expect(parseAnswerSubmission(formData(fields)).success).toBe(false);
  });
});
