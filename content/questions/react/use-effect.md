---
id: use-effect
category: react
text: What is useEffect for, and how does its dependency array work?
variants:
  - seniorityLevel: junior
    keyPoints:
      - useEffect runs code after React has rendered the component and updated the DOM, for side effects such as fetching data, subscribing to events, starting timers or changing the document title.
      - The dependency array decides when the effect runs again, so with no array it runs after every render, with an empty array only after the first render, and with values it runs again when any of them changes.
      - The function returned from an effect is a cleanup that React runs before the effect runs again and when the component is removed, to undo things like timers and subscriptions.
      - Props and state used inside the effect must be listed as dependencies, or the effect keeps using old values.
  - seniorityLevel: mid
    keyPoints:
      - An effect synchronizes a component with something outside React, and it runs after React has committed the render to the DOM, usually once the browser has painted, so it doesn't delay what the user sees.
      - React compares each dependency with its previous value using Object.is, so an object, array or function created during render is new every time and makes the effect run after every render.
      - The cleanup runs before every re-run, with the previous render's values, as well as when the component is removed, so each setup is matched by a cleanup.
      - In development, Strict Mode runs one extra setup and cleanup cycle for every effect when a component mounts, to expose a missing cleanup.
      - Fetching in an effect must ignore or abort a response that arrives after the dependencies changed or the component was removed, or a stale response can overwrite newer data.
  - seniorityLevel: senior
    textOverride: When should you reach for useEffect, and when is an effect the wrong tool?
    keyPoints:
      - An effect is only for synchronizing with a system outside React, so data that can be calculated from props or state is computed during render, and logic caused by a user action belongs in the event handler.
      - Every reactive value read inside an effect must be a dependency, so to stop an effect re-running the code is changed until it no longer needs that value, for example by creating an object inside the effect or using an updater function, never by leaving the value out of the array.
      - Each render's effect closes over that render's props and state, so an effect with missing dependencies reads stale values, and a value that must be read without re-running the effect is read from a ref or a useEffectEvent function.
      - Chains of effects that set state to trigger other effects cause extra renders and hard-to-follow bugs, and resetting a component's state when a prop changes is done by changing its key rather than with an effect.
      - useLayoutEffect runs after the DOM is updated but before the browser paints, so it is used to measure layout without a visible flicker, at the cost of delaying the paint.
---

# `useEffect`

A React component should be a **pure** function: given the same props and state, it returns the same JSX and does nothing else. But real apps also need **side effects**: fetching data, subscribing to events, starting timers, changing the document title. `useEffect` is where those go.

```jsx
function ChatRoom({ roomId }) {
  useEffect(() => {
    const connection = createConnection(roomId);
    connection.connect();
    return () => connection.disconnect();
  }, [roomId]);

  return <h1>Welcome to {roomId}</h1>;
}
```

## When an effect runs

React first renders the component and **commits** the result to the DOM. Only **after** the commit does it run the effect, and usually only once the browser has **painted** the screen, so effects don't delay the user from seeing the update.

The exception is an effect caused by a user **interaction**, such as a click: React may run it **before** the browser paints, so that the result of the interaction shows up in the same frame.

## The dependency array

The second argument decides **when the effect runs again**:

```jsx
useEffect(() => {
  /* ... */
}); // no array: after every render

useEffect(() => {
  /* ... */
}, []); // empty array: only after the first render

useEffect(() => {
  /* ... */
}, [roomId]); // after the first render, and again whenever roomId changes
```

On each render, React compares every dependency with its value from the previous render using **`Object.is`**. If any of them changed, the effect runs again.

That comparison is by **reference** for objects, arrays and functions. One created during render is a **new value every time**, so it changes on every render and the effect re-runs after every render:

```jsx
function ChatRoom({ roomId }) {
  const options = { roomId, serverUrl }; // a new object on every render

  useEffect(() => {
    const connection = createConnection(options);
    connection.connect();
    return () => connection.disconnect();
  }, [options]); // reconnects after every render
}
```

The fix is to create the object **inside the effect** and depend on the primitive values instead:

```jsx
useEffect(() => {
  const connection = createConnection({ roomId, serverUrl });
  connection.connect();
  return () => connection.disconnect();
}, [roomId, serverUrl]);
```

## Cleanup

The function an effect returns is its **cleanup**. React runs it:

- **before the effect runs again**, with the values from the **previous** render, so the old connection is closed before the new one opens;
- when the component is **removed** from the screen.

So every setup is matched by a cleanup: connect and disconnect, subscribe and unsubscribe, `setInterval` and `clearInterval`, `addEventListener` and `removeEventListener`.

### Strict Mode runs effects twice

In development, **Strict Mode** runs **one extra setup and cleanup cycle** for every effect when a component mounts: it simulates unmounting and remounting the component, keeping its state, so each effect runs, cleans up and runs again. This is deliberate: if an effect has **no proper cleanup**, the double run makes the bug visible (two connections, two subscriptions) instead of letting it surface later in production. It doesn't happen in production builds.

## Dependencies must be honest

Every **reactive value** the effect reads, meaning props, state, and anything computed from them in the component body, must be in the array. The `react-hooks/exhaustive-deps` lint rule checks this.

The reason is closures. Each render is a separate call of the component function, and the effect created during a render **closes over that render's props and state**. If a value is missing from the array, the effect isn't recreated when it changes and keeps reading the **stale** value:

```jsx
function Timer() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setCount(count + 1), 1000); // count is always 0 here
    return () => clearInterval(id);
  }, []); // count is missing: the timer gets stuck at 1
}
```

When an effect re-runs too often, the answer is never to **lie** about its dependencies by deleting them from the array. Change the code so the effect **no longer needs** the value:

- use an **updater function**, so the effect doesn't read the state: `setCount((c) => c + 1)`;
- create objects and functions **inside the effect**;
- move values that don't depend on props or state **outside the component**.

Sometimes an effect must read the latest value of something **without re-running** when it changes, for example logging the current theme when a connection opens. That value can be read from a **ref**, or from a function created with **`useEffectEvent`**, which always sees the latest props and state and is not a dependency:

```jsx
const onConnected = useEffectEvent(() => {
  showNotification('Connected!', theme);
});

useEffect(() => {
  const connection = createConnection(roomId);
  connection.on('connected', onConnected);
  connection.connect();
  return () => connection.disconnect();
}, [roomId]); // theme changes don't reconnect
```

## Fetching data in an effect

A fetch started in an effect can finish **after** the dependencies have changed or the component was removed. If the old response arrives last, it **overwrites the newer data**. The effect must ignore or abort it in its cleanup:

```jsx
useEffect(() => {
  const controller = new AbortController();

  fetch(`/api/users/${userId}`, { signal: controller.signal })
    .then((response) => response.json())
    .then(setUser)
    .catch((error) => {
      if (error.name !== 'AbortError') setError(error);
    });

  return () => controller.abort();
}, [userId]);
```

In real apps, a data-fetching library or the framework's data loading handles this, plus caching and deduplication.

## You might not need an effect

Effects are an **escape hatch** for synchronizing with a system **outside React**: the network, the DOM, a browser API, a third-party widget. Many effects in real code don't do that, and are better removed:

- **Derived data**: a value that can be calculated from props or state is computed **during render**. Storing it in state and syncing it with an effect causes an extra render with stale data in between.
  ```jsx
  // Instead of state plus an effect that keeps fullName in sync:
  const fullName = `${firstName} ${lastName}`;
  ```
- **User actions**: logic that happens **because the user did something**, such as sending a request when a form is submitted, belongs in the **event handler**, which knows exactly what happened.
- **Chains of effects**: an effect that sets state so that another effect runs causes several renders in a row and is hard to follow. Compute the next state in one place, usually the event handler.
- **Resetting state when a prop changes**: rather than an effect that clears state when `userId` changes, give the component a **key**, so React treats it as a new component with fresh state:
  ```jsx
  <Profile userId={userId} key={userId} />
  ```

## `useLayoutEffect`

`useLayoutEffect` has the same API, but runs **after the DOM is updated and before the browser paints**. It is for reading layout, such as an element's size, and changing something based on it **without a visible flicker**, for example positioning a tooltip. Because it **blocks the paint**, slow code in it delays the screen update, so `useEffect` is the default.
