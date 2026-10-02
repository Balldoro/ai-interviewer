import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { InterviewSetupForm } from '@/components/interview-setup-form';

function renderForm() {
  const onSubmitAction = vi.fn().mockResolvedValue(undefined);
  const user = userEvent.setup();
  render(<InterviewSetupForm onSubmitAction={onSubmitAction} />);
  return { onSubmitAction, user };
}

describe('InterviewSetupForm', () => {
  it('offers Junior, Mid and Senior as a labelled Seniority Level group with Mid preselected', () => {
    renderForm();

    const group = screen.getByRole('radiogroup', { name: 'Seniority Level' });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Seniority Level' })).toBeInTheDocument();

    expect(screen.getByRole('radio', { name: 'Junior' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Mid' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Senior' })).not.toBeChecked();
  });

  it('submits the default Interview Setup when nothing is changed', async () => {
    const { onSubmitAction, user } = renderForm();

    await user.click(screen.getByRole('button', { name: 'Start interview' }));

    await waitFor(() =>
      expect(onSubmitAction).toHaveBeenCalledExactlyOnceWith({
        seniorityLevel: 'mid',
        category: 'mixed',
        questionCount: 5,
      }),
    );
  });

  it('submits the chosen Seniority Level', async () => {
    const { onSubmitAction, user } = renderForm();

    await user.click(screen.getByRole('radio', { name: 'Senior' }));
    await user.click(screen.getByRole('button', { name: 'Start interview' }));

    expect(screen.getByRole('radio', { name: 'Senior' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Mid' })).not.toBeChecked();
    await waitFor(() =>
      expect(onSubmitAction).toHaveBeenCalledExactlyOnceWith({
        seniorityLevel: 'senior',
        category: 'mixed',
        questionCount: 5,
      }),
    );
  });

  it('allows only one Seniority Level at a time', async () => {
    const { user } = renderForm();

    await user.click(screen.getByRole('radio', { name: 'Junior' }));
    await user.click(screen.getByRole('radio', { name: 'Senior' }));

    expect(screen.getByRole('radio', { name: 'Junior' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Mid' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Senior' })).toBeChecked();
  });

  it('starts again from the defaults when mounted afresh, as on a reload', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<InterviewSetupForm onSubmitAction={vi.fn()} />);
    await user.click(screen.getByRole('radio', { name: 'Junior' }));
    unmount();

    render(<InterviewSetupForm onSubmitAction={vi.fn()} />);

    expect(screen.getByRole('radio', { name: 'Mid' })).toBeChecked();
  });
});
