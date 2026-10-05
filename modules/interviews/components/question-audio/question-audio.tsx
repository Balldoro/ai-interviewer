'use client';

import { Volume2Icon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useQuestionAudio } from './use-question-audio';

interface QuestionAudioProps {
  // The Question Text spoken by the AI interviewer.
  src: string;
}

export function QuestionAudio({ src }: QuestionAudioProps) {
  const { replay } = useQuestionAudio(src);

  return (
    <Button type="button" variant="outline" className="self-start" onClick={replay}>
      <Volume2Icon aria-hidden />
      Replay question
    </Button>
  );
}
