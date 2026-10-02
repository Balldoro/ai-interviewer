---
id: type-vs-interface
category: typescript
text: What is the difference between a type alias and an interface in TypeScript, and when do you use each?
variants:
  - keyPoints:
      - Both a type alias and an interface can describe the shape of an object, and for most object types they can be used interchangeably, including with extends or implements.
      - Only a type alias can directly name unions, primitives, tuples, and mapped or conditional types.
      - Interfaces with the same name in the same scope are merged into one, which is used to add to existing types such as Window or a library's types, while a type alias can't be declared twice.
      - The choice is mostly a team convention, and a common one is interface for object shapes and type for everything else, applied consistently.
---

# Type aliases and interfaces

TypeScript has two ways to give a name to a type: a **type alias** (`type`) and an **interface** (`interface`). They overlap a lot, but each can do a few things the other can't.

## What they share

Both can describe the **shape of an object**, and for most object types they are **interchangeable**:

```ts
type UserType = {
  id: string;
  name: string;
};

interface UserInterface {
  id: string;
  name: string;
}
```

Both can be **extended**, an interface with `extends` and a type alias with an intersection (`&`), and they can extend each other. A class can `implement` either one, as long as it describes an object shape:

```ts
interface Admin extends UserType {
  permissions: string[];
}

type Guest = UserInterface & { expiresAt: Date };

class Account implements UserType {
  constructor(
    public id: string,
    public name: string,
  ) {}
}
```

## What only a type alias can do

A type alias can name **any type**, not only object shapes:

```ts
type Status = 'idle' | 'loading' | 'success' | 'error'; // union
type Id = string; // primitive
type Point = [x: number, y: number]; // tuple
type Nullable<T> = { [K in keyof T]: T[K] | null }; // mapped type
type ElementOf<T> = T extends (infer E)[] ? E : never; // conditional type
```

An interface always describes an object shape, so **unions, primitives, tuples, and mapped or conditional types** need a type alias.

Function types are a grey area. They are usually written as a type alias, but an interface can describe one with a **call signature**. An interface can also **extend** the result of a mapped type, as long as its members are known:

```ts
type Handler = (event: MouseEvent) => void;

interface HandlerInterface {
  (event: MouseEvent): void; // call signature, same type as Handler
}

interface ReadonlyUser extends Readonly<UserType> {}
```

## What only an interface can do: declaration merging

Interfaces with the **same name in the same scope are merged** into one. This is called **declaration merging**, and it is how you **add to existing types**, such as a global like `Window` or a library's types. `declare global` only works in a **module file**, one with at least one `import` or `export`, so add `export {}` to a file that has none:

```ts
export {};

declare global {
  interface Window {
    analytics: Analytics;
  }
}

window.analytics.track('signup'); // ok
```

A type alias **can't be declared twice**; doing so is an error. That is safer when you don't want a type to be changed elsewhere, but it means type aliases can't be augmented.

## Conflicting properties

When the two approaches combine types with a **conflicting property**, they behave differently:

```ts
interface Base {
  id: string;
}

interface Child extends Base {
  id: number; // error: Interface 'Child' incorrectly extends interface 'Base'
}

type Combined = Base & { id: number };
// no error, but Combined['id'] is string & number, which is never
```

An interface that `extends` another **reports the conflict as an error** right where it is declared. An intersection with `&` **silently** combines the conflicting property into `never`, and you only find out when no value can be assigned to it.

## Which one to use

The choice is mostly a **team convention**. A common one is:

- **`interface`** for object shapes, such as props, API responses and class contracts;
- **`type`** for everything else: unions, tuples, function types and derived types.

Some teams use `type` everywhere instead. Either way, what matters is applying the convention **consistently**, so readers don't wonder whether a difference is meaningful.
