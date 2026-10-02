// @vitest-environment node
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { PGlite } from '@electric-sql/pglite';
import { asc } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import matter from 'gray-matter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { questions, questionVariants } from './schema';
import { QUESTION_BANK_DIR, seedQuestionBank } from './seed-question-bank';

let client: PGlite;
let db: ReturnType<typeof drizzle>;
let contentDir: string;

beforeEach(async () => {
  client = new PGlite();
  db = drizzle({ client });
  await migrate(db, { migrationsFolder: 'drizzle' });
  contentDir = await mkdtemp(path.join(tmpdir(), 'question-bank-'));
});

afterEach(async () => {
  await client.close();
  await rm(contentDir, { recursive: true, force: true });
});

type QuestionFile = {
  id: string;
  category: string;
  text: string;
  variants: { seniorityLevel?: string; textOverride?: string; keyPoints: string[] }[];
  explanation: string;
};

async function writeQuestion({ explanation, ...frontmatter }: QuestionFile) {
  const dir = path.join(contentDir, frontmatter.category);
  await mkdir(dir, { recursive: true });
  await writeFile(
    path.join(dir, `${frontmatter.id}.md`),
    matter.stringify(explanation, frontmatter),
  );
}

function seed() {
  return seedQuestionBank({ contentDir, db });
}

async function storedQuestions() {
  return db.select().from(questions).orderBy(asc(questions.id));
}

async function storedVariants() {
  return db
    .select()
    .from(questionVariants)
    .orderBy(asc(questionVariants.questionId), asc(questionVariants.seniorityLevel));
}

describe('seedQuestionBank', () => {
  it('stores a Question levelled at every Seniority Level, with its Explanation', async () => {
    await writeQuestion({
      id: 'closures',
      category: 'javascript',
      text: 'What is a closure?',
      variants: [
        {
          seniorityLevel: 'junior',
          keyPoints: ['A function remembers variables from where it was defined.'],
        },
        {
          seniorityLevel: 'mid',
          keyPoints: ['Closures capture variables, not values.', 'Used for private state.'],
        },
        {
          seniorityLevel: 'senior',
          keyPoints: ['Captured variables are kept alive and can leak memory.'],
        },
      ],
      explanation: '# Closures\n\nA closure is...',
    });

    await seed();

    expect(await storedQuestions()).toEqual([
      {
        id: 'closures',
        category: 'javascript',
        text: 'What is a closure?',
        explanation: '# Closures\n\nA closure is...',
      },
    ]);
    expect(await storedVariants()).toEqual([
      {
        questionId: 'closures',
        seniorityLevel: 'junior',
        textOverride: null,
        keyPoints: ['A function remembers variables from where it was defined.'],
      },
      {
        questionId: 'closures',
        seniorityLevel: 'mid',
        textOverride: null,
        keyPoints: ['Closures capture variables, not values.', 'Used for private state.'],
      },
      {
        questionId: 'closures',
        seniorityLevel: 'senior',
        textOverride: null,
        keyPoints: ['Captured variables are kept alive and can leak memory.'],
      },
    ]);
  });

  it('stores a Question available at only some Seniority Levels', async () => {
    await writeQuestion({
      id: 'fiber',
      category: 'react',
      text: 'What is React Fiber?',
      variants: [
        { seniorityLevel: 'mid', keyPoints: ['Rendering work can be split into units.'] },
        {
          seniorityLevel: 'senior',
          keyPoints: ['Rendering is interruptible and prioritised by lanes.'],
        },
      ],
      explanation: 'Fiber is React’s reconciler.',
    });

    await seed();

    const variants = await storedVariants();
    expect(variants.map((variant) => variant.seniorityLevel)).toEqual(['mid', 'senior']);
  });

  it('stores a Variant’s own Question Text, and none for Variants that use the default', async () => {
    await writeQuestion({
      id: 'generics',
      category: 'typescript',
      text: 'What are generics?',
      variants: [
        { seniorityLevel: 'junior', keyPoints: ['Generics make types reusable.'] },
        {
          seniorityLevel: 'senior',
          textOverride: 'How would you constrain and infer generic type parameters?',
          keyPoints: [
            'extends constrains a type parameter.',
            'Type parameters are inferred from arguments.',
          ],
        },
      ],
      explanation: 'Generics let a type take parameters.',
    });

    await seed();

    const variants = await storedVariants();
    expect(
      variants.map(({ seniorityLevel, textOverride }) => ({ seniorityLevel, textOverride })),
    ).toEqual([
      { seniorityLevel: 'junior', textOverride: null },
      {
        seniorityLevel: 'senior',
        textOverride: 'How would you constrain and infer generic type parameters?',
      },
    ]);
  });

  it('stores a level-agnostic Question as a single Variant without a Seniority Level', async () => {
    await writeQuestion({
      id: 'strict-equality',
      category: 'javascript',
      text: 'What is the difference between == and ===?',
      variants: [{ keyPoints: ['== coerces types; === does not.'] }],
      explanation: 'Equality in JavaScript...',
    });

    await seed();

    expect(await storedVariants()).toEqual([
      {
        questionId: 'strict-equality',
        seniorityLevel: null,
        textOverride: null,
        keyPoints: ['== coerces types; === does not.'],
      },
    ]);
  });

  it('rejects a Question with two Variants for the same Seniority Level, and writes nothing', async () => {
    await writeQuestion({
      id: 'hoisting',
      category: 'javascript',
      text: 'What is hoisting?',
      variants: [
        { seniorityLevel: 'mid', keyPoints: ['Declarations are processed before code runs.'] },
        { seniorityLevel: 'mid', keyPoints: ['let and const are in the temporal dead zone.'] },
      ],
      explanation: 'Hoisting...',
    });

    await expect(seed()).rejects.toThrow(
      /javascript\/hoisting\.md: .*More than one Variant for Seniority Level "mid"/,
    );
    expect(await storedQuestions()).toEqual([]);
  });

  it('rejects a Question that mixes a level-agnostic Variant with levelled ones, and writes nothing', async () => {
    await writeQuestion({
      id: 'use-effect',
      category: 'react',
      text: 'When does useEffect run?',
      variants: [
        { keyPoints: ['After the component renders.'] },
        { seniorityLevel: 'senior', keyPoints: ['After paint, unlike useLayoutEffect.'] },
      ],
      explanation: 'useEffect...',
    });

    await expect(seed()).rejects.toThrow(
      /react\/use-effect\.md: .*A level-agnostic Variant must be the only Variant of its Question/,
    );
    expect(await storedQuestions()).toEqual([]);
    expect(await storedVariants()).toEqual([]);
  });

  it('seeds the question files committed to the repo', async () => {
    await seedQuestionBank({ contentDir: QUESTION_BANK_DIR, db });

    expect(await storedQuestions()).not.toEqual([]);
  });
});
