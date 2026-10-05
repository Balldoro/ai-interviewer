import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { QuestionAudio } from './question-audio';

const SRC = 'data:audio/mpeg;base64,c3BlZWNo';

const { logger } = vi.hoisted(() => ({ logger: { error: vi.fn() } }));

vi.mock('@/lib/logger', () => ({ logger }));

// jsdom can't play media, so playback is faked and records what each play started from.
const plays: { src: string; currentTime: number }[] = [];
const play = vi.fn(async function (this: HTMLMediaElement) {
  plays.push({ src: this.src, currentTime: this.currentTime });
});
const pause = vi.fn();

// Kept for the whole file, since components are unmounted after each test's own cleanup.
beforeAll(() => {
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(play);
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(pause);
});

afterAll(() => {
  vi.restoreAllMocks();
});

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  plays.length = 0;
  play.mockClear();
  pause.mockClear();
  logger.error.mockReset();
  vi.unstubAllGlobals();
});

describe('QuestionAudio', () => {
  it('plays the spoken Interview Question as soon as it is shown', () => {
    render(<QuestionAudio src={SRC} />);

    expect(plays).toEqual([{ src: SRC, currentTime: 0 }]);
  });

  it('replays the audio from the start without asking the server again', async () => {
    const user = userEvent.setup();
    render(<QuestionAudio src={SRC} />);
    // Part-way through the first play.
    play.mock.contexts[0].currentTime = 4;

    await user.click(screen.getByRole('button', { name: 'Replay question' }));

    expect(plays).toEqual([
      { src: SRC, currentTime: 0 },
      { src: SRC, currentTime: 0 },
    ]);
    expect(play.mock.contexts[1]).toBe(play.mock.contexts[0]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('keeps the replay control working when the browser blocks autoplay', async () => {
    play.mockRejectedValueOnce(new DOMException('Autoplay blocked', 'NotAllowedError'));
    const user = userEvent.setup();
    render(<QuestionAudio src={SRC} />);

    await user.click(screen.getByRole('button', { name: 'Replay question' }));

    expect(play).toHaveBeenCalledTimes(2);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('logs audio that can’t be played', async () => {
    const failure = new DOMException('Unsupported source', 'NotSupportedError');
    play.mockRejectedValueOnce(failure);

    render(<QuestionAudio src={SRC} />);

    await waitFor(() =>
      expect(logger.error).toHaveBeenCalledWith('Playing the Interview Question failed', failure),
    );
  });

  it('stops the audio when the Interview Question is no longer shown', () => {
    const { unmount } = render(<QuestionAudio src={SRC} />);

    unmount();

    expect(pause).toHaveBeenCalled();
  });
});
