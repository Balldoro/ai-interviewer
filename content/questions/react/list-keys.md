---
id: list-keys
category: react
text: Why does React need a key when you render a list?
variants:
  - seniorityLevel: junior
    keyPoints:
      - A key gives each list item a stable identity, so React can tell which items were added, removed or moved between renders.
      - Keys must be unique among the items of the list and should come from the data, such as a database ID.
      - Using the array index as the key causes bugs when items are reordered, inserted or removed, such as typed text or state ending up on the wrong item.
  - seniorityLevel: mid
    keyPoints:
      - When a list re-renders, React matches the new items to the old ones by key, so an item with the same key keeps its DOM node and state and only what changed is updated.
      - An index key ties an item's identity to its position, so inserting at the start or sorting makes React give one item's state and DOM to another, and redo more work than needed.
      - Keys must stay the same between renders, so a key generated during render, with Math.random or crypto.randomUUID, remounts every item on every render and loses its state and focus.
      - Keys only need to be unique among siblings, not across the app, and key is not passed to the component as a prop.
  - seniorityLevel: senior
    textOverride: How does React use keys when it reconciles the tree, and how can you use a key on purpose outside of lists?
    keyPoints:
      - Reconciliation assumes that elements of different types produce different trees and replaces them, and otherwise matches children by their position, with keys letting it match them by identity instead.
      - A component's state is tied to its place in the tree, meaning its parent, its type and its key (or its position among its siblings when it has no key), so the same key keeps the state even when the item moves, and a different key throws the old instance away and mounts a new one.
      - Changing a key on purpose resets a component, for example key={userId} on a form, which is simpler and safer than an effect that clears state when a prop changes.
      - An index key is only safe for a static list that is never reordered or filtered and whose items hold no state, and unstable keys remount everything, so stable IDs from the data are the default.
---

# Keys in lists

When you render a list in React, every item needs a **`key`** prop:

```jsx
function TodoList({ todos }) {
  return (
    <ul>
      {todos.map((todo) => (
        <li key={todo.id}>{todo.text}</li>
      ))}
    </ul>
  );
}
```

The key gives each item a **stable identity**. Between two renders, it lets React tell which items were **added**, **removed** or **moved**, instead of guessing from their position.

## Where keys come from

A key should come **from the data**: a database ID, or another value that uniquely and permanently identifies the item. Keys must be **unique among siblings**, meaning the items of the same list. They don't need to be unique across the whole app, so two different lists can use the same IDs.

`key` is a hint for React, not a prop for your component: a component **doesn't receive** `key` in its props. If it needs the ID, pass it separately (`<Todo key={todo.id} id={todo.id} />`).

## How React uses keys: reconciliation

On every render, React compares the new tree of elements with the previous one and works out which DOM changes are needed. This is **reconciliation**. Finding the truly minimal set of changes would be far too slow, so React uses a fast approach that relies on two assumptions:

1. **Elements of different types produce different trees.** If a `<div>` becomes a `<section>`, or `<Profile>` becomes `<Settings>`, React doesn't try to compare them: it **destroys** the old subtree, with its DOM and state, and builds the new one.
2. **Children are matched by position**, unless they have keys. With keys, React matches each new child to the old child **with the same key**, wherever it is in the list.

When an item is matched, React **keeps its DOM node and its component's state**, and updates only what changed. A key that is new causes a mount; a key that disappeared causes an unmount.

## Why the index is a bad key

Using the array index as the key (`key={index}`) ties an item's identity to its **position**, not to the item. That breaks as soon as the positions change:

```jsx
function TodoList({ todos }) {
  return todos.map((todo, index) => (
    <li key={index}>
      {todo.text} <input />
    </li>
  ));
}
```

Type something into the first item's input, then insert a new todo at the start of the list. The new todo gets key `0`, which React matches to the old first `<li>`, so it **keeps the input with your text**: the typed text now sits next to the wrong todo. The same happens with **sorting**, **filtering** and **removing** items, and with any component state inside the items.

It also wastes work: inserting at the start changes the content of **every** item at its position, instead of adding one new node.

The index is only safe when the list is **static**: it never gets reordered, filtered or inserted into, and its items hold **no state**. Otherwise use stable IDs from the data. If the data has none, generate an ID **once**, when the item is created, and store it with the item.

## Keys must be stable

A key must stay **the same between renders**. Generating it during render breaks everything:

```jsx
{
  todos.map((todo) => <Todo key={crypto.randomUUID()} todo={todo} />);
}
```

Every render produces **new keys**, so React sees every item as new: it **unmounts and remounts** all of them on each render. That is slow, and every item **loses its state**, and an input being typed into loses **focus**. The same goes for `Math.random()`.

## Keys and component state

A component's state isn't stored inside the component; React keeps it for the component's **place in the tree**. Without a key, that place is its **position** among its siblings under the same parent. With a key, it is its **key** under that parent, which is why a keyed item can move within its list and keep its state. Either way, the component's **type** must also stay the same. As long as the place and the type stay the same, the state survives re-renders. If the type changes, or the key changes (or, without a key, the position does), React throws the old instance away, with its state, and mounts a new one.

That makes `key` useful **outside lists** too: changing a component's key on purpose **resets it**. For example, a form for editing a user should start fresh when you switch to another user:

```jsx
<EditUserForm key={userId} user={user} />
```

When `userId` changes, React unmounts the old form and mounts a new one with fresh state. The alternative, an effect that clears each piece of state when `userId` changes, renders once with the **stale state** first, is easy to get wrong when state is added later, and doesn't reset the state of child components.

## Keyed Fragments

When each item renders several elements without a wrapper, use a Fragment. The short syntax `<></>` **can't take a key**, so write `Fragment` explicitly:

```jsx
import { Fragment } from 'react';

function Glossary({ terms }) {
  return (
    <dl>
      {terms.map((term) => (
        <Fragment key={term.id}>
          <dt>{term.name}</dt>
          <dd>{term.definition}</dd>
        </Fragment>
      ))}
    </dl>
  );
}
```
