---
id: generics
category: typescript
text: What are generics in TypeScript, and why are they useful?
variants:
  - seniorityLevel: junior
    keyPoints:
      - Generics let a function, type or component take a type as a parameter, so it works with many types while keeping the type of what goes in linked to the type of what comes out.
      - TypeScript usually infers the type argument from the arguments passed, and it can be written explicitly when it can't be inferred, such as useState<User | null>(null).
      - Many everyday types are generic, such as Array<T>, Promise<T> and React's useState.
  - seniorityLevel: mid
    keyPoints:
      - Generics keep the relationship between types, unlike any or unknown, which lose the information about what type comes out.
      - 'A constraint written with extends limits which types can be passed and lets the body use the members the constraint guarantees, such as T extends { id: string }.'
      - 'keyof together with an indexed access type relates a key to the type of its value, as in getProperty<T, K extends keyof T>(obj: T, key: K): T[K].'
      - Generic types and components, such as ApiResponse<T> or a List component whose renderItem receives T, can give type parameters defaults and let one implementation be reused safely.
  - seniorityLevel: senior
    textOverride: How do you design good generic APIs in TypeScript, and how does TypeScript infer type arguments?
    keyPoints:
      - TypeScript infers a type argument by combining every place the type parameter appears in the arguments.
      - Literals inside array and object literals are widened during inference, so ['a', 'b'] infers string[], and a const type parameter keeps them as literal types.
      - A type parameter is only useful when it relates two or more types, so one used only once should be replaced by its constraint, and one that appears only in the return type is a type assertion in disguise.
      - Inside a generic function the body only knows the constraint, so returning a new object where T is expected is an error, because the caller could pass a subtype of the constraint with more properties.
      - A conditional type over a type parameter stays unresolved inside the generic function, so an implementation often needs an overload or an assertion to return it, which is a reason to prefer simpler signatures.
---

# Generics

**Generics** let a function, type or component take a **type as a parameter**. The same code then works with many types, while keeping the type of what goes in **linked** to the type of what comes out.

## Why not `any`?

Without generics, a function that works with any value loses track of the type:

```ts
function firstAny(items: any[]): any {
  return items[0];
}
const a = firstAny([1, 2, 3]); // any, the number type is lost

function firstUnknown(items: unknown[]): unknown {
  return items[0];
}
const b = firstUnknown([1, 2, 3]); // unknown, must be narrowed before use
```

A generic version **keeps the relationship**: whatever type the array holds is the type that comes out.

```ts
function first<T>(items: T[]): T | undefined {
  return items[0];
}
const c = first([1, 2, 3]); // number | undefined
const d = first(['a', 'b']); // string | undefined
```

## Inference and explicit type arguments

You rarely write the type argument yourself. TypeScript **infers** it from the arguments you pass. When it can't infer it, for example because the initial value doesn't show the full type, you write it **explicitly**:

```ts
const [user, setUser] = useState<User | null>(null);
// without <User | null>, the state type would be just null
```

Many everyday types are generic: **`Array<T>`** (also written `T[]`), **`Promise<T>`**, `Map<K, V>`, `Set<T>` and React's **`useState`**, `useRef` and `RefObject<T>`.

## Constraints with `extends`

A plain `T` can be anything, so the function body can't use any of its members. A **constraint** written with `extends` limits which types can be passed, and in return lets the body use what the constraint **guarantees**:

```ts
function byId<T extends { id: string }>(items: T[], id: string): T | undefined {
  return items.find((item) => item.id === id); // ok: every T has id
}

byId(users, 'u1'); // T is User
byId([1, 2], 'x'); // error: number doesn't have id
```

## Relating keys and values with `keyof`

`keyof T` is the union of `T`'s keys, and the **indexed access type** `T[K]` is the type of the value at key `K`. Together they let a function relate a key to its value's type:

```ts
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

const user = { id: 'u1', age: 36 };
getProperty(user, 'age'); // number
getProperty(user, 'email'); // error: not a key of user
```

## Generic types and components

Types and components can be generic too, so one implementation is reused safely with different data. Type parameters can have **defaults**:

```tsx
type ApiResponse<T, E = string> = { ok: true; data: T } | { ok: false; error: E };

type ListProps<T> = {
  items: T[];
  getKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
};

function List<T>({ items, getKey, renderItem }: ListProps<T>) {
  return (
    <ul>
      {items.map((item) => (
        <li key={getKey(item)}>{renderItem(item)}</li>
      ))}
    </ul>
  );
}

<List items={users} getKey={(user) => user.id} renderItem={(user) => user.name} />;
// user is inferred as User
```

## How inference really works

TypeScript collects **inference candidates** from **every place** the type parameter appears in the arguments and combines them. A few details matter when designing an API:

- **Literals inside array and object literals are widened.** A plain literal argument keeps its type, but literals nested in an array or object literal don't. A **`const` type parameter** (`<const T>`) keeps them as literal types, including readonly tuples:

  ```ts
  function id<T>(value: T) {
    return value;
  }
  id('primary'); // 'primary'
  id(['/home', '/about']); // string[]

  function routes<const T extends readonly string[]>(paths: T) {
    return paths;
  }
  routes(['/home', '/about']); // readonly ['/home', '/about']
  ```

- **Some positions shouldn't infer.** If a parameter should only be checked against `T`, not help decide it, wrap it in **`NoInfer<T>`**:

  ```ts
  function select<T extends string>(options: T[], initial: NoInfer<T>) {}

  select(['small', 'large'], 'medium'); // error, instead of widening T to include 'medium'
  ```

## Designing good generic signatures

A type parameter is only useful when it **relates two or more types**, such as an input to an output, or two inputs to each other.

- A type parameter used **only once** adds nothing. Replace it with its constraint:

  ```ts
  function logLength<T extends { length: number }>(value: T): void {} // pointless T
  function logLength(value: { length: number }): void {} // same, simpler
  ```

- A type parameter that appears **only in the return type** is a **type assertion in disguise**. Nothing checks it, the caller just picks a type:

  ```ts
  function parse<T>(json: string): T {
    return JSON.parse(json);
  }
  const user = parse<User>(text); // looks safe, but nothing was checked
  ```

  Returning `unknown` and validating the value is honest about what is known.

## The body only knows the constraint

Inside a generic function, `T` could be **any** type that satisfies the constraint, including a **subtype with more properties**. So the body can't return a new object where `T` is expected:

```ts
function withDefaults<T extends { theme: string }>(options: T): T {
  return { theme: 'light' };
  // error: '{ theme: string }' is assignable to the constraint of type 'T',
  // but 'T' could be instantiated with a different subtype of constraint
}
```

If the caller passed `{ theme: 'dark', fontSize: 14 }`, the returned object would be missing `fontSize`. Returning `{ ...options, theme: 'light' }` keeps every property and compiles, because a spread of `T` is typed as `T & { theme: string }`. Even that isn't fully sound: if `T` is `{ theme: 'dark' }`, the result claims `'dark'` but holds `'light'`.

## Conditional return types

A **conditional type** that depends on a type parameter stays **unresolved inside the generic function**, because TypeScript doesn't know yet which branch applies. The implementation then can't return either branch without help:

```ts
type Result<T extends boolean> = T extends true ? string[] : string;

function read<T extends boolean>(multiple: T): Result<T> {
  return multiple ? ['a'] : 'a'; // error: not assignable to Result<T>
}
```

The usual fixes are **overloads** or an **assertion** in the implementation, both of which move checking away from the compiler. That is a good reason to prefer **simpler signatures**, such as two separate functions, when a clever generic type isn't worth it.
