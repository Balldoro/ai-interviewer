'use client';

import { MinusIcon, PlusIcon } from 'lucide-react';
import { useId } from 'react';

import { RadioFieldSet } from '@/components/radio-field-set';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldTitle } from '@/components/ui/field';
import { Slider } from '@/components/ui/slider/slider';
import {
  useInterviewSetupForm,
  type SubmitInterviewSetup,
} from '@/modules/setup/components/interview-setup-form/use-interview-setup-form';
import {
  CATEGORIES,
  INTERVIEW_SETUP_DEFAULTS,
  QUESTION_COUNT_MAX,
  QUESTION_COUNT_MIN,
  SENIORITY_LEVELS,
  type Category,
  type SeniorityLevel,
} from '@/modules/setup/lib/interview-setup';

const SENIORITY_LEVEL_LABELS: Record<SeniorityLevel, string> = {
  junior: 'Junior',
  mid: 'Mid',
  senior: 'Senior',
};

const CATEGORY_LABELS: Record<Category, string> = {
  javascript: 'JavaScript',
  react: 'React',
  typescript: 'TypeScript',
  mixed: 'Mixed',
};

type InterviewSetupFormProps = {
  onSubmitAction: SubmitInterviewSetup;
};

export function InterviewSetupForm({ onSubmitAction }: InterviewSetupFormProps) {
  const id = useId();

  const { questionCount, changeQuestionCount, errors, formAction, isPending } =
    useInterviewSetupForm(onSubmitAction);

  const questionCountLabelId = `${id}-question-count`;

  return (
    <form action={formAction} noValidate className="flex flex-col gap-6">
      <RadioFieldSet
        id={`${id}-seniority-level`}
        legend="Seniority Level"
        name="seniorityLevel"
        options={SENIORITY_LEVELS}
        labels={SENIORITY_LEVEL_LABELS}
        defaultValue={INTERVIEW_SETUP_DEFAULTS.seniorityLevel}
        error={errors.seniorityLevel}
        className="grid-cols-1 sm:grid-cols-3"
      />
      <RadioFieldSet
        id={`${id}-category`}
        legend="Category"
        name="category"
        options={CATEGORIES}
        labels={CATEGORY_LABELS}
        defaultValue={INTERVIEW_SETUP_DEFAULTS.category}
        error={errors.category}
        className="grid-cols-1 sm:grid-cols-2"
      />
      <Field
        aria-labelledby={questionCountLabelId}
        data-invalid={errors.questionCount ? true : undefined}
      >
        <div className="flex items-baseline justify-between gap-4">
          <FieldTitle id={questionCountLabelId}>Question Count</FieldTitle>
          <output aria-labelledby={questionCountLabelId} className="text-sm tabular-nums">
            {questionCount} questions
          </output>
        </div>
        <div className="flex items-end gap-2">
          <Slider
            aria-labelledby={questionCountLabelId}
            min={QUESTION_COUNT_MIN}
            max={QUESTION_COUNT_MAX}
            step={1}
            value={questionCount}
            onValueChange={(value) =>
              changeQuestionCount(typeof value === 'number' ? value : value[0])
            }
            thumbLabel={questionCount}
            // Inset so the balloon stays clear of the form edge and the − button at either end. The bottom padding
            // centres the 0.375rem track on the 2.25rem −/+ buttons, as the slider is taller than them.
            className="mr-4 ml-5 pb-[calc((2.25rem-0.375rem)/2)]"
          />
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            aria-label="Decrease Question Count"
            disabled={questionCount <= QUESTION_COUNT_MIN}
            onClick={() => changeQuestionCount(questionCount - 1)}
          >
            <MinusIcon aria-hidden />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            aria-label="Increase Question Count"
            disabled={questionCount >= QUESTION_COUNT_MAX}
            onClick={() => changeQuestionCount(questionCount + 1)}
          >
            <PlusIcon aria-hidden />
          </Button>
        </div>
        <input type="hidden" name="questionCount" value={questionCount} />
        <FieldError>{errors.questionCount}</FieldError>
      </Field>
      <Button type="submit" size="lg" disabled={isPending} className="self-stretch sm:self-center">
        Start interview
      </Button>
    </form>
  );
}
