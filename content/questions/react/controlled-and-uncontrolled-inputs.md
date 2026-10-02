---
id: controlled-and-uncontrolled-inputs
category: react
text: What is the difference between controlled and uncontrolled form inputs in React?
variants:
  - keyPoints:
      - A controlled input gets its value from React state through the value prop and reports every change through onChange, so React state is the single source of truth.
      - An uncontrolled input keeps its own value in the DOM, starting from defaultValue, and the value is read when needed, through a ref or from the form's data on submit.
      - Controlled inputs make it easy to validate, format or react to every change as the user types, at the cost of a re-render on every keystroke.
      - An input given a value without an onChange handler is read-only, and a value that changes from undefined to a defined value switches the input from uncontrolled to controlled, which React warns about.
---

# Controlled and uncontrolled inputs

Form inputs such as `<input>`, `<textarea>` and `<select>` hold a value of their own in the DOM. React gives two ways to work with that value: let **React state** own it (**controlled**), or let the **DOM** keep it (**uncontrolled**).

## Controlled inputs

A **controlled** input gets its value from React state through the **`value`** prop, and reports every change through **`onChange`**, which updates the state:

```jsx
function NameField() {
  const [name, setName] = useState('');

  return <input value={name} onChange={(event) => setName(event.target.value)} />;
}
```

React state is the **single source of truth**: what the input shows is always exactly what the state holds. Checkboxes and radio buttons use **`checked`** instead of `value`.

That makes it easy to **react to every change as the user types**:

- **validate** on the fly and show errors immediately;
- **format or restrict** the input, for example forcing upper case or allowing only digits;
- enable or disable a submit button, or update other parts of the UI, from the current value.

```jsx
<input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} />
```

The cost is a **re-render on every keystroke**, of the component that owns the state and, by default, its children. For most forms that doesn't matter, but in a large form or one with expensive components it can make typing feel slow.

## Uncontrolled inputs

An **uncontrolled** input keeps its own value **in the DOM**, as plain HTML inputs do. React only sets its **initial** value, with **`defaultValue`** (or **`defaultChecked`**), and doesn't track it after that. The value is **read when it's needed**:

- through a **ref**:

  ```jsx
  function SearchBox() {
    const inputRef = useRef(null);

    function handleSearch() {
      search(inputRef.current.value);
    }

    return (
      <>
        <input ref={inputRef} defaultValue="" />
        <button onClick={handleSearch}>Search</button>
      </>
    );
  }
  ```

- or from the **form's data on submit**, by giving each input a `name`:

  ```jsx
  function handleSubmit(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    save(formData.get('email'));
  }
  ```

Typing doesn't cause any re-renders, and there is less code. The trade-off is that React doesn't know the value **while the user types**, so live validation or formatting is harder. Form libraries such as React Hook Form build on uncontrolled inputs for this performance benefit.

## Common mistakes

**A `value` without `onChange` makes the input read-only.** React keeps putting the state's value back, so typing does nothing, and React warns about it. Either add `onChange`, use `defaultValue` if the input should be uncontrolled, or add `readOnly` if read-only is intended.

**Switching between uncontrolled and controlled.** An input whose `value` is `undefined` is uncontrolled. If the value later becomes a defined string, the input **switches to controlled**, and React warns about it, because an input shouldn't change who owns its value during its lifetime. This often happens when state starts as `undefined` until data loads:

```jsx
const [name, setName] = useState(); // undefined: uncontrolled at first
<input value={name} onChange={(event) => setName(event.target.value)} />;
```

The fix is to always pass a **string**, for example `useState('')`, or `value={name ?? ''}`. Passing `null` as the value isn't a way out either: React warns about that too.

## Form actions in React 19

In React 19, a `<form>` can take a function as its **`action`** prop. On submit, React calls it with the form's **`FormData`**, so the values of the named, uncontrolled inputs arrive without any state or refs:

```jsx
function NewsletterForm() {
  async function subscribe(formData) {
    await saveEmail(formData.get('email'));
  }

  return (
    <form action={subscribe}>
      <input name="email" type="email" defaultValue="" />
      <button type="submit">Subscribe</button>
    </form>
  );
}
```

This suits **uncontrolled** inputs well. After the action **succeeds**, React **resets** the form's uncontrolled fields to their default values, so the form is ready for the next entry. That reset only happens with a function passed to `action` (or a button's `formAction`), not with an `onSubmit` handler; `requestFormReset` from `react-dom` resets a form manually. Hooks such as `useActionState` and `useFormStatus` add the result of the action and its pending state.

## Which to choose

Use a **controlled** input when the UI needs the value **as the user types**: live validation, formatting, dependent fields, or a value that other code sets. Use an **uncontrolled** input when the value is only needed **on submit**, which is simpler and avoids re-rendering on every keystroke.
