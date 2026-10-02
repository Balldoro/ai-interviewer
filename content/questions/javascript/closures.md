---
id: closures
category: javascript
text: What is a closure in JavaScript, and what is it useful for?
variants:
  - seniorityLevel: junior
    keyPoints:
      - A closure is a function that keeps access to the variables of the scope it was defined in, even after the outer function has returned.
      - Each call to the outer function creates new variables, so closures created by separate calls each have their own copy.
      - Closures are used all the time, for example in callbacks and event handlers that use variables from the surrounding code, and to keep private state such as a counter.
  - seniorityLevel: mid
    keyPoints:
      - A closure is a function together with the lexical scope it was created in, so the variables it can see are decided by where it is written, not where it is called.
      - Closures capture variables, not their values, so a closure sees later changes to a captured variable, and closures created in the same scope share the same variables.
      - In a for loop, var creates one function-scoped variable shared by every callback, while let creates a new binding for each iteration, so callbacks see the value from their own iteration.
      - Closures give private state and function factories, such as the module pattern, counters, and helpers like once, memoize and debounce.
  - seniorityLevel: senior
    keyPoints:
      - Every function call (and every let-scoped loop iteration) creates a new scope environment, and a closure holds a reference to that environment, which stays alive as long as the closure is reachable.
      - Captured variables live as long as the closure, so long-lived closures such as event listeners, timers, subscriptions and caches that are never removed keep large objects in memory and cause leaks.
      - Engines such as V8 keep one shared context for all closures created in the same scope, so a variable used by one closure can be kept alive by another long-lived closure that never uses it.
      - A stale closure keeps reading the variables from the call that created it, so a callback such as an interval or a React effect can act on outdated values unless it is recreated or reads through a mutable reference.
      - Closures are how JavaScript does encapsulation and partial application without classes, with the trade-off that each closure is a separate function object, whereas private class fields share methods on the prototype.
---

# Closures

A **closure** is a function together with the variables of the scope it was defined in. Because of closures, a function can keep using variables from an outer function **even after that outer function has returned**.

```js
function makeGreeter(name) {
  return function greet() {
    console.log(`Hello, ${name}`);
  };
}

const greetAda = makeGreeter('Ada');
greetAda(); // "Hello, Ada", although makeGreeter has already returned
```

## Lexical scope

JavaScript uses **lexical scope**: which variables a function can see is decided by **where the function is written** in the source code, not by where it is called from. A function defined inside `makeGreeter` can see `name` because it is written inside `makeGreeter`. Calling `greetAda` from somewhere completely different doesn't change that.

## Each call gets its own variables

Every call to the outer function creates a **new set of variables**, so closures created by separate calls don't share them:

```js
function makeCounter() {
  let count = 0;
  return () => ++count;
}

const a = makeCounter();
const b = makeCounter();
a(); // 1
a(); // 2
b(); // 1, b has its own count
```

## Closures capture variables, not values

A closure doesn't take a snapshot of a variable's value. It keeps a reference to the **variable itself**, so it sees any later change, and closures created in the same scope **share** the same variables:

```js
function makeAccount() {
  let balance = 0;
  return {
    deposit: (amount) => (balance += amount),
    getBalance: () => balance,
  };
}

const account = makeAccount();
account.deposit(50);
account.getBalance(); // 50, both functions share one balance
```

### The loop pitfall

This is the root of a classic bug. `var` is function-scoped, so a `for` loop with `var` has **one** variable shared by every callback, and by the time the callbacks run the loop has finished:

```js
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log(i));
}
// 3, 3, 3

for (let i = 0; i < 3; i++) {
  setTimeout(() => console.log(i));
}
// 0, 1, 2
```

With `let`, the loop creates a **new binding for each iteration**, so each callback closes over its own `i`.

## What closures are used for

Closures are everywhere in everyday JavaScript:

- **Callbacks and event handlers** that use variables from the surrounding code:
  ```js
  function setupButton(button, message) {
    button.addEventListener('click', () => alert(message));
  }
  ```
- **Private state**: variables that only the returned functions can reach, like `count` and `balance` above. This is the basis of the **module pattern**.
- **Function factories** that produce configured functions, and **partial application**:
  ```js
  const multiply = (a) => (b) => a * b;
  const double = multiply(2);
  ```
- **Helpers that remember something between calls**, such as `once`, `memoize` and `debounce`:
  ```js
  function once(fn) {
    let called = false;
    let result;
    return (...args) => {
      if (!called) {
        called = true;
        result = fn(...args);
      }
      return result;
    };
  }
  ```

Closures and classes are two ways to get encapsulation. Since ES2022, classes have **private fields** (`#count`), which make private state possible without closures. The trade-off: with closures, each object gets its **own copies of its functions**, while a class shares its methods on the prototype.

## How closures work under the hood

Each time a function is called, the engine creates a new **scope environment** holding that call's variables, linked to the environment of the scope around it. With `let`, each loop iteration gets its own environment too. A function created during the call keeps a reference to that environment. As long as the function is reachable, the environment, and every value it holds, **stays alive**.

## Closures and memory

Because captured variables live as long as the closure, a closure that lives a long time keeps its variables alive too. Typical sources of leaks are long-lived closures that are never cleaned up:

- event listeners that are never removed;
- `setInterval` callbacks that are never cleared;
- subscriptions that are never unsubscribed;
- caches, such as a `memoize` map, that grow without bound.

```js
function attach(element) {
  const bigData = new Array(1_000_000).fill('*');
  window.addEventListener('resize', () => {
    element.textContent = bigData.length;
  });
  // bigData is kept alive as long as the listener exists
}
```

There is a subtler trap. Engines such as V8 don't store a separate environment per closure: all closures created in the same scope **share one context** that holds every variable any of them uses. So a variable used only by a short-lived closure can be kept alive by another, long-lived closure from the same scope that never touches it:

```js
function setup() {
  const huge = loadHugeData();
  const log = () => console.log(huge.length); // uses huge
  log();
  return () => console.log('tick'); // never uses huge, but may keep it alive
}

setInterval(setup(), 1000);
```

## Stale closures

A closure keeps reading the variables **of the call that created it**. If those variables belong to an old call, the closure sees **outdated values**. This is common with intervals and with React, where each render is a new call with its own state:

```js
function Timer() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setCount(count + 1); // always reads count from the first render: stuck at 1
    }, 1000);
    return () => clearInterval(id);
  }, []);
}
```

The fixes are to **recreate the closure** when the values change (here, list `count` as a dependency), to avoid reading the captured value (`setCount((c) => c + 1)`), or to read through a **mutable reference** (a `useRef`, or an object property) that always holds the latest value.
