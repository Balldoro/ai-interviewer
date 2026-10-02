---
id: type-narrowing
category: typescript
text: What is type narrowing in TypeScript, and how do you narrow a type?
variants:
  - seniorityLevel: junior
    keyPoints:
      - Narrowing is how TypeScript works out a more specific type for a value inside a block after a check, so a string | number becomes a string inside if (typeof value === 'string').
      - typeof narrows primitive types, instanceof narrows to a class, and a check such as if (value) or value != null removes null and undefined.
      - With strictNullChecks a value that may be null or undefined has to be checked before it is used, for example with an if or with optional chaining.
  - seniorityLevel: mid
    keyPoints:
      - TypeScript narrows by following the control flow of the code, so an early return or throw narrows the type for the rest of the function, and the in operator narrows by checking for a property.
      - A discriminated union gives every member a shared literal property, such as status, so checking that property in an if or switch narrows to the matching member.
      - A user-defined type guard has the return type value is Type, so a true result narrows its argument where it is called.
      - An assertion function declared with asserts value is Type throws when the check fails, so the argument is narrowed after the call.
      - Assigning the value to never after every member has been handled makes the compiler report union members that were missed, which is called an exhaustiveness check.
  - seniorityLevel: senior
    keyPoints:
      - Narrowing is lost where TypeScript can't prove the value hasn't changed, such as an object property read inside a callback, while it is kept for const variables and, since TypeScript 5.4, for parameters and let variables that aren't reassigned after the callback is created, so copying a property into a const before the callback keeps it narrowed.
      - Narrowing is optimistic rather than sound, because calling a function doesn't reset the narrowing of an object's properties even though the function could have changed them.
      - Discriminated unions make impossible states unrepresentable, such as data existing only when status is success, which is safer than one object with many optional fields.
      - Type guards and assertion functions are trusted rather than checked, so a guard with a wrong implementation makes the compiler believe something false, while TypeScript 5.5 infers safe guards from simple functions such as filter callbacks.
---

# Type narrowing

**Narrowing** is how TypeScript works out a **more specific type** for a value inside a block of code, based on the checks that run before it. It is what makes union types practical to use.

```ts
function format(value: string | number) {
  if (typeof value === 'string') {
    return value.toUpperCase(); // value is string here
  }
  return value.toFixed(2); // value is number here
}
```

## The basic checks

- **`typeof`** narrows by the value's runtime type, which is how **primitive types** are told apart: `'string'`, `'number'`, `'boolean'`, `'undefined'`, and also `'object'` and `'function'`. Watch out: `typeof null` is `'object'`, so `typeof value === 'object'` doesn't rule out `null`.
- **`instanceof`** narrows to a **class**: `error instanceof Error`, `target instanceof HTMLInputElement`.
- A **truthiness** check (`if (user)`) removes `null` and `undefined`. It also removes the other falsy values, such as `''` and `0`, so `if (count)` skips a count of zero, which is often a bug.
- An **equality** check removes what it compares against. `user !== null` removes only `null`, while the loose **`user != null`** removes both `null` and `undefined`.

```ts
function handleChange(event: Event) {
  if (event.target instanceof HTMLInputElement) {
    console.log(event.target.value); // target is HTMLInputElement
  }
}
```

## `null`, `undefined` and `strictNullChecks`

With **`strictNullChecks`** (part of `strict`), `null` and `undefined` are separate types. A value that may be missing has to be **checked before it is used**:

```ts
const input = document.querySelector('input'); // HTMLInputElement | null

input.focus(); // error: 'input' is possibly 'null'

if (input) {
  input.focus(); // ok
}
input?.focus(); // ok: optional chaining does nothing when input is null
```

## Control flow analysis

TypeScript narrows by following the **control flow** of the code. An **early return or throw** narrows the type for **the rest of the function**:

```ts
function greet(user: User | undefined) {
  if (!user) {
    return 'Hello, guest';
  }
  return `Hello, ${user.name}`; // user is User from here on
}
```

The **`in` operator** narrows by checking whether a **property exists**:

```ts
type Fish = { swim: () => void };
type Bird = { fly: () => void };

function move(animal: Fish | Bird) {
  if ('swim' in animal) {
    animal.swim(); // Fish
  } else {
    animal.fly(); // Bird
  }
}
```

## Discriminated unions

A **discriminated union** gives every member a **shared property with a literal type**, the discriminant, such as `status` or `kind`. Checking that property in an `if` or `switch` narrows to the **matching member**:

```ts
type RequestState =
  { status: 'loading' } | { status: 'success'; data: User[] } | { status: 'error'; error: string };

function render(state: RequestState) {
  switch (state.status) {
    case 'loading':
      return 'Loading…';
    case 'success':
      return `${state.data.length} users`; // data exists only here
    case 'error':
      return state.error;
  }
}
```

### Impossible states can't be written

Discriminated unions **make impossible states unrepresentable**. Compare them with one object full of optional fields:

```ts
type LooseState = {
  isLoading: boolean;
  data?: User[];
  error?: string;
};
```

`LooseState` allows nonsense such as `isLoading: true` together with both `data` and `error`, and every reader has to check fields that "should" be there. In `RequestState`, `data` **exists only when `status` is `'success'`**, so the compiler rules those combinations out.

## Exhaustiveness checks

After every member of a union has been handled, the value has narrowed to **`never`**. Assigning it to `never` makes the compiler **report any member that was missed**, for example when someone adds a new status later:

```ts
default: {
  const unhandled: never = state; // error if a status isn't handled above
  throw new Error(`Unhandled state: ${JSON.stringify(unhandled)}`);
}
```

## User-defined type guards and assertion functions

When the check is more complex than `typeof` or `in`, you can write your own.

A **user-defined type guard** returns **`value is Type`**. Where it is called, a `true` result narrows the argument:

```ts
function isUser(value: unknown): value is User {
  return typeof value === 'object' && value !== null && 'id' in value && 'name' in value;
}

if (isUser(data)) {
  data.name; // data is User
}
```

An **assertion function** is declared with **`asserts value is Type`**. It **throws** if the check fails, so the value is narrowed **after the call**:

```ts
function assertIsDefined<T>(value: T): asserts value is NonNullable<T> {
  if (value == null) {
    throw new Error('Expected a value');
  }
}

assertIsDefined(user);
user.name; // user is no longer undefined
```

### Guards are trusted, not checked

TypeScript **trusts** the `value is Type` and `asserts` signatures. It doesn't check that the implementation matches them, so a guard with a **wrong implementation makes the compiler believe something false**:

```ts
function isString(value: unknown): value is string {
  return true; // wrong, but compiles
}
```

Keep guards small and well tested. Since **TypeScript 5.5**, the compiler also **infers type guards** from simple functions, such as a `filter` callback, so many guards no longer need writing by hand:

```ts
const ids = [1, undefined, 3].filter((id) => id !== undefined); // number[]
```

## Where narrowing is lost

Narrowing only lasts as long as TypeScript can **prove the value hasn't changed**. Inside a **callback**, it can't know when the callback will run, so the narrowing of an **object property** is **lost**. A **`const`** can't change, so its narrowing is **kept**. Since **TypeScript 5.4**, narrowing is also kept for **parameters and `let` variables** that aren't reassigned after the callback is created; a `let` that is assigned again later still loses it. Copying a property into a `const` first fixes the problem:

```ts
function scheduleGreeting(user: { name: string | null }) {
  if (user.name) {
    setTimeout(() => {
      user.name.toUpperCase(); // error: 'user.name' is possibly 'null'
    });

    const name = user.name; // string
    setTimeout(() => {
      name.toUpperCase(); // ok
    });
  }
}
```

### Narrowing is optimistic

Narrowing is **optimistic rather than sound**. Calling a function **doesn't reset** the narrowing of an object's properties, even though the function **could have changed them**:

```ts
function check(state: { value: string | null }) {
  if (state.value !== null) {
    reset(state); // sets state.value = null
    state.value.length; // compiles, but throws at runtime
  }
}
```

Resetting narrowing after every call would make most real code unusable, so TypeScript accepts this gap. It is one more reason to prefer immutable data, where it can't happen.
