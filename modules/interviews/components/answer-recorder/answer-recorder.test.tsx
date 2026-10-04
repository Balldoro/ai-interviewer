import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AnswerRecorder } from './answer-recorder';

const INTERVIEW_ID = '00000000-0000-4000-8000-000000000001';

const { submitAnswerAction } = vi.hoisted(() => ({ submitAnswerAction: vi.fn() }));

vi.mock('../../lib/actions', () => ({ submitAnswerAction }));

const track = { stop: vi.fn() };
const stream = { getTracks: () => [track] } as unknown as MediaStream;
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
  getUserMedia.mockResolvedValue(stream);
  submitAnswerAction.mockResolvedValue({ received: true });
  vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia },
    configurable: true,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'mediaDevices');
  getUserMedia.mockReset();
  submitAnswerAction.mockReset();
  track.stop.mockReset();
  vi.restoreAllMocks();
});

function renderRecorder() {
  const user = userEvent.setup();
  render(<AnswerRecorder interviewId={INTERVIEW_ID} position={1} />);
  return { user };
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
  it('starts recording from the microphone and stops it', async () => {
    const { user } = renderRecorder();

    await user.click(screen.getByRole('button', { name: 'Start recording' }));

    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(await screen.findByRole('status')).toHaveTextContent('Recording…');

    await user.click(screen.getByRole('button', { name: 'Stop recording' }));

    expect(screen.getByRole('status')).toHaveTextContent('Your answer is recorded.');
    expect(track.stop).toHaveBeenCalled();
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

    resolve(stream);
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

  it('sends the recording and the position, and shows it was received', async () => {
    const { user } = renderRecorder();

    await record(user);
    await user.click(screen.getByRole('button', { name: 'Submit answer' }));

    expect(await submittedFields()).toEqual({
      interviewId: INTERVIEW_ID,
      position: '1',
      audio: { name: 'answer.webm', type: 'audio/webm;codecs=opus', text: 'take 1' },
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Your answer was sent.');
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

  it('disables submitting while the Answer is being sent', async () => {
    const { promise, resolve } = Promise.withResolvers<{ received: true }>();
    submitAnswerAction.mockReturnValue(promise);
    const { user } = renderRecorder();
    const submit = screen.getByRole('button', { name: 'Submit answer' });

    await record(user);
    await user.click(submit);
    await waitFor(() => expect(submit).toBeDisabled());
    expect(screen.getByRole('button', { name: 'Discard recording' })).toBeDisabled();

    resolve({ received: true });
    expect(await screen.findByRole('status')).toHaveTextContent('Your answer was sent.');
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

    expect(await screen.findByRole('status')).toHaveTextContent('Your answer was sent.');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
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
    expect(track.stop).toHaveBeenCalled();
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

  it('releases the microphone when left mid-recording', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<AnswerRecorder interviewId={INTERVIEW_ID} position={1} />);

    await user.click(screen.getByRole('button', { name: 'Start recording' }));
    await screen.findByRole('button', { name: 'Stop recording' });
    expect(track.stop).not.toHaveBeenCalled();

    unmount();

    expect(track.stop).toHaveBeenCalled();
  });

  it('releases the microphone when left before access was granted', async () => {
    const { promise, resolve } = Promise.withResolvers<MediaStream>();
    getUserMedia.mockReturnValue(promise);
    const user = userEvent.setup();
    const { unmount } = render(<AnswerRecorder interviewId={INTERVIEW_ID} position={1} />);

    await user.click(screen.getByRole('button', { name: 'Start recording' }));
    unmount();
    resolve(stream);

    await waitFor(() => expect(track.stop).toHaveBeenCalled());
    expect(takes).toBe(0);
  });
});
