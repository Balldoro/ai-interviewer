import { MicIcon, SquareIcon, Trash2Icon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { AudioRecorderStatus } from '../../lib/types';

function contentFor(status: AudioRecorderStatus) {
  if (status === 'recording') return { Icon: SquareIcon, label: 'Stop recording' };
  if (status === 'recorded') return { Icon: Trash2Icon, label: 'Discard recording' };
  return { Icon: MicIcon, label: 'Start recording' };
}

interface RecordingButtonProps {
  status: AudioRecorderStatus;
  disabled: boolean;
  onClick: () => void;
}

export function RecordingButton({ status, disabled, onClick }: RecordingButtonProps) {
  const { Icon, label } = contentFor(status);

  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      disabled={disabled || status === 'starting'}
      onClick={onClick}
    >
      <Icon aria-hidden />
      {label}
    </Button>
  );
}
