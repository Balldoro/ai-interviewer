---
id: equality-operators
category: javascript
text: What is the difference between == and === in JavaScript?
variants:
  - keyPoints:
      - Strict equality (===) compares without converting types, so values of different types are never equal.
      - Loose equality (==) converts the operands to a common type before comparing, which gives surprising results such as 0 == '' and '0' == false being true.
      - null and undefined are loosely equal to each other but to nothing else, so null == 0 is false.
      - Objects, including arrays and functions, are compared by reference with both operators, so two different objects with the same contents are not equal.
      - NaN is not equal to anything, not even itself, so it is checked with Number.isNaN, and Object.is treats NaN as equal to itself and tells +0 and -0 apart.
      - In practice === is the default, and the common deliberate use of == is x == null to check for both null and undefined.
---

# `==` versus `===`

JavaScript has two equality operators: **strict equality** (`===`) and **loose equality** (`==`). They differ in one thing: whether they convert types before comparing.

## Strict equality: `===`

`===` compares values **without converting their types**. If the two values have different types, they are **never equal**:

```js
1 === 1; // true
1 === '1'; // false: number and string
true === 1; // false
```

## Loose equality: `==`

`==` first **converts the operands to a common type**, then compares them. The conversion rules, mostly turning things into numbers, give surprising results:

```js
1 == '1'; // true: '1' becomes 1
0 == ''; // true: '' becomes 0
'0' == false; // true: both become 0
'' == '0'; // false: both strings, compared as they are
[] == false; // true: [] becomes '' and then 0
```

These results are not even consistent with each other: `0 == ''` and `0 == '0'` are both true, but `'' == '0'` is false.

### `null` and `undefined`

`null` and `undefined` have a special rule: they are loosely equal **to each other and to nothing else**:

```js
null == undefined; // true
null == 0; // false
undefined == false; // false
null === undefined; // false
```

## Objects are compared by reference

For objects, including **arrays and functions**, both operators compare **references**, not contents. Two variables are equal only if they point to the **same object**:

```js
[1, 2] === [1, 2]; // false: two different arrays
({}) == {}; // false

const a = { x: 1 };
const b = a;
a === b; // true: the same object
```

To compare contents you need a deep comparison, written by hand or from a library.

## `NaN`, `+0` and `-0`

`NaN` is **not equal to anything, not even itself**, with either operator:

```js
NaN === NaN; // false
NaN == NaN; // false
```

So check for it with **`Number.isNaN(value)`**. (The global `isNaN` converts its argument to a number first, so `isNaN('hello')` is true.)

**`Object.is`** is a third way to compare. It works like `===`, except that it treats `NaN` as equal to itself and tells `+0` and `-0` apart:

```js
Object.is(NaN, NaN); // true
0 === -0; // true
Object.is(0, -0); // false
```

## Which one to use

Use **`===` by default**. It is predictable and shows the intent clearly, and linters usually enforce it.

The one common, deliberate use of `==` is **`x == null`**. Thanks to the `null`/`undefined` rule, it is true exactly when `x` is `null` or `undefined`, so it checks for both at once:

```js
if (value == null) {
  // value is null or undefined
}
```
