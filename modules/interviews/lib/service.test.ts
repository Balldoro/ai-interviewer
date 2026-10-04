// @vitest-environment node
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { asc, eq } from 'drizzle-orm';
import matter from 'gray-matter';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { db } from '@/db';
import {
  answers,
  interviewQuestions,
  interviews,
  questions,
  questionVariants,
  users,
} from '@/db/schema';
import { seedQuestionBank } from '@/db/seed-question-bank';
import type { QuestionCategory, SeniorityLevel } from '@/modules/setup/lib/constants';
import type { InterviewSetup } from '@/modules/setup/lib/schema';

import { getInterviewStep, startInterview, submitAnswer } from './service';
import type { Voice } from './voice';

const USER_ID = '00000000-0000-4000-8000-000000000001';
const OTHER_USER_ID = '00000000-0000-4000-8000-000000000002';

const { logger } = vi.hoisted(() => ({ logger: { error: vi.fn() } }));

vi.mock('@/lib/logger', () => ({ logger }));

beforeEach(async () => {
  await db.insert(users).values([{ id: USER_ID }, { id: OTHER_USER_ID }]);
});

type Variant = { seniorityLevel?: SeniorityLevel; textOverride?: string; keyPoints: string[] };

async function insertQuestion({
  id,
  category,
  variants = [{ keyPoints: [`${id} key point`] }],
}: {
  id: string;
  category: QuestionCategory;
  variants?: Variant[];
}) {
  await db
    .insert(questions)
    .values({ id, category, text: `${id} text`, explanation: `${id} explanation` });
  await db.insert(questionVariants).values(
    variants.map(({ seniorityLevel, textOverride, keyPoints }) => ({
      questionId: id,
      seniorityLevel: seniorityLevel ?? null,
      textOverride: textOverride ?? null,
      keyPoints,
    })),
  );
}

// `count` level-agnostic Questions in a Category, ids `${category}-1`, `${category}-2`, ...
async function insertQuestions(category: QuestionCategory, count: number) {
  for (let i = 1; i <= count; i++) await insertQuestion({ id: `${category}-${i}`, category });
}

function start(setup: Partial<InterviewSetup> = {}, userId = USER_ID) {
  return startInterview({
    userId,
    setup: { seniorityLevel: 'mid', category: 'javascript', questionCount: 5, ...setup },
  });
}

async function storedInterviewQuestions(interviewId: string) {
  return db
    .select()
    .from(interviewQuestions)
    .where(eq(interviewQuestions.interviewId, interviewId))
    .orderBy(asc(interviewQuestions.position));
}

async function storedAnswers() {
  return db.select().from(answers);
}

function fakeVoice(transcribe: Voice['transcribe'] = async () => 'Closures capture variables.') {
  return { transcribe: vi.fn(transcribe) };
}

async function categoriesOf(interviewId: string) {
  const ids = (await storedInterviewQuestions(interviewId)).map((question) => question.questionId);
  const rows = await db.select({ id: questions.id, category: questions.category }).from(questions);
  return ids.map((id) => rows.find((row) => row.id === id)?.category);
}

function countBy<T>(items: T[]) {
  const counts = new Map<T, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return counts;
}

describe('startInterview', () => {
  it('creates an in-progress Interview for the User with the Interview Setup', async () => {
    await insertQuestions('react', 6);

    const id = await start({ seniorityLevel: 'senior', category: 'react', questionCount: 6 });

    const [interview] = await db.select().from(interviews).where(eq(interviews.id, id));
    expect(interview).toMatchObject({
      userId: USER_ID,
      seniorityLevel: 'senior',
      category: 'react',
      questionCount: 6,
      status: 'in_progress',
      finishedAt: null,
    });
  });

  it('stores exactly Question Count Interview Questions, at positions 1 to N, with no repeats', async () => {
    await insertQuestions('javascript', 12);

    const id = await start({ questionCount: 7 });

    const stored = await storedInterviewQuestions(id);
    expect(stored.map((question) => question.position)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(new Set(stored.map((question) => question.questionId)).size).toBe(7);
  });

  it('picks only Questions from the chosen Category', async () => {
    await insertQuestions('javascript', 5);
    await insertQuestions('typescript', 5);

    const id = await start({ category: 'typescript' });

    expect(await categoriesOf(id)).toEqual(Array(5).fill('typescript'));
  });

  it('picks only Questions eligible at the Seniority Level, using that level’s Variant', async () => {
    await insertQuestions('javascript', 3);
    await insertQuestion({
      id: 'closures',
      category: 'javascript',
      variants: [
        { seniorityLevel: 'junior', keyPoints: ['junior point'] },
        { seniorityLevel: 'mid', keyPoints: ['mid point 1', 'mid point 2'] },
        { seniorityLevel: 'senior', keyPoints: ['senior point'] },
      ],
    });
    await insertQuestion({
      id: 'fiber',
      category: 'javascript',
      variants: [{ seniorityLevel: 'mid', keyPoints: ['fiber mid point'] }],
    });
    await insertQuestion({
      id: 'junior-only',
      category: 'javascript',
      variants: [{ seniorityLevel: 'junior', keyPoints: ['junior point'] }],
    });
    await insertQuestion({
      id: 'senior-only',
      category: 'javascript',
      variants: [{ seniorityLevel: 'senior', keyPoints: ['senior point'] }],
    });

    const id = await start({ seniorityLevel: 'mid', questionCount: 5 });

    const stored = await storedInterviewQuestions(id);
    expect(stored.map((question) => question.questionId).toSorted()).toEqual([
      'closures',
      'fiber',
      'javascript-1',
      'javascript-2',
      'javascript-3',
    ]);
    expect(stored.find((question) => question.questionId === 'closures')).toMatchObject({
      questionText: 'closures text',
      keyPoints: ['mid point 1', 'mid point 2'],
    });
    // A level-agnostic Question uses its only Variant.
    expect(stored.find((question) => question.questionId === 'javascript-1')).toMatchObject({
      questionText: 'javascript-1 text',
      keyPoints: ['javascript-1 key point'],
    });
  });

  it('snapshots a Variant’s own Question Text in place of the default', async () => {
    await insertQuestions('typescript', 4);
    await insertQuestion({
      id: 'generics',
      category: 'typescript',
      variants: [
        { seniorityLevel: 'junior', keyPoints: ['junior point'] },
        {
          seniorityLevel: 'senior',
          textOverride: 'How do you constrain generics?',
          keyPoints: ['senior point'],
        },
      ],
    });

    const id = await start({ seniorityLevel: 'senior', category: 'typescript' });

    const stored = await storedInterviewQuestions(id);
    expect(stored.find((question) => question.questionId === 'generics')).toMatchObject({
      questionText: 'How do you constrain generics?',
      keyPoints: ['senior point'],
    });
  });

  it.each([5, 6, 7, 8, 9, 10])(
    'spreads a Mixed Interview of %i as evenly as possible across Categories',
    async (questionCount) => {
      await insertQuestions('javascript', 5);
      await insertQuestions('react', 5);
      await insertQuestions('typescript', 5);

      const id = await start({ category: 'mixed', questionCount });

      const counts = [...countBy(await categoriesOf(id)).values()];
      expect(counts).toHaveLength(3);
      expect(counts.reduce((sum, count) => sum + count, 0)).toBe(questionCount);
      expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
    },
  );

  it('gives a Mixed Interview’s remainder to different Categories across Interviews', async () => {
    await insertQuestions('javascript', 5);
    await insertQuestions('react', 5);
    await insertQuestions('typescript', 5);

    const extraCategories = new Set<string | undefined>();
    for (let i = 0; i < 30; i++) {
      const counts = countBy(
        await categoriesOf(await start({ category: 'mixed', questionCount: 7 })),
      );
      extraCategories.add([...counts].find(([, count]) => count === 3)?.[0]);
    }

    expect(extraCategories.size).toBeGreaterThan(1);
  });

  it('interleaves a Mixed Interview’s Categories rather than asking them in a fixed order', async () => {
    await insertQuestions('javascript', 5);
    await insertQuestions('react', 5);
    await insertQuestions('typescript', 5);

    // Asked in blocks, three Categories change from one Interview Question to the next only twice.
    let mostChanges = 0;
    for (let i = 0; i < 10; i++) {
      const categories = await categoriesOf(await start({ category: 'mixed', questionCount: 9 }));
      const changes = categories.filter((category, j) => j > 0 && category !== categories[j - 1]);
      mostChanges = Math.max(mostChanges, changes.length);
    }

    expect(mostChanges).toBeGreaterThan(2);
  });
});

describe('getInterviewStep', () => {
  beforeEach(async () => {
    await insertQuestions('javascript', 5);
  });

  it('shows the first Interview Question’s text and its position out of the Question Count', async () => {
    const id = await start();
    const [first] = await storedInterviewQuestions(id);

    expect(await getInterviewStep({ userId: USER_ID, interviewId: id })).toEqual({
      position: 1,
      questionCount: 5,
      questionText: first.questionText,
    });
  });

  it('shows the same Interview Question when loaded again', async () => {
    const id = await start();

    const step = await getInterviewStep({ userId: USER_ID, interviewId: id });

    expect(await getInterviewStep({ userId: USER_ID, interviewId: id })).toEqual(step);
  });

  it('never contains Key Points, the Explanation or any other Interview Question', async () => {
    const id = await start();
    const [, ...others] = await storedInterviewQuestions(id);

    const step = JSON.stringify(await getInterviewStep({ userId: USER_ID, interviewId: id }));

    expect(step).not.toMatch(/key point|explanation/);
    for (const other of others) expect(step).not.toContain(other.questionText);
  });

  it('treats another User’s Interview as not found', async () => {
    const id = await start({}, OTHER_USER_ID);

    expect(await getInterviewStep({ userId: USER_ID, interviewId: id })).toBeNull();
  });

  it.each(['00000000-0000-4000-8000-000000000099', 'not-a-uuid'])(
    'treats an unknown Interview id as not found: %s',
    async (interviewId) => {
      expect(await getInterviewStep({ userId: USER_ID, interviewId })).toBeNull();
    },
  );
});

describe('submitAnswer', () => {
  const audio = new Blob(['audio'], { type: 'audio/webm;codecs=opus' });

  beforeEach(async () => {
    await insertQuestions('javascript', 5);
  });

  function submit(params: { interviewId: string; position?: number; voice?: Voice }) {
    return submitAnswer({
      voice: fakeVoice(),
      userId: USER_ID,
      position: 1,
      audio,
      ...params,
    });
  }

  it('stores the transcript as the Answer to the current Interview Question', async () => {
    const id = await start();
    const [first] = await storedInterviewQuestions(id);
    const voice = fakeVoice(async () => '  Closures capture variables.  ');

    expect(await submit({ interviewId: id, voice })).toBe('stored');

    expect(voice.transcribe).toHaveBeenCalledWith(audio);
    expect(await storedAnswers()).toEqual([
      {
        id: expect.any(String),
        interviewQuestionId: first.id,
        followUpIndex: 0,
        transcript: 'Closures capture variables.',
        createdAt: expect.any(Date),
      },
    ]);
  });

  it('stores nothing new when the Interview Question already has an Answer', async () => {
    const id = await start();
    await submit({ interviewId: id });
    const voice = fakeVoice(async () => 'A second take.');

    expect(await submit({ interviewId: id, voice })).toBe('already_answered');

    expect(voice.transcribe).not.toHaveBeenCalled();
    expect((await storedAnswers()).map((answer) => answer.transcript)).toEqual([
      'Closures capture variables.',
    ]);
  });

  it('stores one Answer when the same Answer is submitted twice at once', async () => {
    const id = await start();

    const outcomes = await Promise.all([submit({ interviewId: id }), submit({ interviewId: id })]);

    expect(outcomes.toSorted()).toEqual(['already_answered', 'stored']);
    expect(await storedAnswers()).toHaveLength(1);
  });

  it.each(['', '   \n'])('stores nothing when the transcript is empty: %j', async (transcript) => {
    const id = await start();

    expect(await submit({ interviewId: id, voice: fakeVoice(async () => transcript) })).toBe(
      'not_heard',
    );
    expect(await storedAnswers()).toEqual([]);
  });

  it('stores nothing and logs the failure when transcription fails', async () => {
    const id = await start();
    const failure = new Error('Speech-to-text unavailable');

    const voice = fakeVoice(async () => {
      throw failure;
    });

    expect(await submit({ interviewId: id, voice })).toBe('not_heard');
    expect(await storedAnswers()).toEqual([]);
    expect(logger.error).toHaveBeenCalledWith('Transcribing the Answer failed', failure, {
      interviewId: id,
      position: 1,
    });
  });

  it('lets the User answer again after a recording that couldn’t be heard', async () => {
    const id = await start();
    await submit({ interviewId: id, voice: fakeVoice(async () => '') });

    expect(await submit({ interviewId: id })).toBe('stored');
  });

  it.each([0, 2, 5, 6])(
    'rejects an Answer at position %i, which isn’t the current one',
    async (position) => {
      const id = await start();
      const voice = fakeVoice();

      expect(await submit({ interviewId: id, position, voice })).toBe('not_current_question');
      expect(voice.transcribe).not.toHaveBeenCalled();
      expect(await storedAnswers()).toEqual([]);
    },
  );

  it('treats another User’s Interview as not found', async () => {
    const id = await start({}, OTHER_USER_ID);

    expect(await submit({ interviewId: id })).toBe('not_found');
    expect(await storedAnswers()).toEqual([]);
  });

  it.each(['00000000-0000-4000-8000-000000000099', 'not-a-uuid'])(
    'treats an unknown Interview id as not found: %s',
    async (interviewId) => {
      expect(await submit({ interviewId })).toBe('not_found');
    },
  );

  it.each(['completed', 'abandoned'] as const)(
    'rejects an Answer to an Interview that is %s',
    async (status) => {
      const id = await start();
      await db.update(interviews).set({ status }).where(eq(interviews.id, id));

      expect(await submit({ interviewId: id })).toBe('not_in_progress');
      expect(await storedAnswers()).toEqual([]);
    },
  );
});

describe('re-seeding the question bank after an Interview started', () => {
  let contentDir: string;

  beforeEach(async () => {
    contentDir = await mkdtemp(path.join(tmpdir(), 'question-bank-'));
  });

  afterEach(async () => {
    await rm(contentDir, { recursive: true, force: true });
  });

  async function writeQuestions(count: number, text: (i: number) => string) {
    await mkdir(path.join(contentDir, 'react'), { recursive: true });
    for (let i = 1; i <= count; i++) {
      const frontmatter = {
        id: `react-${i}`,
        category: 'react',
        text: text(i),
        variants: [{ keyPoints: [`react-${i} key point`] }],
      };
      await writeFile(
        path.join(contentDir, 'react', `react-${i}.md`),
        matter.stringify(`react-${i} explanation`, frontmatter),
      );
    }
  }

  async function seed() {
    return seedQuestionBank({ contentDir, db });
  }

  it('leaves the snapshot unchanged when a Question is edited', async () => {
    await writeQuestions(5, (i) => `Original ${i}`);
    await seed();
    const id = await start({ category: 'react' });
    const before = await storedInterviewQuestions(id);

    await writeQuestions(5, (i) => `Edited ${i}`);
    await seed();

    expect(await storedInterviewQuestions(id)).toEqual(before);
  });

  it('keeps the snapshot but drops the link when a Question is deleted, and the seed succeeds', async () => {
    await writeQuestions(5, (i) => `Original ${i}`);
    await seed();
    const id = await start({ category: 'react' });
    const before = await storedInterviewQuestions(id);

    await rm(path.join(contentDir, 'react'), { recursive: true });

    await expect(seed()).resolves.toMatchObject({ questions: { deleted: 5 } });
    expect(await storedInterviewQuestions(id)).toEqual(
      before.map((question) => ({ ...question, questionId: null })),
    );
  });
});
