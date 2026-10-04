import { formatSecondsAsMinutesAndSeconds, secondsToIsoDuration } from '@/lib/time';

import { useRecordingTimer } from './use-recording-timer';

interface RecordingTimerProps {
  maxSeconds: number;
  onLimitReach: () => void;
}

export function RecordingTimer({ maxSeconds, onLimitReach }: RecordingTimerProps) {
  const { elapsedSeconds } = useRecordingTimer({ maxSeconds, onLimitReach });

  return (
    <div role="timer" aria-label="Recording time" className="text-sm tabular-nums">
      <time dateTime={secondsToIsoDuration(elapsedSeconds)}>
        {formatSecondsAsMinutesAndSeconds(elapsedSeconds)}
      </time>
      {' / '}
      <time dateTime={secondsToIsoDuration(maxSeconds)}>
        {formatSecondsAsMinutesAndSeconds(maxSeconds)}
      </time>
    </div>
  );
}
