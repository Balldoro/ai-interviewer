---
id: any-unknown-never
category: typescript
text: What is the difference between any, unknown and never in TypeScript?
variants:
  - seniorityLevel: junior
    keyPoints:
      - any turns off type checking for a value, so you can do anything with it and mistakes only show up at runtime.
      - unknown also accepts any value, but it must be narrowed, for example with typeof, before it can be used, which makes it the safe type for values whose type isn't known yet, such as parsed JSON.
      - never is the type of values that never occur, such as the return type of a function that always throws.
  - seniorityLevel: mid
    keyPoints:
      - any is assignable to and from every type except never, so it spreads silently, because its properties and call results are any too, and checking is lost wherever it goes.
      - unknown is the top type, so every value is assignable to it, but it is assignable only to unknown and any, and must be narrowed with typeof, instanceof, in or a type guard before use.
      - never is the bottom type, assignable to every type while no value is assignable to it, used for functions that throw or never return and as what a value narrows to when every case has been ruled out.
      - Assigning the narrowed value to a never variable in the default branch of a switch makes the compiler report any new union member that isn't handled, which is called an exhaustiveness check.
      - Under strict mode, catch clause variables are unknown, so an error has to be narrowed, for example with instanceof Error, before reading its message.
  - seniorityLevel: senior
    keyPoints:
      - any disables checking in both directions and is contagious, and common APIs such as JSON.parse and response.json() return it, so external data should be typed as unknown and validated at runtime, for example with a schema library such as Zod.
      - unknown and never are the top and bottom of the type system, so in a union unknown absorbs every other type except any and never disappears, while in an intersection never absorbs every other type and unknown disappears.
      - never is how unions are filtered at the type level, because a distributive conditional type that returns never for a member removes it from the union, which is how Exclude works.
      - A type assertion such as value as User turns unknown into a specific type without any check, just like any, so a value should be narrowed by runtime checks rather than asserted.
---

# `any`, `unknown` and `never`

These three types sit at the edges of TypeScript's type system. `any` switches the type checker off, `unknown` means "some value, but we don't know what yet", and `never` means "no value can ever be here".

## `any`: no checking at all

A value of type `any` can be used in **any way** without errors. TypeScript stops checking it, so mistakes only show up **at runtime**:

```ts
let value: any = 'hello';
value.toFixed(2); // compiles, throws at runtime: toFixed is not a function
value.foo.bar(); // compiles, throws at runtime
```

`any` is assignable **to and from every type** except `never`. That makes it **contagious**: reading a property of an `any` gives `any`, calling it gives `any`, and passing it on removes checking wherever it goes:

```ts
const data: any = getData();
const name = data.user.name; // any
const user: User = data; // no error, whatever data really is
```

`any` also turns up without being written. Common APIs return it, such as **`JSON.parse`** and the Fetch API's **`response.json()`**, so the data you load from a server is unchecked unless you do something about it.

## `unknown`: any value, used safely

`unknown` also accepts **every value**, but you can't do anything with it until you **narrow** it to something more specific. That makes it the **safe** type for values whose type isn't known yet, such as parsed JSON or user input:

```ts
function format(value: unknown) {
  value.toUpperCase(); // error: 'value' is of type 'unknown'

  if (typeof value === 'string') {
    return value.toUpperCase(); // ok: value is string here
  }
  return String(value);
}
```

`unknown` is the **top type**: every value is assignable to it, but an `unknown` is assignable **only to `unknown` and `any`**. To use it, narrow it with `typeof`, `instanceof`, `in` or a user-defined type guard.

### Errors in `catch`

Anything can be thrown in JavaScript, not just `Error` objects. Under `strict` mode (through `useUnknownInCatchVariables`), the variable in a `catch` clause is therefore **`unknown`**, and you narrow it before reading its message:

```ts
try {
  await saveUser(user);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  showToast(message);
}
```

### Validate external data instead of trusting it

The safe pattern for data from outside the program is to treat it as **`unknown`** and **validate it at runtime**, for example with a schema library such as **Zod**, which checks the value and gives it a real type:

```ts
const UserSchema = z.object({ id: z.string(), name: z.string() });

const json: unknown = await response.json();
const user = UserSchema.parse(json); // { id: string; name: string }, or it throws
```

### Assertions are not checks

A **type assertion** such as `value as User` turns `unknown` into a specific type **without any check**. It is as unsafe as `any`: if the value doesn't actually match, nothing tells you until something breaks later. Prefer narrowing through real runtime checks, and keep assertions for cases where you know more than the compiler can.

```ts
const user = json as User; // compiles, but nothing was checked
```

## `never`: no value at all

`never` is the type of values that **never occur**. A function that always throws or loops forever has the return type `never`, because it never returns:

```ts
function fail(message: string): never {
  throw new Error(message);
}
```

Arrow functions and function expressions that always throw are inferred as `never`, but a **function declaration** is inferred as `void`, so it needs the explicit `: never` annotation shown above.

`never` is the **bottom type**: it is assignable **to every type**, but **no value is assignable to it**. It also appears as the type a value narrows to once **every possible case has been ruled out**.

### Exhaustiveness checks

That last property gives an **exhaustiveness check**. If you assign the narrowed value to a `never` variable in the `default` branch of a `switch`, the compiler reports an error as soon as someone adds a union member that isn't handled:

```ts
type Status = 'idle' | 'loading' | 'success' | 'error';

function label(status: Status) {
  switch (status) {
    case 'idle':
      return 'Not started';
    case 'loading':
      return 'Loading…';
    case 'success':
      return 'Done';
    case 'error':
      return 'Failed';
    default: {
      const unhandled: never = status; // error if a new Status is added
      throw new Error(`Unhandled status: ${unhandled}`);
    }
  }
}
```

## Top and bottom in unions and intersections

Because `unknown` is the top type and `never` the bottom type, they behave like the "everything" and "nothing" sets:

| Expression     | Result    | Why                                  |
| -------------- | --------- | ------------------------------------ |
| `T \| unknown` | `unknown` | `unknown` already contains every `T` |
| `T \| never`   | `T`       | adding nothing changes nothing       |
| `T & unknown`  | `T`       | `unknown` doesn't restrict anything  |
| `T & never`    | `never`   | nothing can be both `T` and nothing  |

So in a **union**, `unknown` absorbs every other type (except `any`: `any | unknown` is `any`) and `never` disappears. In an **intersection**, `never` absorbs every other type and `unknown` disappears.

## Filtering unions with `never`

Since `never` disappears from unions, it is how unions are **filtered at the type level**. A conditional type applied to a union is **distributive**: it runs once for each member and joins the results. Returning `never` for a member removes it. This is exactly how the built-in `Exclude` works:

```ts
type Exclude<T, U> = T extends U ? never : T;

type Status = 'idle' | 'loading' | 'success' | 'error';
type Finished = Exclude<Status, 'idle' | 'loading'>; // 'success' | 'error'
```

## Keeping `any` out

Use `any` only at the edges, as a deliberate escape hatch. The `noImplicitAny` compiler option (part of `strict`) and lint rules such as `@typescript-eslint/no-explicit-any` and the `no-unsafe-*` rules help keep it from spreading.
