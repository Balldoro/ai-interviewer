'use client';

import { useActionState, useId } from 'react';

import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  INTERVIEW_SETUP_DEFAULTS,
  SENIORITY_LEVELS,
  interviewSetupSchema,
  type InterviewSetup,
  type SeniorityLevel,
} from '@/lib/interview-setup';

const SENIORITY_LEVEL_LABELS: Record<SeniorityLevel, string> = {
  junior: 'Junior',
  mid: 'Mid',
  senior: 'Senior',
};

type InterviewSetupFormProps = {
  onSubmitAction: (setup: InterviewSetup) => Promise<void>;
};

export function InterviewSetupForm({ onSubmitAction }: InterviewSetupFormProps) {
  const id = useId();
  const [error, formAction, isPending] = useActionState(
    async (_previousError: string | undefined, formData: FormData) => {
      // Category and Question Count have no controls yet, so the schema fills in their defaults.
      const result = interviewSetupSchema.safeParse({
        seniorityLevel: formData.get('seniorityLevel'),
      });
      if (!result.success) {
        return 'Choose a Seniority Level.';
      }

      await onSubmitAction(result.data);
      return undefined;
    },
    undefined,
  );

  const legendId = `${id}-seniority-level`;

  return (
    <form action={formAction} noValidate className="flex flex-col gap-6">
      <FieldSet data-invalid={error ? true : undefined}>
        <FieldLegend id={legendId}>Seniority Level</FieldLegend>
        <RadioGroup
          aria-labelledby={legendId}
          name="seniorityLevel"
          defaultValue={INTERVIEW_SETUP_DEFAULTS.seniorityLevel}
          className="grid-cols-1 sm:grid-cols-3"
        >
          {SENIORITY_LEVELS.map((level) => {
            const itemId = `${legendId}-${level}`;
            return (
              <FieldLabel key={level} htmlFor={itemId}>
                <Field orientation="horizontal">
                  <RadioGroupItem id={itemId} value={level} />
                  {SENIORITY_LEVEL_LABELS[level]}
                </Field>
              </FieldLabel>
            );
          })}
        </RadioGroup>
        <FieldError>{error}</FieldError>
      </FieldSet>
      <Button type="submit" size="lg" disabled={isPending} className="self-stretch sm:self-start">
        Start interview
      </Button>
    </form>
  );
}
