@AGENTS.md

## Code conventions

- One component per file. Only a trivial one-line component may share a file with another.
- Feature code lives in a module under `modules/<module>/`, with its components in `modules/<module>/components/` and its non-UI code (schemas, constants, helpers) in `modules/<module>/lib/`. For example, the Interview Setup form is in `modules/setup/components/` and its schema in `modules/setup/lib/`. Only code shared across modules goes in the root `lib/`. Only reusable components go in the root `components/` directory, and UI primitives go in `components/ui/`. A component that only makes sense inside one parent lives in that parent's directory.
- Keep components to markup. When a component has more than trivial logic (several `useState`s, any `useEffect`, or other non-trivial logic), move that logic into a custom hook named after the component (`useSliderBalloon` for `SliderBalloon`) in its own `use-*.ts` file.
- When a component has a colocated hook or test, put the component, its hook and its test in a folder named after the component, e.g. `modules/setup/components/interview-setup-form/{interview-setup-form.tsx, use-interview-setup-form.ts, interview-setup-form.test.tsx}`. A sub-component bound to it nests inside that folder (`components/ui/slider/slider-balloon/`). Import by full path (`@/components/ui/slider/slider`); there are no index files.
- Put a blank line between calls to different hooks, e.g. between a `useState` and the `useEffect` that follows it. Consecutive calls to the same hook, like a run of `useRef`s, stay together.
- Don't write type arguments TypeScript can infer: `useState(5)`, not `useState<number>(5)`. If inference gives too narrow a type (a literal from an `as const` object, say), fix the source, e.g. with `satisfies` instead of `as const`.
- Import what you use from React by name, never through the `React` namespace: `import { useEffect, type ReactNode } from 'react'`, not `React.useEffect` or `React.ReactNode`. Use one import line per module, with types marked inline (`type ReactNode`) when values come from the same module; use `import type { … }` only when every name is a type. This keeps imports tree-shakable and explicit. It covers `components/ui/` too, so rewrite shadcn output that uses `React.` after adding a component.

## Agent skills

### Issue tracker

Issues live in GitHub Issues on `Balldoro/ai-interviewer`, managed with the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Uses the five default labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
