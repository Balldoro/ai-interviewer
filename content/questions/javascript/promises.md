---
id: promises
category: javascript
text: What is a Promise, and how do you work with promises and async/await?
variants:
  - seniorityLevel: junior
    keyPoints:
      - A promise stands for the result of asynchronous work that isn't available yet, and it is pending until it is either fulfilled with a value or rejected with an error.
      - then runs a callback with the value once the promise is fulfilled, catch handles a rejection, and finally runs in either case.
      - async/await is a nicer syntax for promises, where an async function always returns a promise and await waits for a promise to settle before the function continues.
      - Errors from awaited promises are handled with try/catch, and a rejection that nothing handles is a bug.
  - seniorityLevel: mid
    keyPoints:
      - A promise is pending until it settles once, as fulfilled with a value or rejected with a reason, and it never changes after that.
      - then returns a new promise for whatever its callback returns, and returning a promise makes the chain wait for it, so chains stay flat instead of nesting, and an error skips ahead to the next catch.
      - Forgetting to return a promise inside then, or forgetting await, breaks the chain, so the next step runs too early and its errors go unhandled.
      - Promise.all fails as soon as one promise rejects, Promise.allSettled waits for every result, Promise.race settles with the first promise to settle, and Promise.any fulfills with the first success.
      - Awaiting independent operations one after another runs them in sequence, so they should be started together and awaited with Promise.all to run concurrently.
  - seniorityLevel: senior
    textOverride: How do you write promise-based code that stays correct under failures, concurrency and cancellation?
    keyPoints:
      - Promise callbacks always run asynchronously as microtasks, even for an already settled promise, and resolving a promise with another promise or thenable adopts its state, so promises never nest.
      - A rejection with no handler fires unhandledrejection in browsers and crashes Node.js by default, so floating promises that are neither awaited nor returned must be avoided.
      - Promises can't be cancelled, and a Promise.all rejection or a lost Promise.race doesn't stop the other work, so real cancellation and timeouts use an AbortController whose signal is passed to fetch and to your own async functions.
      - Running a huge Promise.all over many items can overload a server or the browser, so concurrency should be limited with batches or a pool, keeping in mind that forEach with an async callback waits for nothing.
      - Responses to overlapping requests can arrive out of order, so a stale result must be ignored or its request aborted, for example in search-as-you-type.
---

# Promises and async/await

A **promise** is an object that stands for the result of asynchronous work that isn't available yet, such as a network response. Instead of passing a callback into the asynchronous function, you get a promise back and attach handlers to it.

## The states of a promise

A promise starts **pending**. It then **settles** exactly once, in one of two ways:

- **fulfilled**, with a value;
- **rejected**, with a reason, usually an `Error`.

Once settled, a promise **never changes** again: resolving or rejecting it a second time does nothing.

```js
const delay = (ms) =>
  new Promise((resolve) => {
    setTimeout(() => resolve(`waited ${ms} ms`), ms);
  });
```

## `then`, `catch` and `finally`

- `then(callback)` runs `callback` with the value once the promise is **fulfilled**;
- `catch(callback)` runs `callback` with the reason if the promise is **rejected**;
- `finally(callback)` runs in **either case**, for cleanup such as hiding a spinner.

```js
fetch('/api/user')
  .then((response) => response.json())
  .then((user) => console.log(user.name))
  .catch((error) => console.error('Failed to load user', error))
  .finally(() => hideSpinner());
```

### Chaining

Every call to `then` returns a **new promise**, resolved with whatever its callback returns. If the callback returns another promise, the chain **waits for it**, so steps that depend on each other stay in one flat chain instead of nesting callbacks.

If any step throws or returns a rejected promise, the chain **skips ahead to the next `catch`**, much like an exception skipping to the nearest `catch` block.

### Breaking the chain

The most common promise bug is **forgetting to return** a promise from a `then` callback, or **forgetting `await`**. The chain no longer waits for that work: the next step runs too early, and if the work fails, nothing is listening, so the error goes unhandled.

```js
saveUser(user)
  .then(() => {
    sendEmail(user); // missing return: the chain doesn't wait, and its errors are lost
  })
  .then(() => showSuccess());
```

## async/await

`async`/`await` is syntax built on promises:

- an `async` function **always returns a promise**: its return value fulfills it and a thrown error rejects it;
- `await` pauses the function until a promise **settles**, then gives back its value, or throws its reason.

So errors are handled with an ordinary **`try`/`catch`**:

```js
async function loadUser() {
  try {
    const response = await fetch('/api/user');
    return await response.json();
  } catch (error) {
    console.error('Failed to load user', error);
    throw error;
  }
}
```

A rejection that nothing handles is always a **bug**: it means a failure went unnoticed.

## Running promises together

Each `await` waits before the next line runs. Awaiting **independent** operations one after another therefore runs them **in sequence**, and the total time is the sum of each:

```js
const user = await getUser(); // 300 ms
const posts = await getPosts(); // then 300 ms more
```

Start them together and wait for all of them to run them **concurrently**:

```js
const [user, posts] = await Promise.all([getUser(), getPosts()]); // about 300 ms
```

The four combinators differ in what they wait for:

| Combinator           | Fulfills when                | Rejects when                          |
| -------------------- | ---------------------------- | ------------------------------------- |
| `Promise.all`        | all fulfill (array)          | **the first** rejects (fails fast)    |
| `Promise.allSettled` | all settle, either way       | never; each result says what happened |
| `Promise.race`       | the first to settle fulfills | the first to settle rejects           |
| `Promise.any`        | the first fulfills           | all reject (`AggregateError`)         |

## How promises behave under the hood

Promise callbacks **always run asynchronously**, as **microtasks**, even when the promise has already settled. So code right after `then` always runs before the callback:

```js
Promise.resolve('done').then(console.log);
console.log('first');
// first, done
```

Resolving a promise with **another promise**, or any **thenable** (an object with a `then` method), makes it **adopt that promise's state** instead of being fulfilled with the promise object. That's why promises never nest: there is no such thing as a promise of a promise.

## Unhandled rejections

When a promise is rejected and has no handler, browsers fire an **`unhandledrejection`** event, and Node.js (since version 15) **crashes the process** by default. The usual cause is a **floating promise**: one that is started but neither awaited nor returned, so no one can catch its failure.

```js
async function onSave() {
  saveDraft(); // floating: a failure here is an unhandled rejection
  await saveDraft(); // awaited: the caller can handle it
}
```

## Cancellation and timeouts

Promises **can't be cancelled**. Settling or ignoring one doesn't stop the work behind it. In particular:

- when `Promise.all` rejects, the **other operations keep running**;
- a timeout built with `Promise.race` makes the caller stop waiting, but the **losing request still runs** to completion.

Real cancellation uses an **`AbortController`**. Its `signal` is passed to `fetch`, which aborts the request, and to your own async functions, which should check it or listen for its `abort` event. `AbortSignal.timeout(ms)` gives a signal that aborts after a delay.

```js
const controller = new AbortController();
const response = fetch('/api/search?q=js', { signal: controller.signal });
controller.abort(); // the request is cancelled and the promise rejects with an AbortError

await fetch('/api/report', { signal: AbortSignal.timeout(5000) });
```

## Limiting concurrency

`Promise.all` over thousands of items starts **all of them at once**, which can overload a server, hit rate limits, or exhaust the browser's connections. Limit how many run at a time, with **batches** or a **pool** of workers:

```js
async function mapWithLimit(items, limit, fn) {
  const results = [];
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}
```

Also beware of `forEach` with an `async` callback: `forEach` ignores the returned promises, so it **waits for nothing** and the code after it runs immediately. Use `for...of` with `await` to go one by one, or `map` with `Promise.all` to run them together.

## Out-of-order responses

When requests overlap, their responses can arrive **in any order**. In search-as-you-type, the response for "re" may arrive after the one for "react" and overwrite the newer results. Either **ignore stale results**, by checking that the response belongs to the latest request, or **abort the previous request** with an `AbortController` when a new one starts.

```js
let controller;

async function search(query) {
  controller?.abort();
  controller = new AbortController();
  const response = await fetch(`/api/search?q=${query}`, { signal: controller.signal });
  showResults(await response.json());
}
```
