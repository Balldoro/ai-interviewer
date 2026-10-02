---
id: this-keyword
category: javascript
text: How is the value of this decided in JavaScript?
variants:
  - seniorityLevel: junior
    keyPoints:
      - The value of this depends on how a function is called, not where it is defined.
      - When a function is called as a method, as in obj.method(), this is the object before the dot.
      - Arrow functions don't have their own this, so they use the this of the code around them.
      - A method passed as a callback, for example to setTimeout or addEventListener, loses its object, so this is no longer that object.
  - seniorityLevel: mid
    keyPoints:
      - The value of this is set at call time by the form of the call, so a method call gives the object, a plain function call gives undefined in strict mode (the global object otherwise), and new gives the newly created object.
      - call and apply run a function once with an explicit this (apply takes the arguments as an array), while bind returns a new function whose this is fixed for good.
      - Arrow functions take this from the surrounding scope and can't have it changed by call, apply or bind, so they suit callbacks inside methods but not object methods.
      - Extracting a method, by passing it as a callback or destructuring it, loses this, which is fixed with bind, an arrow function wrapper, or a class field holding an arrow function.
      - In an event listener that is a regular function, this is the element the listener is attached to.
  - seniorityLevel: senior
    textOverride: Given a function call, how do you work out what this will be, and where does that go wrong in real code?
    keyPoints:
      - The rules apply in order of precedence, new first, then explicit binding with bind, call or apply, then a method call, then the default, and a function returned by bind ignores any this later passed to call or apply.
      - The default this is undefined in strict mode, which covers ES modules and class bodies, so a detached class method that reads this throws a TypeError instead of silently using the global object.
      - Arrow functions resolve this lexically, like any other variable, so they can't be constructors and are wrong as prototype methods or as handlers that rely on the element as this.
      - Binding methods per instance, with class field arrow functions or bind in the constructor, creates one function per instance instead of one shared on the prototype, so they can't be overridden and called through super.
      - At the top level, this is undefined in an ES module, module.exports in a CommonJS module, and the global object in a classic script, while globalThis always gives the global object.
---

# How `this` works

In most languages, `this` always means "the current object". In JavaScript, `this` is decided by **how a function is called**, not by where the function is defined. The same function can see a different `this` each time it is called.

## The four ways to call a function

### Method call: the object before the dot

When a function is called as a **method**, `this` is the object before the dot:

```js
const user = {
  name: 'Ada',
  greet() {
    console.log(`Hi, I'm ${this.name}`);
  },
};

user.greet(); // "Hi, I'm Ada"
```

### Plain call: the default binding

When a function is called on its own, without an object, `this` gets the **default** value: `undefined` in strict mode, or the global object (`window` in browsers) in non-strict code.

```js
function show() {
  'use strict';
  console.log(this);
}

show(); // undefined
```

### Constructor call: the new object

When a function is called with `new`, `this` is the **newly created object**, which the call returns:

```js
function Person(name) {
  this.name = name;
}

const ada = new Person('Ada'); // this was the new object
```

### Explicit binding: `call`, `apply` and `bind`

You can choose `this` explicitly:

- `fn.call(obj, a, b)` runs `fn` **once** with `this` set to `obj`;
- `fn.apply(obj, [a, b])` does the same, but takes the arguments as an **array**;
- `fn.bind(obj)` doesn't run `fn`; it returns a **new function** whose `this` is fixed to `obj` for good.

```js
function greet(greeting) {
  return `${greeting}, ${this.name}`;
}

greet.call({ name: 'Ada' }, 'Hello'); // "Hello, Ada"
greet.apply({ name: 'Ada' }, ['Hi']); // "Hi, Ada"
const greetAda = greet.bind({ name: 'Ada' });
greetAda('Hey'); // "Hey, Ada"
```

### Precedence

When several rules could apply, they win in this order:

1. **`new`**: `this` is the new object, even when the function was created by `bind`.
2. **Explicit binding** with `bind`, `call` or `apply`. A function returned by `bind` keeps its `this`: a later `call` or `apply` **can't change it**.
3. **Method call**: the object before the dot.
4. **Default**: `undefined` in strict mode, the global object otherwise.

```js
const bound = greet.bind({ name: 'Ada' });
bound.call({ name: 'Grace' }, 'Hi'); // "Hi, Ada": bind wins over call
```

## Losing `this`

The most common bug with `this` is **extracting a method** from its object. Once the function is passed around on its own, the call no longer has an object before the dot, so the default binding applies:

```js
const counter = {
  count: 0,
  increment() {
    this.count++;
  },
};

setTimeout(counter.increment, 100); // this is not counter
const { increment } = counter;
increment(); // TypeError in strict mode: this is undefined
```

The fixes all keep the object attached:

```js
setTimeout(counter.increment.bind(counter), 100); // bind
setTimeout(() => counter.increment(), 100); // an arrow function wrapper

class Counter {
  count = 0;
  increment = () => {
    this.count++; // a class field holding an arrow function
  };
}
```

## Arrow functions

Arrow functions **don't have their own `this`**. They take `this` from the surrounding scope, **lexically**, exactly as they would look up any other variable. Because of that, `call`, `apply` and `bind` **can't change** an arrow function's `this`.

That makes arrow functions ideal for callbacks inside methods, where you want the method's `this`:

```js
class Timer {
  seconds = 0;
  start() {
    setInterval(() => {
      this.seconds++; // this is the Timer, taken from start()
    }, 1000);
  }
}
```

And it makes them wrong in other places:

- **As object or prototype methods**: `this` is not the object, but whatever `this` was around the object literal.
  ```js
  const user = {
    name: 'Ada',
    greet: () => console.log(this.name), // not user
  };
  ```
- **As constructors**: arrow functions can't be called with `new`.
- **As event handlers that rely on `this` being the element** (see below).

## `this` in event listeners

When an event listener is a **regular function**, the browser calls it with `this` set to the **element the listener is attached to** (the same as `event.currentTarget`). An arrow function listener doesn't get that; it keeps the outer `this`.

```js
button.addEventListener('click', function () {
  this.classList.toggle('active'); // this is button
});
```

## Strict mode, modules and classes

In **strict mode** the default `this` is `undefined`. All **ES modules** and all **class bodies** are strict automatically. So in modern code, a detached class method doesn't silently fall back to the global object; reading a property of `this` **throws a `TypeError`**, which makes the bug easy to spot:

```js
class Logger {
  prefix = '[app]';
  log(message) {
    console.log(this.prefix, message);
  }
}

const { log } = new Logger();
log('hi'); // TypeError: Cannot read properties of undefined (reading 'prefix')
```

## The cost of binding per instance

The two common ways to make a class method safe to pass around, a **class field arrow function** and **`bind` in the constructor**, both create **a new function for every instance**, stored on the instance, instead of one function shared on the prototype. That costs some memory with many instances, and it changes how inheritance works: the function isn't on the prototype, so a subclass can't override it and then call the parent version through `super.method()`, and it can't be spied on or mocked through the prototype.

Often the simpler fix is to bind at the place where the method is handed off (`() => obj.method()`) and keep methods on the prototype.

## `this` at the top level

Outside any function, `this` depends on the kind of file:

- in an **ES module**, it is `undefined`;
- in a **CommonJS** module in Node.js, it is `module.exports`;
- in a **classic browser script**, it is the global object, `window`.

To reach the global object reliably in any environment, use **`globalThis`**.
