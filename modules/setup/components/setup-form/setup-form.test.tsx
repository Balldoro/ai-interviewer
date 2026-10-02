import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { SetupForm } from './setup-form';

function renderForm() {
  const onSubmitAction = vi.fn().mockResolvedValue(undefined);
  const user = userEvent.setup();
  render(<SetupForm onSubmitAction={onSubmitAction} />);
  return { onSubmitAction, user };
}

// The form hands its raw FormData to the action, which parses it on the server.
async function expectSubmitted(onSubmitAction: Mock, fields: Record<string, string>) {
  await waitFor(() => expect(onSubmitAction).toHaveBeenCalledOnce());
  expect(Object.fromEntries(onSubmitAction.mock.calls[0][0])).toEqual(fields);
}

// Base UI hides the slider thumb until it has measured a non-zero layout, which jsdom never has.
beforeEach(() => {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 200, 20));
});

afterEach(() => {
  vi.restoreAllMocks();
});

// The value bubble that trails the slider thumb is aria-hidden; the slider itself announces its value.
function getThumbLabel() {
  return document.querySelector('[data-slot="slider-thumb-label"]');
}

describe('SetupForm', () => {
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

    await expectSubmitted(onSubmitAction, {
      seniorityLevel: 'mid',
      category: 'mixed',
      questionCount: '5',
    });
  });

  it('submits the chosen Seniority Level', async () => {
    const { onSubmitAction, user } = renderForm();

    await user.click(screen.getByRole('radio', { name: 'Senior' }));
    await user.click(screen.getByRole('button', { name: 'Start interview' }));

    expect(screen.getByRole('radio', { name: 'Senior' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Mid' })).not.toBeChecked();
    await expectSubmitted(onSubmitAction, {
      seniorityLevel: 'senior',
      category: 'mixed',
      questionCount: '5',
    });
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
    const { unmount } = render(<SetupForm onSubmitAction={vi.fn()} />);
    await user.click(screen.getByRole('radio', { name: 'Junior' }));
    unmount();

    render(<SetupForm onSubmitAction={vi.fn()} />);

    expect(screen.getByRole('radio', { name: 'Mid' })).toBeChecked();
  });

  it('offers JavaScript, React, TypeScript and Mixed as a labelled Category group with Mixed preselected', () => {
    renderForm();

    expect(screen.getByRole('radiogroup', { name: 'Category' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Category' })).toBeInTheDocument();

    expect(screen.getByRole('radio', { name: 'JavaScript' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'React' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'TypeScript' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Mixed' })).toBeChecked();
    expect(screen.queryByRole('radio', { name: /random/i })).not.toBeInTheDocument();
  });

  it('submits the chosen Category', async () => {
    const { onSubmitAction, user } = renderForm();

    await user.click(screen.getByRole('radio', { name: 'TypeScript' }));
    await user.click(screen.getByRole('button', { name: 'Start interview' }));

    expect(screen.getByRole('radio', { name: 'Mixed' })).not.toBeChecked();
    await expectSubmitted(onSubmitAction, {
      seniorityLevel: 'mid',
      category: 'typescript',
      questionCount: '5',
    });
  });

  it('offers a Question Count slider from 5 to 10 that starts at 5 and shows its value', async () => {
    renderForm();

    const slider = await screen.findByRole('slider', { name: 'Question Count' });
    expect(slider).toHaveAttribute('min', '5');
    expect(slider).toHaveAttribute('max', '10');
    expect(slider).toHaveAttribute('step', '1');
    expect(slider).toHaveValue('5');
    expect(getThumbLabel()).toHaveTextContent('5');
    expect(screen.getByRole('status', { name: 'Question Count' })).toHaveTextContent('5 questions');
  });

  it('steps the Question Count by one with the − and + buttons, keeping the slider in sync', async () => {
    const { user } = renderForm();
    const slider = await screen.findByRole('slider', { name: 'Question Count' });

    await user.click(screen.getByRole('button', { name: 'Increase Question Count' }));
    expect(slider).toHaveValue('6');
    expect(getThumbLabel()).toHaveTextContent('6');
    expect(screen.getByRole('status', { name: 'Question Count' })).toHaveTextContent('6 questions');

    await user.click(screen.getByRole('button', { name: 'Increase Question Count' }));
    await user.click(screen.getByRole('button', { name: 'Decrease Question Count' }));
    expect(slider).toHaveValue('6');
    expect(getThumbLabel()).toHaveTextContent('6');
  });

  it('moves the Question Count with the arrow keys on the slider', async () => {
    const { user } = renderForm();
    const slider = await screen.findByRole('slider', { name: 'Question Count' });

    slider.focus();
    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(slider).toHaveValue('7');
    expect(getThumbLabel()).toHaveTextContent('7');
    expect(screen.getByRole('status', { name: 'Question Count' })).toHaveTextContent('7 questions');

    await user.keyboard('{ArrowLeft}');
    expect(slider).toHaveValue('6');
  });

  it('disables − at 5 and + at 10, keeping the Question Count within 5–10', async () => {
    const { user } = renderForm();
    const slider = await screen.findByRole('slider', { name: 'Question Count' });
    const decrease = screen.getByRole('button', { name: 'Decrease Question Count' });
    const increase = screen.getByRole('button', { name: 'Increase Question Count' });

    // The default is also the minimum, so − starts out disabled.
    expect(slider).toHaveValue('5');
    expect(decrease).toBeDisabled();
    expect(increase).toBeEnabled();

    for (let i = 0; i < 3; i++) await user.click(decrease);
    expect(slider).toHaveValue('5');

    slider.focus();
    await user.keyboard('{ArrowLeft}');
    expect(slider).toHaveValue('5');

    await user.keyboard('{End}');
    expect(slider).toHaveValue('10');
    expect(increase).toBeDisabled();
    expect(decrease).toBeEnabled();

    await user.keyboard('{ArrowRight}');
    for (let i = 0; i < 3; i++) await user.click(increase);
    expect(slider).toHaveValue('10');
  });

  it('submits the chosen Seniority Level, Category and Question Count together', async () => {
    const { onSubmitAction, user } = renderForm();

    await user.click(screen.getByRole('radio', { name: 'Junior' }));
    await user.click(screen.getByRole('radio', { name: 'React' }));
    await user.click(screen.getByRole('button', { name: 'Increase Question Count' }));
    await user.click(screen.getByRole('button', { name: 'Increase Question Count' }));
    await user.click(screen.getByRole('button', { name: 'Start interview' }));

    await expectSubmitted(onSubmitAction, {
      seniorityLevel: 'junior',
      category: 'react',
      questionCount: '7',
    });
  });

  it('disables Start interview while the Interview Setup is being submitted', async () => {
    const { promise, resolve } = Promise.withResolvers<void>();
    const user = userEvent.setup();
    render(<SetupForm onSubmitAction={() => promise} />);
    const start = screen.getByRole('button', { name: 'Start interview' });

    await user.click(start);
    await waitFor(() => expect(start).toBeDisabled());

    resolve();
    await waitFor(() => expect(start).toBeEnabled());
  });
});
