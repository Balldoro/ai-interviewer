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
  await writeQuestionFile(`${frontmatter.category}/${frontmatter.id}.md`, frontmatter, explanation);
}

// Writes `file` (relative to the content dir) as given, so a test can break any part of it.
async function writeQuestionFile(
  file: string,
  frontmatter: Record<string, unknown>,
  explanation: string,
) {
  const filePath = path.join(contentDir, file);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, matter.stringify(explanation, frontmatter));
}

async function deleteQuestionFile({ id, category }: Pick<QuestionFile, 'id' | 'category'>) {
  await rm(path.join(contentDir, category, `${id}.md`));
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

    expect(await seed()).toEqual({
      questions: { created: 1, updated: 0, deleted: 0 },
      variants: { created: 2, updated: 0, deleted: 0 },
    });
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

  describe('rejects an invalid question file, and writes nothing', () => {
    const { explanation, ...hoisting } = {
      id: 'hoisting',
      category: 'javascript',
      text: 'What is hoisting?',
      variants: [
        { seniorityLevel: 'mid', keyPoints: ['Declarations are processed before code runs.'] },
      ],
      explanation: 'Hoisting...',
    };
    const { id: _id, ...withoutId } = hoisting;
    const { category: _category, ...withoutCategory } = hoisting;
    const { text: _text, ...withoutText } = hoisting;

    it.each([
      { problem: 'a missing id', frontmatter: withoutId, error: 'id: ' },
      { problem: 'an empty id', frontmatter: { ...hoisting, id: ' ' }, error: 'id: ' },
      { problem: 'a missing Category', frontmatter: withoutCategory, error: 'category: ' },
      {
        problem: 'an empty Category',
        frontmatter: { ...hoisting, category: '' },
        error: 'category: ',
      },
      {
        problem: 'Category Mixed',
        frontmatter: { ...hoisting, category: 'mixed' },
        error: 'category: ',
      },
      {
        problem: 'an unknown Category',
        frontmatter: { ...hoisting, category: 'vue' },
        error: 'category: ',
      },
      {
        problem: 'a Category that doesn’t match its folder',
        frontmatter: { ...hoisting, category: 'react' },
        error: 'category "react" does not match its folder "javascript"',
      },
      { problem: 'a missing Question Text', frontmatter: withoutText, error: 'text: ' },
      {
        problem: 'an empty Question Text',
        frontmatter: { ...hoisting, text: ' ' },
        error: 'text: ',
      },
      {
        problem: 'an empty Explanation',
        frontmatter: hoisting,
        explanation: '\n',
        error: 'the Explanation (markdown body) is empty',
      },
      {
        problem: 'an unknown Seniority Level',
        frontmatter: { ...hoisting, variants: [{ seniorityLevel: 'lead', keyPoints: ['A'] }] },
        error: 'variants.0.seniorityLevel: ',
      },
      {
        problem: 'a Question with no Variants',
        frontmatter: { ...hoisting, variants: [] },
        error: 'variants: ',
      },
      {
        problem: 'a Variant with no Key Points',
        frontmatter: { ...hoisting, variants: [{ seniorityLevel: 'mid', keyPoints: [] }] },
        error: 'variants.0.keyPoints: ',
      },
      {
        problem: 'an empty Key Point',
        frontmatter: { ...hoisting, variants: [{ seniorityLevel: 'mid', keyPoints: ['A', ' '] }] },
        error: 'variants.0.keyPoints.1: ',
      },
    ])('$problem', async ({ frontmatter, explanation: body = explanation, error }) => {
      await writeQuestionFile('javascript/hoisting.md', frontmatter, body);

      await expect(seed()).rejects.toThrow(`javascript/hoisting.md: ${error}`);
      expect(await storedQuestions()).toEqual([]);
      expect(await storedVariants()).toEqual([]);
    });
  });

  it('reports every problem of every invalid file in one error', async () => {
    await writeQuestionFile(
      'javascript/hoisting.md',
      { id: 'hoisting', category: 'react', text: '', variants: [] },
      'Hoisting...',
    );
    await writeQuestionFile(
      'typescript/generics.md',
      { id: 'generics', category: 'typescript', text: 'What are generics?', variants: [] },
      '',
    );
    await writeQuestion({
      id: 'fiber',
      category: 'react',
      text: 'What is React Fiber?',
      variants: [{ seniorityLevel: 'senior', keyPoints: ['Rendering is interruptible.'] }],
      explanation: 'Fiber is React’s reconciler.',
    });

    const seeding = seed();
    await expect(seeding).rejects.toThrow(
      /javascript\/hoisting\.md: category "react" does not match its folder "javascript"/,
    );
    await expect(seeding).rejects.toThrow(/javascript\/hoisting\.md: text: /);
    await expect(seeding).rejects.toThrow(/javascript\/hoisting\.md: variants: /);
    await expect(seeding).rejects.toThrow(/typescript\/generics\.md: the Explanation .* is empty/);
    await expect(seeding).rejects.toThrow(/typescript\/generics\.md: variants: /);
    expect(await storedQuestions()).toEqual([]);
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

  it('rejects two files declaring the same Question id, and writes nothing', async () => {
    await writeQuestion({
      id: 'closures',
      category: 'javascript',
      text: 'What is a closure?',
      variants: [{ seniorityLevel: 'junior', keyPoints: ['Functions remember outer variables.'] }],
      explanation: 'A closure is...',
    });
    await writeQuestion({
      id: 'closures',
      category: 'react',
      text: 'What is a stale closure?',
      variants: [{ seniorityLevel: 'senior', keyPoints: ['Hooks can capture old state.'] }],
      explanation: 'A stale closure is...',
    });

    await expect(seed()).rejects.toThrow(
      'id "closures" is declared by more than one file: javascript/closures.md, react/closures.md',
    );
    expect(await storedQuestions()).toEqual([]);
  });

  it('reports a duplicate Question id alongside the other problems of an invalid file', async () => {
    await writeQuestion({
      id: 'closures',
      category: 'javascript',
      text: 'What is a closure?',
      variants: [],
      explanation: 'A closure is...',
    });
    await writeQuestion({
      id: 'closures',
      category: 'react',
      text: 'What is a stale closure?',
      variants: [{ seniorityLevel: 'senior', keyPoints: ['Hooks can capture old state.'] }],
      explanation: 'A stale closure is...',
    });

    const seeding = seed();
    await expect(seeding).rejects.toThrow(/javascript\/closures\.md: variants: /);
    await expect(seeding).rejects.toThrow(/id "closures" is declared by more than one file/);
  });

  it('reports a file with malformed frontmatter alongside the other files’ problems', async () => {
    await mkdir(path.join(contentDir, 'javascript'));
    await writeFile(
      path.join(contentDir, 'javascript', 'broken.md'),
      '---\nid: [broken\n---\nBody',
    );
    await writeQuestion({
      id: 'hoisting',
      category: 'javascript',
      text: 'What is hoisting?',
      variants: [],
      explanation: 'Hoisting...',
    });

    const seeding = seed();
    await expect(seeding).rejects.toThrow(/javascript\/broken\.md: /);
    await expect(seeding).rejects.toThrow(/javascript\/hoisting\.md: variants: /);
  });

  it('seeds the question files committed to the repo', async () => {
    await seedQuestionBank({ contentDir: QUESTION_BANK_DIR, db });

    expect(await storedQuestions()).not.toEqual([]);
  });
});

describe('re-seeding', () => {
  const closures: QuestionFile = {
    id: 'closures',
    category: 'javascript',
    text: 'What is a closure?',
    variants: [
      { seniorityLevel: 'junior', keyPoints: ['A function remembers its outer variables.'] },
      { seniorityLevel: 'mid', keyPoints: ['Closures capture variables, not values.'] },
      { seniorityLevel: 'senior', keyPoints: ['Captured variables are kept alive.'] },
    ],
    explanation: 'A closure is...',
  };
  const generics: QuestionFile = {
    id: 'generics',
    category: 'typescript',
    text: 'What are generics?',
    variants: [{ keyPoints: ['Generics make types reusable.'] }],
    explanation: 'Generics let a type take parameters.',
  };

  beforeEach(async () => {
    await writeQuestion(closures);
    await writeQuestion(generics);
    await seed();
  });

  it('leaves the database unchanged when the files are unchanged', async () => {
    const questionsBefore = await storedQuestions();
    const variantsBefore = await storedVariants();

    expect(await seed()).toEqual({
      questions: { created: 0, updated: 0, deleted: 0 },
      variants: { created: 0, updated: 0, deleted: 0 },
    });
    expect(await storedQuestions()).toEqual(questionsBefore);
    expect(await storedVariants()).toEqual(variantsBefore);
  });

  it.each([
    { field: 'Category', change: { category: 'react' } },
    { field: 'text', change: { text: 'Explain closures.' } },
    { field: 'Explanation', change: { explanation: 'Closures, revised.' } },
  ])('updates a Question whose $field changed', async ({ change }) => {
    await deleteQuestionFile(closures);
    await writeQuestion({ ...closures, ...change });

    expect(await seed()).toEqual({
      questions: { created: 0, updated: 1, deleted: 0 },
      variants: { created: 0, updated: 0, deleted: 0 },
    });
    const { variants: _variants, ...question } = { ...closures, ...change };
    expect(await storedQuestions()).toContainEqual(question);
  });

  it('updates Variants whose Key Points or text override changed, and adds new ones', async () => {
    await writeQuestion({
      ...generics,
      variants: [
        { seniorityLevel: 'junior', keyPoints: ['Generics make types reusable.'] },
        {
          seniorityLevel: 'senior',
          textOverride: 'How do you constrain generics?',
          keyPoints: ['extends constrains a type parameter.'],
        },
      ],
    });
    await writeQuestion({
      ...closures,
      variants: [
        closures.variants[0],
        { seniorityLevel: 'mid', keyPoints: ['Closures capture variables.', 'Private state.'] },
        { ...closures.variants[2], textOverride: 'How can closures leak memory?' },
      ],
    });

    expect(await seed()).toEqual({
      questions: { created: 0, updated: 0, deleted: 0 },
      // generics' level-agnostic Variant is replaced by levelled ones.
      variants: { created: 2, updated: 2, deleted: 1 },
    });
    expect(await storedVariants()).toEqual([
      {
        questionId: 'closures',
        seniorityLevel: 'junior',
        textOverride: null,
        keyPoints: ['A function remembers its outer variables.'],
      },
      {
        questionId: 'closures',
        seniorityLevel: 'mid',
        textOverride: null,
        keyPoints: ['Closures capture variables.', 'Private state.'],
      },
      {
        questionId: 'closures',
        seniorityLevel: 'senior',
        textOverride: 'How can closures leak memory?',
        keyPoints: ['Captured variables are kept alive.'],
      },
      {
        questionId: 'generics',
        seniorityLevel: 'junior',
        textOverride: null,
        keyPoints: ['Generics make types reusable.'],
      },
      {
        questionId: 'generics',
        seniorityLevel: 'senior',
        textOverride: 'How do you constrain generics?',
        keyPoints: ['extends constrains a type parameter.'],
      },
    ]);
  });

  it('clears a Variant’s text override removed from its file', async () => {
    const [junior, ...rest] = closures.variants;
    await writeQuestion({
      ...closures,
      variants: [{ ...junior, textOverride: 'Closures?' }, ...rest],
    });
    await seed();
    await writeQuestion(closures);

    expect((await seed()).variants).toEqual({ created: 0, updated: 1, deleted: 0 });
    const variants = await storedVariants();
    expect(
      variants.find(
        (variant) => variant.questionId === 'closures' && variant.seniorityLevel === 'junior',
      )?.textOverride,
    ).toBeNull();
  });

  it('stores reordered Key Points in their new order', async () => {
    await writeQuestion({
      ...generics,
      variants: [{ keyPoints: ['Generics make types reusable.', 'They are erased at runtime.'] }],
    });
    await seed();
    await writeQuestion({
      ...generics,
      variants: [{ keyPoints: ['They are erased at runtime.', 'Generics make types reusable.'] }],
    });

    expect((await seed()).variants).toEqual({ created: 0, updated: 1, deleted: 0 });
    const variants = await storedVariants();
    expect(variants.find((variant) => variant.questionId === 'generics')?.keyPoints).toEqual([
      'They are erased at runtime.',
      'Generics make types reusable.',
    ]);
  });

  it('replaces levelled Variants with a level-agnostic one', async () => {
    await writeQuestion({ ...closures, variants: [{ keyPoints: ['Functions remember scope.'] }] });

    expect((await seed()).variants).toEqual({ created: 1, updated: 0, deleted: 3 });
    expect(
      (await storedVariants()).map(({ questionId, seniorityLevel }) => [
        questionId,
        seniorityLevel,
      ]),
    ).toEqual([
      ['closures', null],
      ['generics', null],
    ]);
  });

  it('removes a Question and all its Variants when its file is deleted', async () => {
    await deleteQuestionFile(closures);

    expect(await seed()).toEqual({
      questions: { created: 0, updated: 0, deleted: 1 },
      variants: { created: 0, updated: 0, deleted: 3 },
    });
    expect((await storedQuestions()).map((question) => question.id)).toEqual(['generics']);
    expect((await storedVariants()).map((variant) => variant.questionId)).toEqual(['generics']);
  });

  it('removes only the Variant that was removed from a file', async () => {
    await writeQuestion({ ...closures, variants: closures.variants.slice(0, 2) });

    expect(await seed()).toEqual({
      questions: { created: 0, updated: 0, deleted: 0 },
      variants: { created: 0, updated: 0, deleted: 1 },
    });
    expect(
      (await storedVariants()).map(({ questionId, seniorityLevel }) => [
        questionId,
        seniorityLevel,
      ]),
    ).toEqual([
      ['closures', 'junior'],
      ['closures', 'mid'],
      ['generics', null],
    ]);
  });

  it('changes nothing when a file is invalid', async () => {
    await deleteQuestionFile(closures);
    await writeQuestion({ ...generics, variants: [] });

    await expect(seed()).rejects.toThrow(/typescript\/generics\.md/);
    expect(await storedQuestions()).toHaveLength(2);
    expect(await storedVariants()).toHaveLength(4);
  });
});
