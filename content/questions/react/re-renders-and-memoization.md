---
id: re-renders-and-memoization
category: react
text: When does a React component re-render, and how do memo, useMemo and useCallback help?
variants:
  - seniorityLevel: mid
    keyPoints:
      - A component re-renders when its state changes, when its parent re-renders, or when a context it reads changes, and by default a parent's re-render re-renders all of its children whether or not their props changed.
      - Re-rendering means calling the component function again, and React then changes the DOM only where the output differs, so a re-render is often cheap.
      - memo skips re-rendering a component when every prop is equal to its previous value by Object.is.
      - useMemo keeps a calculated value and useCallback keeps a function between renders, until one of their dependencies changes.
      - Objects, arrays and functions created during render are new on every render, so passing them to a memo component breaks it unless they are kept stable with useMemo or useCallback.
  - seniorityLevel: senior
    textOverride: How do you find and fix unnecessary re-renders in a React app, and what does memoization cost?
    keyPoints:
      - Slow renders are found by measuring before anything is optimized, with the React DevTools Profiler, which shows which components rendered, for how long and, with its setting turned on, why.
      - Memoization costs memory and a comparison on every render, and it is fragile, because a single new prop such as an inline object, an inline callback or JSX children makes memo do nothing.
      - Changing the structure often works better than memoizing, by moving state down into the component that uses it, or by passing elements as children so that the parent's state changes don't re-render them.
      - Every component that reads a context re-renders when its value changes, so the provided value is kept stable and values that change at different rates are split into separate contexts.
      - The React Compiler memoizes components and values automatically at build time, which makes most manual memo, useMemo and useCallback unnecessary, as long as the code follows the Rules of React.
---

# Re-renders and memoization

## What triggers a re-render

A component **re-renders**, meaning React calls the component function again, when:

- its **state** changes;
- its **parent re-renders**;
- a **context** it reads with `useContext` (or `use`) changes.

Props changing is not a separate trigger: props only change when the parent re-renders. And by default, when a parent re-renders, **all of its children re-render**, whether or not their props changed.

```jsx
function App() {
  const [count, setCount] = useState(0);
  return (
    <>
      <button onClick={() => setCount(count + 1)}>{count}</button>
      <ExpensiveChart /> {/* re-renders on every click, though it gets no props */}
    </>
  );
}
```

## A re-render is not a DOM update

Re-rendering produces a **new description** of the UI. React then compares it with the previous one and changes the DOM **only where the output differs**. If `ExpensiveChart` returns the same JSX as before, the DOM isn't touched.

So most re-renders are **cheap**, and React apps re-render all the time without problems. Re-renders matter only when a component is **slow to render**, or when there are a lot of them, for example a large list re-rendering on every keystroke.

## Finding slow renders

Before optimizing, **measure**. The **React DevTools Profiler** records an interaction and shows:

- which components rendered;
- **how long** each render took;
- **why** each one rendered (state, props, context, or the parent), once the "Record why each component rendered while profiling" setting is turned on.

That points to the components actually worth optimizing, instead of guessing. Since React 19.2, React also adds its own tracks to the Chrome DevTools **Performance** panel, showing renders and effects on the same timeline as the rest of the page's work.

## `memo`

`memo` wraps a component so that React **skips re-rendering it** when its parent re-renders, as long as **every prop is equal** to its previous value, compared with `Object.is`:

```jsx
const ExpensiveChart = memo(function ExpensiveChart({ data }) {
  /* ... */
});
```

The component still re-renders when its own state changes or a context it reads changes.

## `useMemo` and `useCallback`

`useMemo` **keeps a calculated value** between renders and recalculates it only when one of its **dependencies** changes:

```jsx
const visibleTodos = useMemo(() => filterTodos(todos, filter), [todos, filter]);
```

`useCallback` does the same for a **function**: it returns the same function until a dependency changes. `useCallback(fn, deps)` is the same as `useMemo(() => fn, deps)`.

```jsx
const handleSelect = useCallback((id) => setSelectedId(id), []);
```

## Why they go together

`Object.is` compares objects, arrays and functions **by reference**. One created during render is a **new value on every render**, so it is never equal to the previous one, and passing it to a `memo` component makes `memo` **useless**:

```jsx
function Page({ items }) {
  const [query, setQuery] = useState('');
  return (
    <ItemList
      items={items}
      options={{ sortable: true }} // new object every render
      onSelect={(id) => console.log(id)} // new function every render
    />
  );
}
```

Keeping those props stable with `useMemo` and `useCallback` (or moving constants outside the component) is what lets `memo` work. `useMemo` is also worth it on its own when a calculation is **noticeably slow** and its dependencies rarely change. `useCallback`, on the other hand, saves nothing unless the function is passed to a `memo` component or used as a dependency of another hook.

## What memoization costs

Memoization is not free:

- It **costs memory**, to keep the previous values and dependencies, and a **comparison on every render**.
- It makes code **harder to read**, with dependency arrays to keep correct.
- It is **fragile**. A single new prop, an inline object, an inline callback, or **JSX passed as `children`** (which is a new element every render), makes `memo` compare unequal every time. One careless change by someone else and the optimization silently stops working.

So memoization is for **measured** slow spots, not for wrapping every component.

## Fix the structure first

Often a better fix is to change **where state lives**, so fewer components re-render in the first place.

**Move state down.** If only part of a component uses some state, move that state into a smaller component, and the rest no longer re-renders:

```jsx
function App() {
  return (
    <>
      <Counter /> {/* owns the count state */}
      <ExpensiveChart /> {/* no longer re-renders on clicks */}
    </>
  );
}
```

**Pass elements as children.** A component that needs the state but wraps expensive content can receive that content as `children`. The elements are created by the **parent**, so when the wrapper's state changes, React sees the **same** `children` elements and doesn't re-render them:

```jsx
function ScrollTracker({ children }) {
  const [scrollY, setScrollY] = useState(0);
  // ...updates scrollY on scroll
  return <div data-scroll={scrollY}>{children}</div>;
}

<ScrollTracker>
  <ExpensiveChart /> {/* not re-rendered when scrollY changes */}
</ScrollTracker>;
```

## Context and re-renders

**Every component that reads a context re-renders when its value changes**, and `memo` doesn't stop that. Two things follow:

- The provided value should be **stable**. An object literal is new on every render of the provider, so every consumer re-renders whenever the provider does:
  ```jsx
  const value = useMemo(() => ({ user, logout }), [user, logout]);
  return <AuthContext value={value}>{children}</AuthContext>;
  ```
- Values that **change at different rates** belong in **separate contexts**. If the current theme and the mouse position share one context, every theme reader re-renders on every mouse move.

## The React Compiler

The **React Compiler** is a build-time tool that analyzes components and hooks and **memoizes them automatically**, at a finer grain than you would by hand: values, JSX elements and callbacks. With it enabled, most manual `memo`, `useMemo` and `useCallback` become **unnecessary**.

It relies on the code following the **Rules of React**: components and hooks are pure during render, props and state are never mutated, and hooks are called unconditionally at the top level. Code that breaks these rules can behave incorrectly once memoized. The compiler **detects** many violations and skips optimizing just the affected components or hooks, and the React lint rules report them, but it can't catch every violation, so code that breaks the rules unnoticed can still misbehave. `useMemo` and `useCallback` remain available as escape hatches, for example to control exactly when an effect's dependency changes.
