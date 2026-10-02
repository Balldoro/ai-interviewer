---
id: state-updates
category: react
text: What happens when you update state in React, and why must state be treated as immutable?
variants:
  - seniorityLevel: junior
    keyPoints:
      - Calling a state setter doesn't change the state variable right away, it asks React to render the component again with the new value.
      - State must never be changed in place, so objects and arrays are updated by creating new ones, for example with spread syntax, map or filter.
      - When the new state depends on the previous state, an updater function such as setCount(c => c + 1) works from the latest value.
  - seniorityLevel: mid
    keyPoints:
      - A state variable is a snapshot that stays the same for the whole render, so reading it right after calling the setter still gives the old value.
      - React batches state updates made in the same event, including inside timeouts and promises since React 18, and renders once at the end.
      - Updater functions are queued and run in order against the latest state, so calling setCount(c => c + 1) three times adds three, while calling setCount(count + 1) three times adds only one.
      - React compares the old and new state with Object.is, so mutating an object and setting the same object again doesn't trigger a re-render.
      - Nested objects must be copied at every level that changes, because spread syntax copies only one level.
  - seniorityLevel: senior
    keyPoints:
      - A setter only queues an update, and React works through the queue during the next render, so each render sees one consistent snapshot of state and the new state only exists in the render that follows.
      - Automatic batching groups every update made in the same event into one render, including updates inside timeouts, promises and native event handlers, and flushSync forces an immediate render for the rare case where the DOM must be updated before the next line runs.
      - Immutability is what makes a cheap Object.is check enough to detect a change, which memo, useMemo, effect dependencies and the React Compiler all rely on, so a mutation shows up as missed updates and stale UI.
      - Values that can be calculated from props or other state are computed during render rather than stored, so state holds no duplicated or contradictory data.
      - When several values change together or the update logic grows complex, useReducer moves it into a pure reducer function that takes the current state and an action and returns the next state.
---

# State updates and immutability

State is what lets a component remember things between renders. `useState` returns the current value and a **setter**:

```jsx
function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

## Setting state requests a new render

Calling `setCount` **does not change** `count`. It tells React that the state should be different and **asks it to render the component again**. On that next render, `useState` returns the new value.

Behind the scenes, the setter puts an **update into a queue**. React works through the queue during the next render, when it calls the component function again, so the new state exists only **in the render that follows**.

## State is a snapshot

Within one render, a state variable is a **snapshot**: a plain constant that stays the same for the whole render, including inside event handlers created during it. Reading it right after calling the setter still gives the **old value**:

```jsx
function handleClick() {
  setCount(count + 1);
  console.log(count); // still the old value
}
```

This guarantees that everything in one render, the JSX, the handlers and the effects, sees **one consistent set of values**.

## Batching

React doesn't render after every setter call. It **batches** the updates made in the same event and renders **once** at the end:

```jsx
function handleSubmit() {
  setName('Ada');
  setAge(36);
  setStatus('saved');
  // one render, not three
}
```

Since React 18, this **automatic batching** also applies to updates made inside timeouts, promises and native event handlers, so the updates made in the same event end up in a single render.

In the rare case where the DOM must be updated **before the next line runs**, for example to scroll to an item that was just added, `flushSync` forces React to render immediately:

```jsx
import { flushSync } from 'react-dom';

flushSync(() => {
  setItems([...items, newItem]);
});
listRef.current.lastChild.scrollIntoView();
```

## Updater functions

Because of the snapshot, setting state from the current variable several times uses the **same old value** each time:

```jsx
setCount(count + 1); // 0 + 1
setCount(count + 1); // 0 + 1
setCount(count + 1); // 0 + 1
// count becomes 1
```

When the next state depends on the previous one, pass an **updater function**. Updaters are **queued and run in order**, each receiving the **latest** state, including the result of the previous updater:

```jsx
setCount((c) => c + 1); // 0 -> 1
setCount((c) => c + 1); // 1 -> 2
setCount((c) => c + 1); // 2 -> 3
// count becomes 3
```

## Treat state as immutable

To decide whether anything changed, React compares the old and new state with **`Object.is`**. For objects and arrays, that compares **references**, not contents. So mutating an object and passing the same object back **does nothing**:

```jsx
const [user, setUser] = useState({ name: 'Ada', age: 36 });

user.age = 37;
setUser(user); // same object: React skips the re-render
```

(React may still call the component once before bailing out, but it won't re-render its children or touch the DOM, so the mutation never shows up on screen.)

State must never be changed in place. Create a **new** object or array instead:

```jsx
setUser({ ...user, age: 37 });

setTodos([...todos, newTodo]); // add
setTodos(todos.filter((todo) => todo.id !== id)); // remove
setTodos(todos.map((todo) => (todo.id === id ? { ...todo, done: true } : todo))); // update
```

Watch out for methods that mutate arrays in place, such as `push`, `splice`, `sort` and `reverse`. Use `toSorted`, `toReversed`, or copy first.

### Nested objects

Spread syntax copies **only one level**. With nested data, every object **on the path to the change** must be copied:

```jsx
setUser({
  ...user,
  address: { ...user.address, city: 'London' },
});
```

Writing `{ ...user }` and then setting `copy.address.city` would still mutate the original `address`, which the old state shares. Libraries such as Immer let you write mutating code that produces new objects for you.

### Why immutability matters beyond re-rendering

Immutability is what makes a **cheap reference check** enough to know that something changed. React builds on that everywhere:

- `memo` skips re-rendering a component when its props are the same references;
- `useMemo`, `useCallback` and **effect dependencies** compare their dependencies with `Object.is`;
- the **React Compiler** memoizes automatically on the same assumption.

A mutation keeps the reference the same, so all of these conclude that nothing changed. The result is **missed updates and stale UI** that are hard to track down.

## Don't store what you can calculate

State should hold the **minimum** needed. Anything that can be **calculated** from props or other state is computed **during render**, not stored:

```jsx
const [todos, setTodos] = useState([]);
const remaining = todos.filter((todo) => !todo.done).length; // derived, not state
```

Storing derived values means keeping two pieces of state in sync by hand. Sooner or later they **disagree**, and the UI shows contradictory data. The same goes for **duplicated** state, such as storing the whole selected item when its ID is enough.

## `useReducer` for complex updates

When several pieces of state **change together**, or the update logic grows complex, `useReducer` moves it out of the event handlers into one **pure reducer** function. It takes the current state and an **action** describing what happened, and returns the **next state**:

```jsx
function reducer(state, action) {
  switch (action.type) {
    case 'added':
      return { ...state, todos: [...state.todos, action.todo] };
    case 'removed':
      return { ...state, todos: state.todos.filter((todo) => todo.id !== action.id) };
    default:
      throw new Error(`Unknown action: ${action.type}`);
  }
}

const [state, dispatch] = useReducer(reducer, { todos: [] });
dispatch({ type: 'added', todo });
```

The same rules apply: the reducer must not mutate state, and it can be tested on its own as a plain function.
