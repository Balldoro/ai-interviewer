import { type ReactNode } from 'react';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { releaseMicrophone } from '../../lib/microphone';
import { getQuestionAudioPlayer } from '../../lib/question-audio-player';
import { InterviewContext } from '../interview-screen/interview-context';
import { AnswerRecorder } from './answer-recorder';

const INTERVIEW_ID = '00000000-0000-4000-8000-000000000001';
const NEXT_STEP = {
  type: 'question',
  position: 2,
  questionCount: 5,
  questionText: 'What is a closure?',
  questionAudio: 'data:audio/mpeg;base64,c3BlZWNo',
} as const;

const { submitAnswerAction } = vi.hoisted(() => ({ submitAnswerAction: vi.fn() }));

vi.mock('../../lib/actions', () => ({ submitAnswerAction }));

const onAnswered = vi.fn();
const onAnsweringChange = vi.fn();
const track = { stop: vi.fn() };
const stream = { active: true, getTracks: () => [track] };
const getUserMedia = vi.fn<MediaDevices['getUserMedia']>();

// Each recording produces one chunk holding the take number, so tests can tell recordings apart.
let takes = 0;

class FakeMediaRecorder extends EventTarget {
  static isTypeSupported = (type: string) => type === 'audio/webm;codecs=opus';

  readonly mimeType: string;
  readonly stream: MediaStream;
  state: RecordingState = 'inactive';

  constructor(recordedStream: MediaStream, options?: MediaRecorderOptions) {
    super();
    this.stream = recordedStream;
    this.mimeType = options?.mimeType ?? '';
  }

  start() {
    this.state = 'recording';
    takes++;
  }

  stop() {
    this.state = 'inactive';
    const data = new Blob([`take ${takes}`], { type: this.mimeType });
    this.dispatchEvent(Object.assign(new Event('dataavailable'), { data }));
    this.dispatchEvent(new Event('stop'));
  }
}

beforeEach(() => {
  takes = 0;
  stream.active = true;
  getUserMedia.mockResolvedValue(stream as unknown as MediaStream);
  submitAnswerAction.mockResolvedValue({ nextStep: NEXT_STEP });
  vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia },
    configurable: true,
  });
});

afterEach(async () => {
  // The microphone outlives the recorder, so it's released here rather than by unmounting.
  await releaseMicrophone();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'mediaDevices');
  getUserMedia.mockReset();
  submitAnswerAction.mockReset();
  onAnswered.mockReset();
  onAnsweringChange.mockReset();
  track.stop.mockReset();
  vi.restoreAllMocks();
});

// AnswerRecorder answers whichever Interview Question InterviewScreen puts on screen.
function FirstQuestion({ children }: { children: ReactNode }) {
  return (
    <InterviewContext
      value={{ interviewId: INTERVIEW_ID, position: 1, onAnswered, onAnsweringChange }}
    >
      {children}
    </InterviewContext>
  );
}

function renderRecorder() {
  const user = userEvent.setup();
  render(<AnswerRecorder />, { wrapper: FirstQuestion });
  return { user };
}

// For tests that use fake timers, so that user-event's delays advance them.
function renderRecorderWithFakeTimers() {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  render(<AnswerRecorder />, { wrapper: FirstQuestion });
  return { user };
}

function advanceSeconds(seconds: number) {
  act(() => vi.advanceTimersByTime(seconds * 1000));
}

async function record(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Start recording' }));
  await user.click(await screen.findByRole('button', { name: 'Stop recording' }));
}

async function discard(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Discard recording' }));
  const dialog = await screen.findByRole('alertdialog', { name: 'Discard this recording?' });
  await user.click(within(dialog).getByRole('button', { name: 'Discard' }));
  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
}

async function submittedFields() {
  await waitFor(() => expect(submitAnswerAction).toHaveBeenCalledOnce());
  const formData: FormData = submitAnswerAction.mock.calls[0][0];
  const audio = formData.get('audio') as File;
  return {
    interviewId: formData.get('interviewId'),
    position: formData.get('position'),
    audio: { name: audio.name, type: audio.type, text: await audio.text() },
  };
}

describe('AnswerRecorder', () => {
  it('starts recording from the microphone and stops it, keeping the microphone open', async () => {
    const { user } = renderRecorder();

    await user.click(screen.getByRole('button', { name: 'Start recording' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Recording…');

    await user.click(screen.getByRole('button', { name: 'Stop recording' }));

    expect(screen.getByRole('status')).toHaveTextContent('Your answer is recorded.');
    // Safari cuts the speakers for a moment a few seconds after a microphone is released, which is
    // when the next Question Audio plays.
    expect(track.stop).not.toHaveBeenCalled();
  });

  it('records again from the microphone that is already open', async () => {
    const { user } = renderRecorder();

    await record(user);
    await discard(user);
    await record(user);

    expect(getUserMedia).toHaveBeenCalledOnce();
  });

  it('asks for the microphone again when the open one has stopped working', async () => {
    const { user } = renderRecorder();

    await record(user);
    await discard(user);
    // E.g. the microphone was unplugged.
    stream.active = false;
    await record(user);

    expect(getUserMedia).toHaveBeenCalledTimes(2);
  });

  it('records from the microphone with the browser’s default processing', async () => {
    const { user } = renderRecorder();

    await user.click(screen.getByRole('button', { name: 'Start recording' }));

    expect(getUserMedia).toHaveBeenCalledExactlyOnceWith({ audio: true });
  });

  it('stops the Question Audio when recording starts', async () => {
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    const { user } = renderRecorder();

    await user.click(screen.getByRole('button', { name: 'Start recording' }));

    expect(pause.mock.contexts).toContain(getQuestionAudioPlayer());
  });

  it('waits for microphone access without letting the User start a second recording', async () => {
    const { promise, resolve } = Promise.withResolvers<MediaStream>();
    getUserMedia.mockReturnValue(promise);
    const { user } = renderRecorder();
    const start = screen.getByRole('button', { name: 'Start recording' });

    await user.click(start);

    expect(screen.getByRole('status')).toHaveTextContent('Waiting for microphone access…');
    expect(start).toBeDisabled();

    await user.click(start);
    expect(getUserMedia).toHaveBeenCalledOnce();

    resolve(stream as unknown as MediaStream);
    expect(await screen.findByRole('button', { name: 'Stop recording' })).toBeEnabled();
  });

  it('allows submitting only once there is a recording', async () => {
    const { user } = renderRecorder();
    const submit = screen.getByRole('button', { name: 'Submit answer' });

    expect(submit).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Start recording' }));
    await screen.findByRole('button', { name: 'Stop recording' });
    expect(submit).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Stop recording' }));
    expect(submit).toBeEnabled();
  });

  it('sends the recording and the position, and passes on the step that follows', async () => {
    const { user } = renderRecorder();

    await record(user);
    await user.click(screen.getByRole('button', { name: 'Submit answer' }));

    expect(await submittedFields()).toEqual({
      interviewId: INTERVIEW_ID,
      position: '1',
      audio: { name: 'answer.webm', type: 'audio/webm;codecs=opus', text: 'take 1' },
    });
    await waitFor(() => expect(onAnswered).toHaveBeenCalledExactlyOnceWith(NEXT_STEP));
    expect(screen.getByRole('button', { name: 'Submit answer' })).toBeDisabled();
  });

  it('discards a recording and sends the one recorded again instead', async () => {
    const { user } = renderRecorder();

    await record(user);
    await discard(user);

    expect(screen.getByRole('button', { name: 'Submit answer' })).toBeDisabled();

    await record(user);
    await user.click(screen.getByRole('button', { name: 'Submit answer' }));

    expect((await submittedFields()).audio.text).toBe('take 2');
  });

  it('keeps the recording when the User changes their mind about discarding it', async () => {
    const { user } = renderRecorder();

    await record(user);
    await user.click(screen.getByRole('button', { name: 'Discard recording' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Discard this recording?' });
    await user.click(within(dialog).getByRole('button', { name: 'Keep recording' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(screen.getByRole('status')).toHaveTextContent('Your answer is recorded.');

    await user.click(screen.getByRole('button', { name: 'Submit answer' }));
    expect((await submittedFields()).audio.text).toBe('take 1');
  });

  describe('with fake timers', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('shows how long the User has been recording against the limit', async () => {
      const { user } = renderRecorderWithFakeTimers();

      expect(screen.queryByRole('timer')).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Start recording' }));
      const timer = await screen.findByRole('timer', { name: 'Recording time' });
      expect(timer).toHaveTextContent('0:00 / 3:00');

      advanceSeconds(84);
      expect(timer).toHaveTextContent('1:24 / 3:00');
      const [elapsed, limit] = within(timer).getAllByRole('time');
      expect(elapsed).toHaveAttribute('datetime', 'PT1M24S');
      expect(limit).toHaveAttribute('datetime', 'PT3M0S');

      await user.click(screen.getByRole('button', { name: 'Stop recording' }));
      expect(screen.queryByRole('timer')).not.toBeInTheDocument();
    });

    it('stops recording at the limit, and the recording can be submitted', async () => {
      const { user } = renderRecorderWithFakeTimers();

      await user.click(screen.getByRole('button', { name: 'Start recording' }));
      const timer = await screen.findByRole('timer');

      advanceSeconds(179);
      expect(timer).toHaveTextContent('2:59 / 3:00');
      expect(screen.getByRole('button', { name: 'Stop recording' })).toBeInTheDocument();

      advanceSeconds(1);
      expect(screen.queryByRole('timer')).not.toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent('Your answer is recorded.');

      await user.click(screen.getByRole('button', { name: 'Submit answer' }));
      expect((await submittedFields()).audio.text).toBe('take 1');
    });

    it('lets the User record again after the limit, counting from zero', async () => {
      const { user } = renderRecorderWithFakeTimers();

      await user.click(screen.getByRole('button', { name: 'Start recording' }));
      await screen.findByRole('timer');
      advanceSeconds(180);

      await discard(user);
      await user.click(screen.getByRole('button', { name: 'Start recording' }));

      expect(await screen.findByRole('timer')).toHaveTextContent('0:00 / 3:00');
      advanceSeconds(5);
      expect(screen.getByRole('timer')).toHaveTextContent('0:05 / 3:00');

      await user.click(screen.getByRole('button', { name: 'Stop recording' }));
      await user.click(screen.getByRole('button', { name: 'Submit answer' }));
      expect((await submittedFields()).audio.text).toBe('take 2');
    });
  });

  it('disables submitting while the Answer is being sent', async () => {
    const { promise, resolve } = Promise.withResolvers<{ nextStep: typeof NEXT_STEP }>();
    submitAnswerAction.mockReturnValue(promise);
    const { user } = renderRecorder();
    const submit = screen.getByRole('button', { name: 'Submit answer' });

    await record(user);
    await user.click(submit);
    await waitFor(() => expect(submit).toBeDisabled());
    expect(screen.getByRole('button', { name: 'Discard recording' })).toBeDisabled();

    resolve({ nextStep: NEXT_STEP });
    await waitFor(() => expect(onAnswered).toHaveBeenCalledOnce());
    // Until the next step replaces the recorder.
    expect(submit).toBeDisabled();
  });

  it('shows why the server rejected the Answer and lets the User try again', async () => {
    submitAnswerAction.mockResolvedValue({ error: 'This interview is no longer in progress.' });
    const { user } = renderRecorder();

    await record(user);
    await user.click(screen.getByRole('button', { name: 'Submit answer' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This interview is no longer in progress.',
    );
    expect(screen.getByRole('button', { name: 'Submit answer' })).toBeEnabled();
    expect(onAnswered).not.toHaveBeenCalled();
  });

  it('lets the User try again when the Answer could not reach the server', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    submitAnswerAction.mockRejectedValueOnce(new Error('Network error'));
    const { user } = renderRecorder();

    await record(user);
    await user.click(screen.getByRole('button', { name: 'Submit answer' }));

    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't send your answer.");
    expect(screen.getByRole('button', { name: 'Submit answer' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Discard recording' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Submit answer' }));

    await waitFor(() => expect(onAnswered).toHaveBeenCalledOnce());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('asks the User to record again when they couldn’t be heard, and sends the new recording', async () => {
    submitAnswerAction.mockResolvedValueOnce({
      error: "We couldn't hear you. Please record your answer again.",
    });
    const { user } = renderRecorder();

    await record(user);
    await user.click(screen.getByRole('button', { name: 'Submit answer' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "We couldn't hear you. Please record your answer again.",
    );
    expect(onAnswered).not.toHaveBeenCalled();

    await discard(user);
    await record(user);
    submitAnswerAction.mockClear();
    await user.click(screen.getByRole('button', { name: 'Submit answer' }));

    expect((await submittedFields()).audio.text).toBe('take 2');
    await waitFor(() => expect(onAnswered).toHaveBeenCalledOnce());
  });

  it('clears the error of a failed submission when its recording is discarded', async () => {
    submitAnswerAction.mockResolvedValue({ error: 'This interview is no longer in progress.' });
    const { user } = renderRecorder();

    await record(user);
    await user.click(screen.getByRole('button', { name: 'Submit answer' }));
    await screen.findByRole('alert');

    await discard(user);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start recording' })).toBeEnabled();
  });

  it('says so when microphone access is denied', async () => {
    getUserMedia.mockRejectedValue(new DOMException('Permission denied', 'NotAllowedError'));
    const { user } = renderRecorder();

    await user.click(screen.getByRole('button', { name: 'Start recording' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Microphone access was denied.');
    expect(screen.getByRole('button', { name: 'Start recording' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Submit answer' })).toBeDisabled();
  });

  it('says so when there is no microphone', async () => {
    getUserMedia.mockRejectedValue(new DOMException('Requested device not found', 'NotFoundError'));
    const { user } = renderRecorder();

    await user.click(screen.getByRole('button', { name: 'Start recording' }));

    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't use your microphone.");
  });

  it('says so when the browser cannot record audio', async () => {
    vi.stubGlobal('MediaRecorder', undefined);
    const { user } = renderRecorder();

    await user.click(screen.getByRole('button', { name: 'Start recording' }));

    expect(await screen.findByRole('alert')).toHaveTextContent("This browser can't record audio.");
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it('says so when the browser fails to start recording, and releases the microphone', async () => {
    vi.stubGlobal(
      'MediaRecorder',
      class extends FakeMediaRecorder {
        start() {
          throw new DOMException('Unsupported configuration', 'NotSupportedError');
        }
      },
    );
    const { user } = renderRecorder();

    await user.click(screen.getByRole('button', { name: 'Start recording' }));

    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't use your microphone.");
    await waitFor(() => expect(track.stop).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: 'Start recording' })).toBeEnabled();
  });

  it('asks the User to record again when no audio was captured', async () => {
    vi.stubGlobal(
      'MediaRecorder',
      class extends FakeMediaRecorder {
        stop() {
          this.state = 'inactive';
          this.dispatchEvent(new Event('stop'));
        }
      },
    );
    const { user } = renderRecorder();

    await record(user);

    expect(await screen.findByRole('alert')).toHaveTextContent("We didn't capture any audio.");
    expect(screen.getByRole('button', { name: 'Submit answer' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Start recording' })).toBeEnabled();
  });

  // Releasing the microphone is up to the Interview (see InterviewScreen).
  it('stops recording when left mid-recording', async () => {
    const stop = vi.spyOn(FakeMediaRecorder.prototype, 'stop');
    const user = userEvent.setup();
    const { unmount } = render(<AnswerRecorder />, {
      wrapper: FirstQuestion,
    });

    await user.click(screen.getByRole('button', { name: 'Start recording' }));
    await screen.findByRole('button', { name: 'Stop recording' });

    unmount();

    expect(stop).toHaveBeenCalledOnce();
  });

  it('doesn’t start recording when left before microphone access was granted', async () => {
    const { promise, resolve } = Promise.withResolvers<MediaStream>();
    getUserMedia.mockReturnValue(promise);
    const user = userEvent.setup();
    const { unmount } = render(<AnswerRecorder />, {
      wrapper: FirstQuestion,
    });

    await user.click(screen.getByRole('button', { name: 'Start recording' }));
    unmount();
    resolve(stream as unknown as MediaStream);
    await promise;

    expect(takes).toBe(0);
  });
});
