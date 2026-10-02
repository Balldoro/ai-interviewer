---
id: event-loop
category: javascript
text: How does the JavaScript event loop work?
variants:
  - seniorityLevel: junior
    keyPoints:
      - JavaScript runs on a single thread, so only one piece of code executes at a time.
      - Asynchronous work such as timers, network requests and events is handled outside the call stack, and its callbacks are queued to run later.
      - The event loop runs a queued callback only once the call stack is empty, so a callback never interrupts running code.
      - A setTimeout delay is a minimum wait, not a guarantee, so setTimeout with 0 still runs after the current code finishes.
  - seniorityLevel: mid
    keyPoints:
      - JavaScript runs on a single thread, and the event loop takes callbacks from queues only when the call stack is empty.
      - There are two kinds of queue, microtasks (promise reactions, queueMicrotask, MutationObserver) and tasks, also called macrotasks (timers, I/O, UI events).
      - After each task, the whole microtask queue is drained before the next task runs, so promise callbacks run before an already-queued setTimeout callback.
      - Code after an await resumes as a microtask, so everything before the first await runs synchronously.
      - Long synchronous work blocks the loop, freezing rendering and input until it finishes.
  - seniorityLevel: senior
    textOverride: Walk me through what the event loop does in a single iteration, and how that affects rendering and responsiveness.
    keyPoints:
      - One iteration runs a single task, then drains the microtask queue completely, including microtasks queued while draining, then gives the browser a chance to render.
      - Rendering happens between tasks, at most once per frame, with requestAnimationFrame callbacks running just before style, layout and paint.
      - Because the microtask queue is drained to empty, microtasks that keep queueing more microtasks starve tasks and rendering and freeze the page, just like a long synchronous loop.
      - Long tasks (over 50 ms) hurt responsiveness, so heavy work should be split into chunks that yield back to the loop, for example with scheduler.yield or setTimeout, or moved to a Web Worker.
      - Node.js runs the same model through libuv phases (timers, poll, check), with process.nextTick callbacks running before promise microtasks, so the order of setTimeout and setImmediate depends on where they are scheduled from.
---

# The JavaScript event loop

JavaScript runs on a **single thread**: there is one call stack, and only one piece of JavaScript executes at a time. Yet a page can wait for a network response, react to clicks and run timers at once. The event loop is how the runtime (the browser or Node.js) makes that work.

## The call stack and asynchronous work

When a function is called, it is pushed onto the call stack; when it returns, it is popped off. Code on the stack always runs to completion: nothing can interrupt it midway.

Asynchronous work such as timers, network requests and DOM events is not done on the call stack. The runtime handles it elsewhere (browser APIs, the operating system, a thread pool) and, when the work is done, puts a **callback** into a queue. The **event loop** repeatedly checks the queues and, **only when the call stack is empty**, takes a callback and runs it. So a callback never interrupts code that is already running.

That is why `setTimeout(fn, 0)` does not run `fn` immediately. The delay is a **minimum** wait, not a guarantee: after it passes, `fn` is queued, and it runs only once the current code has finished and anything queued ahead of it has run.

```js
console.log('A');
setTimeout(() => console.log('B'), 0);
console.log('C');
// A, C, B
```

## Tasks and microtasks

There are two kinds of queue:

- **Tasks** (often called macrotasks): timer callbacks (`setTimeout`, `setInterval`), I/O callbacks, and UI events such as clicks. Running a script is itself a task.
- **Microtasks**: promise reactions (`then`, `catch`, `finally`), `queueMicrotask`, and `MutationObserver` callbacks.

After every task, the event loop **drains the whole microtask queue** before it picks the next task. So promise callbacks run before a `setTimeout` callback that was queued earlier:

```js
setTimeout(() => console.log('timeout'), 0);
Promise.resolve().then(() => console.log('promise'));
console.log('sync');
// sync, promise, timeout
```

`async`/`await` is built on promises. An `async` function runs **synchronously up to its first `await`**; the code after the `await` resumes later as a microtask.

```js
async function run() {
  console.log('1');
  await null;
  console.log('3');
}
run();
console.log('2');
// 1, 2, 3
```

## Blocking the loop

Because there is one thread, long synchronous work **blocks** the event loop. While it runs, no callbacks run, the browser can't render, and clicks and typing aren't handled. The page freezes until the work finishes.

## One iteration of the loop, in detail

In the browser, one iteration of the event loop does roughly this:

1. Run **one task** from a task queue.
2. **Drain the microtask queue completely**. This includes microtasks that are queued while draining: the queue must be empty before the loop moves on.
3. If it's time for a new frame, give the browser a chance to **render**: run `requestAnimationFrame` callbacks, then recalculate style and layout, then paint.

Rendering therefore happens **between tasks, at most once per frame** (typically every ~16 ms on a 60 Hz screen), and `requestAnimationFrame` is the place to make visual changes just before the browser paints them.

The microtask rule has a sharp edge. Because the queue is drained to empty, microtasks that keep queueing more microtasks never let the loop move on. Tasks and rendering are **starved** and the page freezes, exactly as if it were stuck in a long synchronous loop:

```js
function loop() {
  Promise.resolve().then(loop); // the page never renders again
}
loop();
```

A `setTimeout`-based loop, by contrast, lets rendering and input in between iterations, because each callback is a separate task.

## Responsiveness and long tasks

Any task that takes more than **50 ms** counts as a **long task**: user input that arrives during it has to wait, which makes the page feel sluggish. The fix is to keep each task short:

- **Split heavy work into chunks** and **yield** back to the event loop between them, so input and rendering can run. `await scheduler.yield()` does this where supported; `setTimeout(resolve, 0)` wrapped in a promise is the classic fallback.
- **Move CPU-heavy work to a Web Worker**, which runs on its own thread and talks to the page by messages.

## Node.js

Node.js uses the same model (one thread, run to completion, microtasks drained after each callback), but its loop is implemented by **libuv** and moves through **phases**. The main ones are:

- **timers**: expired `setTimeout` and `setInterval` callbacks;
- **poll**: I/O callbacks, and waiting for new I/O;
- **check**: `setImmediate` callbacks.

Node also has `process.nextTick`. Its queue runs **before promise microtasks**, so `nextTick` callbacks run first.

Because of the phases, the order of `setTimeout(fn, 0)` and `setImmediate(fn)` **depends on where they are scheduled from**. From the main module the order isn't guaranteed: it depends on whether the timer is already due when the loop starts. Inside an I/O callback, `setImmediate` always runs first, because the check phase comes straight after the poll phase.
