@AGENTS.md

## Code conventions

- One component per file. Only a trivial one-line component may share a file with another.
- Keep components to markup. When a component has more than trivial logic (several `useState`s, any `useEffect`, or other non-trivial logic), move that logic into a custom hook named after the component (`useSliderBalloon` for `SliderBalloon`) in its own `use-*.ts` file.
- When a component has a colocated hook or test, put the component, its hook and its test in a folder named after the component, e.g. `modules/setup/components/setup-form/{setup-form.tsx, use-setup-form.ts, setup-form.test.tsx}`. A sub-component bound to it nests inside that folder (`components/ui/slider/slider-balloon/`). There are no index files. Inside a module, import files from the same module by relative path (`./use-setup-form`, `../../lib/constants`); import anything outside it by full path (`@/components/ui/slider/slider`).
- Put a blank line between calls to different hooks, e.g. between a `useState` and the `useEffect` that follows it. Consecutive calls to the same hook, like a run of `useRef`s, stay together.
- Don't write type arguments TypeScript can infer: `useState(5)`, not `useState<number>(5)`.
- When an effect adds more than one event listener, pass them all the `signal` of one `AbortController` and clean up with `return () => controller.abort()`, rather than a `removeEventListener` call per listener.
- Import what you use from React by name, never through the `React` namespace: `import { useEffect, type ReactNode } from 'react'`, not `React.useEffect` or `React.ReactNode`.

## Agent skills

### Issue tracker

Issues live in GitHub Issues on `Balldoro/ai-interviewer`, managed with the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Uses the five default labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
