import { describe, expect, it } from 'vitest';

import { parseInterviewSetup } from './schema';

function formData(fields: Record<string, string>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

describe('parseInterviewSetup', () => {
  it('reads the Interview Setup from the submitted fields', () => {
    expect(
      parseInterviewSetup(
        formData({ seniorityLevel: 'senior', category: 'react', questionCount: '7' }),
      ),
    ).toEqual({ seniorityLevel: 'senior', category: 'react', questionCount: 7 });
  });

  it('falls back to the defaults for missing fields', () => {
    expect(parseInterviewSetup(formData({}))).toEqual({
      seniorityLevel: 'mid',
      category: 'mixed',
      questionCount: 5,
    });
  });

  it.each<Record<string, string>>([
    { seniorityLevel: 'principal' },
    { category: 'python' },
    { questionCount: '4' },
    { questionCount: '11' },
    { questionCount: '5.5' },
    { questionCount: 'five' },
    { questionCount: '' },
  ])('rejects a tampered field: %o', (fields) => {
    expect(() => parseInterviewSetup(formData(fields))).toThrow();
  });
});
