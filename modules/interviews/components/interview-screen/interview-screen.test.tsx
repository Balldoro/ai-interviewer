import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { releaseMicrophone } from '../../lib/microphone';
import type { InterviewStep } from '../../lib/types';
import { InterviewScreen } from './interview-screen';

const INTERVIEW_ID = '00000000-0000-4000-8000-000000000001';

const { submitAnswerAction } = vi.hoisted(() => ({ submitAnswerAction: vi.fn() }));

vi.mock('../../lib/actions', () => ({ submitAnswerAction }));

class FakeMediaRecorder extends EventTarget {
  static isTypeSupported = () => true;

  readonly mimeType = 'audio/webm;codecs=opus';
  state: RecordingState = 'inactive';

  start() {
    this.state = 'recording';
  }

  stop() {
    this.state = 'inactive';
    const data = new Blob(['audio'], { type: this.mimeType });
    this.dispatchEvent(Object.assign(new Event('dataavailable'), { data }));
    this.dispatchEvent(new Event('stop'));
  }
}

function question(
  position: number,
  questionText = `Question text ${position}`,
): Extract<InterviewStep, { type: 'question' }> {
  return {
    type: 'question',
    position,
    questionCount: 5,
    questionText,
    questionAudio: `data:audio/mpeg;base64,${btoa(questionText)}`,
  };
}

// jsdom can't play media, so playback is faked and records what each play started from.
const playedSources: string[] = [];

const track = { stop: vi.fn() };
const getUserMedia = vi.fn<MediaDevices['getUserMedia']>();

beforeEach(() => {
  getUserMedia.mockResolvedValue({
    active: true,
    getTracks: () => [track],
  } as unknown as MediaStream);
  vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia },
    configurable: true,
  });
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(async function (
    this: HTMLMediaElement,
  ) {
    playedSources.push(this.src);
  });
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
});

afterEach(async () => {
  await releaseMicrophone();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'mediaDevices');
  getUserMedia.mockReset();
  track.stop.mockReset();
  submitAnswerAction.mockReset();
  playedSources.length = 0;
  vi.restoreAllMocks();
});

function renderScreen(initialStep: InterviewStep) {
  const user = userEvent.setup();
  render(<InterviewScreen interviewId={INTERVIEW_ID} initialStep={initialStep} />);
  return { user };
}

async function answer(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Start recording' }));
  await user.click(await screen.findByRole('button', { name: 'Stop recording' }));
  await user.click(screen.getByRole('button', { name: 'Submit answer' }));
}

describe('InterviewScreen', () => {
  it('shows the Interview Question and its position out of the Question Count', () => {
    renderScreen(question(1));

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Question text 1');
    expect(screen.getByText('Question 1 of 5')).toBeInTheDocument();
  });

  it('moves on to the next Interview Question once the Answer is stored', async () => {
    submitAnswerAction.mockResolvedValue({ nextStep: question(2) });
    const { user } = renderScreen(question(1));

    await answer(user);

    expect(await screen.findByRole('heading', { name: 'Question text 2' })).toBeInTheDocument();
    expect(screen.getByText('Question 2 of 5')).toBeInTheDocument();
    expect(screen.queryByText('Question text 1')).not.toBeInTheDocument();
    // A fresh recorder for the new Interview Question.
    expect(screen.getByRole('button', { name: 'Start recording' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Submit answer' })).toBeDisabled();

    submitAnswerAction.mockResolvedValue({ nextStep: question(3) });
    await answer(user);

    expect(await screen.findByRole('heading', { name: 'Question text 3' })).toBeInTheDocument();
    expect(submitAnswerAction.mock.calls[1][0].get('position')).toBe('2');
  });

  it('plays each Interview Question’s audio as it is shown', async () => {
    submitAnswerAction.mockResolvedValue({ nextStep: question(2) });
    const { user } = renderScreen(question(1));

    expect(playedSources).toEqual([question(1).questionAudio]);

    await answer(user);
    await screen.findByRole('heading', { name: 'Question text 2' });

    expect(playedSources).toEqual([question(1).questionAudio, question(2).questionAudio]);
  });

  it('plays the next Interview Question’s audio even when its Question Text is the same', async () => {
    submitAnswerAction.mockResolvedValue({ nextStep: question(2, 'Same text') });
    const { user } = renderScreen(question(1, 'Same text'));

    await answer(user);
    await screen.findByText('Question 2 of 5');

    expect(playedSources).toHaveLength(2);
  });

  it('shows the next Interview Question without a play control when it has no audio', async () => {
    submitAnswerAction.mockResolvedValue({ nextStep: { ...question(2), questionAudio: null } });
    const { user } = renderScreen(question(1));

    await answer(user);
    await screen.findByRole('heading', { name: 'Question text 2' });

    expect(screen.queryByRole('button', { name: /question/i })).not.toBeInTheDocument();
  });

  it('shows that the Interview is complete after the last Answer', async () => {
    submitAnswerAction.mockResolvedValue({ nextStep: { type: 'completed' } });
    const { user } = renderScreen(question(5));

    await answer(user);

    expect(await screen.findByRole('heading', { name: 'Interview complete' })).toBeInTheDocument();
    expect(screen.queryByText('Question text 5')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit answer' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start another interview' })).toHaveAttribute(
      'href',
      '/',
    );
  });

  it('shows that a completed Interview is complete', () => {
    renderScreen({ type: 'completed' });

    expect(screen.getByRole('heading', { name: 'Interview complete' })).toBeInTheDocument();
  });

  it('announces the next Interview Question to screen readers', async () => {
    submitAnswerAction.mockResolvedValue({ nextStep: question(2) });
    const { user } = renderScreen(question(1));
    const heading = screen.getByRole('heading', { level: 1 });

    await answer(user);
    await screen.findByRole('heading', { name: 'Question text 2' });

    // The same live region, so the change is announced, rather than a new one that isn't.
    expect(screen.getByRole('heading', { level: 1 })).toBe(heading);
    expect(heading).toHaveAttribute('aria-live', 'polite');
  });

  it('puts focus on the first control of the next Interview Question', async () => {
    submitAnswerAction.mockResolvedValue({ nextStep: question(2) });
    const { user } = renderScreen(question(1));

    expect(document.body).toHaveFocus();

    await answer(user);
    await screen.findByRole('heading', { name: 'Question text 2' });

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Replay question' })).toHaveFocus(),
    );
  });

  it('puts focus on starting another interview once the Interview is complete', async () => {
    submitAnswerAction.mockResolvedValue({ nextStep: { type: 'completed' } });
    const { user } = renderScreen(question(5));

    await answer(user);

    const link = await screen.findByRole('link', { name: 'Start another interview' });
    await waitFor(() => expect(link).toHaveFocus());
    expect(link).toHaveAccessibleDescription("Interview complete You've answered every question.");
  });

  it('doesn’t let the Interview Question be replayed while the Answer is recorded and sent', async () => {
    const { promise, resolve } = Promise.withResolvers<{ nextStep: InterviewStep }>();
    submitAnswerAction.mockReturnValue(promise);
    const { user } = renderScreen(question(1));
    const replay = screen.getByRole('button', { name: 'Replay question' });

    await user.click(screen.getByRole('button', { name: 'Start recording' }));
    await screen.findByRole('button', { name: 'Stop recording' });

    expect(replay).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Stop recording' }));

    expect(replay).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Submit answer' }));

    await waitFor(() => expect(replay).toBeDisabled());

    resolve({ nextStep: question(2) });

    await screen.findByRole('heading', { name: 'Question text 2' });
    expect(screen.getByRole('button', { name: 'Replay question' })).toBeEnabled();
  });

  it('stays on the Interview Question when the answer couldn’t be sent', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    submitAnswerAction.mockRejectedValue(new Error('Network error'));
    const { user } = renderScreen(question(1));

    await answer(user);

    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't send your answer.");
    expect(screen.getByRole('heading', { name: 'Question text 1' })).toBeInTheDocument();
  });

  it('stays on the Interview Question when the User couldn’t be heard', async () => {
    submitAnswerAction.mockResolvedValue({
      error: "We couldn't hear you. Please record your answer again.",
    });
    const { user } = renderScreen(question(1));

    await answer(user);

    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't hear you.");
    expect(screen.getByRole('heading', { name: 'Question text 1' })).toBeInTheDocument();
    expect(screen.getByText('Question 1 of 5')).toBeInTheDocument();
  });

  // Safari cuts the speakers for a moment a few seconds after a microphone is released, which would
  // be while the next Question Audio plays.
  it('keeps the microphone open from one Interview Question to the next', async () => {
    submitAnswerAction.mockResolvedValue({ nextStep: question(2) });
    const { user } = renderScreen(question(1));

    await answer(user);
    await screen.findByRole('heading', { name: 'Question text 2' });
    await user.click(screen.getByRole('button', { name: 'Start recording' }));
    await screen.findByRole('button', { name: 'Stop recording' });

    expect(getUserMedia).toHaveBeenCalledOnce();
    expect(track.stop).not.toHaveBeenCalled();
  });

  it('releases the microphone once the Interview is complete', async () => {
    submitAnswerAction.mockResolvedValue({ nextStep: { type: 'completed' } });
    const { user } = renderScreen(question(5));

    await answer(user);
    await screen.findByRole('heading', { name: 'Interview complete' });

    await waitFor(() => expect(track.stop).toHaveBeenCalled());
  });

  it('releases the microphone when the Interview is left', async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <InterviewScreen interviewId={INTERVIEW_ID} initialStep={question(1)} />,
    );

    await user.click(screen.getByRole('button', { name: 'Start recording' }));
    await screen.findByRole('button', { name: 'Stop recording' });
    unmount();

    await waitFor(() => expect(track.stop).toHaveBeenCalled());
  });

  it('releases the microphone when access is granted after the Interview was left', async () => {
    const { promise, resolve } = Promise.withResolvers<MediaStream>();
    getUserMedia.mockReturnValue(promise);
    const user = userEvent.setup();
    const { unmount } = render(
      <InterviewScreen interviewId={INTERVIEW_ID} initialStep={question(1)} />,
    );

    await user.click(screen.getByRole('button', { name: 'Start recording' }));
    unmount();
    resolve({ active: true, getTracks: () => [track] } as unknown as MediaStream);

    await waitFor(() => expect(track.stop).toHaveBeenCalled());
  });
});
