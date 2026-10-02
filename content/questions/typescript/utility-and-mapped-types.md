---
id: utility-and-mapped-types
category: typescript
text: What are TypeScript's utility types, and how do mapped types work?
variants:
  - seniorityLevel: mid
    keyPoints:
      - Utility types such as Partial, Required, Readonly, Pick, Omit and Record build a new type from an existing one instead of declaring it again by hand.
      - Exclude, Extract and NonNullable filter union types, while ReturnType, Parameters and Awaited take a type out of a function or promise type.
      - 'A mapped type such as { [K in keyof T]: T[K] } goes through the keys of a type to build a new one, and can add or remove the ? and readonly modifiers, which is how Partial, Required and Readonly are written.'
      - Deriving types from one source of truth, for example with Omit<User, 'id'> for a create form or keyof typeof on a constant object, keeps related types in sync when the source changes.
  - seniorityLevel: senior
    textOverride: How are TypeScript's utility types built, and how would you write your own type transformations?
    keyPoints:
      - A mapped type can rename or drop keys with an as clause, where template literal types build new key names and mapping a key to never removes it.
      - A conditional type with infer pulls a type out of another one, which is how ReturnType, Parameters and Awaited are written.
      - A conditional type over a bare type parameter distributes over a union, checking each member on its own, which is how Exclude works, and wrapping both sides in square brackets turns this off.
      - A mapped type over keyof T keeps the optional and readonly modifiers of T's properties, which is why Pick keeps them.
      - Omit isn't distributive, so applying it to a union of object types keeps only the keys they share and loses the union.
      - Complex type-level code slows down the compiler and produces hard-to-read errors, so a custom type transformation is only worth it when it removes real duplication or prevents real bugs.
---

# Utility types and mapped types

TypeScript ships with **utility types** that **build a new type from an existing one**, so you don't declare a similar type again by hand. Most of them are written with two type-level tools you can use yourself: **mapped types** and **conditional types**.

## Utility types for object types

```ts
type User = {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
};
```

| Utility type                 | Result                                         |
| ---------------------------- | ---------------------------------------------- |
| `Partial<User>`              | every property optional                        |
| `Required<User>`             | every property required, including `avatarUrl` |
| `Readonly<User>`             | every property `readonly`                      |
| `Pick<User, 'id' \| 'name'>` | only `id` and `name`                           |
| `Omit<User, 'id'>`           | every property except `id`                     |
| `Record<K, V>`               | an object with keys `K` and values `V`         |

```ts
type UserUpdate = Partial<Omit<User, 'id'>>; // PATCH payload
type UsersById = Record<string, User>;
```

## Utility types for unions and functions

**`Exclude`**, **`Extract`** and **`NonNullable`** filter **union types**:

```ts
type Status = 'idle' | 'loading' | 'success' | 'error';

type Finished = Exclude<Status, 'idle' | 'loading'>; // 'success' | 'error'
type Busy = Extract<Status, 'loading'>; // 'loading'
type Name = NonNullable<string | null | undefined>; // string
```

**`ReturnType`**, **`Parameters`** and **`Awaited`** take a type **out of** a function or promise type, which is handy when a library doesn't export the type you need:

```ts
async function fetchUser(id: string) {
  /* ... */
  return { id, name: 'Ada' };
}

type FetchUserArgs = Parameters<typeof fetchUser>; // [id: string]
type FetchUserResult = Awaited<ReturnType<typeof fetchUser>>; // { id: string; name: string }
```

## Mapped types

A **mapped type** goes through the **keys of a type** and builds a new type from them. `[K in keyof T]` loops over every key, and `T[K]` is the type of that key's value:

```ts
type Copy<T> = { [K in keyof T]: T[K] };
```

A mapped type can **add or remove** the `?` and `readonly` **modifiers**, with `+` (the default) or `-`. This is exactly how the built-in utility types are written:

```ts
type Partial<T> = { [K in keyof T]?: T[K] };
type Required<T> = { [K in keyof T]-?: T[K] };
type Readonly<T> = { readonly [K in keyof T]: T[K] };
type Mutable<T> = { -readonly [K in keyof T]: T[K] }; // not built in
```

### Mapped types keep modifiers

A mapped type over **`keyof T`** is called **homomorphic**: it **keeps** the optional and `readonly` modifiers of `T`'s properties. `Pick` keeps them too, because its keys come from `keyof T`:

```ts
type Avatar = Pick<User, 'avatarUrl'>; // { avatarUrl?: string }, still optional
```

### Renaming and dropping keys with `as`

An **`as` clause** in a mapped type **renames** keys. Combined with **template literal types**, it builds new key names. **Mapping a key to `never` removes it**:

```ts
type Getters<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K];
};
type UserGetters = Getters<Pick<User, 'name'>>; // { getName: () => string }

type OnlyStrings<T> = {
  [K in keyof T as T[K] extends string ? K : never]: T[K];
};
type Labels = OnlyStrings<{ id: number; title: string }>; // { title: string }
```

## Conditional types and `infer`

A **conditional type** chooses a type based on a check: `T extends U ? X : Y`. Inside the check, **`infer`** declares a type variable that TypeScript fills in by **pulling a type out** of another one. This is how `ReturnType`, `Parameters` and `Awaited` are written (simplified):

```ts
type ReturnType<T extends (...args: any) => any> = T extends (...args: any) => infer R ? R : any;
type Parameters<T extends (...args: any) => any> = T extends (...args: infer P) => any ? P : never;
type Awaited<T> = T extends PromiseLike<infer V> ? Awaited<V> : T;
```

### Distribution over unions

A conditional type whose checked type is a **bare type parameter** is **distributive**: given a union, it checks **each member on its own** and joins the results. Returning `never` drops a member, which is how **`Exclude`** works:

```ts
type Exclude<T, U> = T extends U ? never : T;
// Exclude<'a' | 'b' | 'c', 'a'> runs for 'a', 'b' and 'c' separately: 'b' | 'c'
```

Wrapping both sides in **square brackets** turns distribution off, so the union is checked as a whole:

```ts
type IsString<T> = T extends string ? true : false;
type IsStringWhole<T> = [T] extends [string] ? true : false;

type A = IsString<string | number>; // boolean, i.e. true | false
type B = IsStringWhole<string | number>; // false
```

## `Omit` and unions

**`Omit` isn't distributive.** It is defined as `Pick<T, Exclude<keyof T, K>>`, and `keyof` a union gives only the keys **every member shares**. So applying `Omit` to a union of object types **keeps only the shared keys and loses the union**:

```ts
type Shape =
  | { kind: 'circle'; radius: number; color: string }
  | { kind: 'square'; size: number; color: string };

type NoColor = Omit<Shape, 'color'>; // { kind: 'circle' | 'square' }, radius and size are gone
```

That makes `Omit` the odd one out. A mapped type written directly over `keyof T`, such as `Partial`, **does** distribute over a union, so `Partial<Shape>` is a union of a partial circle and a partial square. `Omit` instead computes `keyof T` for the **whole union** first and then picks those keys, so the union is lost.

A distributive version fixes it by applying `Omit` to each member separately:

```ts
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

type NoColorShape = DistributiveOmit<Shape, 'color'>;
// { kind: 'circle'; radius: number } | { kind: 'square'; size: number }
```

## One source of truth

The main benefit of these tools is **deriving types from one source of truth**, so related types **stay in sync** when the source changes:

```ts
type CreateUserForm = Omit<User, 'id'>; // a new field on User appears here too

const ROLES = { admin: 'Admin', editor: 'Editor', viewer: 'Viewer' } as const;
type Role = keyof typeof ROLES; // 'admin' | 'editor' | 'viewer'
```

## Keep it proportionate

Type-level code is real code, and **complex** type transformations have costs: they **slow down the compiler** and editor, and they produce **errors that are hard to read**. A custom type transformation is worth it when it **removes real duplication or prevents real bugs**. Otherwise, a plainly written type is easier for the next reader.
