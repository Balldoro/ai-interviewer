'use client';

import { Volume2Icon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useQuestionAudio } from './use-question-audio';

interface QuestionAudioProps {
  // The Question Text spoken by the AI interviewer.
  src: string;
  disabled?: boolean;
}

export function QuestionAudio({ src, disabled }: QuestionAudioProps) {
  const { isBlocked, replay } = useQuestionAudio(src);

  return (
    <Button
      type="button"
      variant={isBlocked ? 'default' : 'outline'}
      className="self-start"
      disabled={disabled}
      onClick={replay}
    >
      <Volume2Icon aria-hidden />
      {isBlocked ? 'Play question' : 'Replay question'}
    </Button>
  );
}
