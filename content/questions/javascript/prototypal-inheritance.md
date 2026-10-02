---
id: prototypal-inheritance
category: javascript
text: How does prototypal inheritance work in JavaScript?
variants:
  - seniorityLevel: mid
    keyPoints:
      - Every object has an internal link to a prototype object, and a property missing on the object is looked up along this prototype chain until it reaches Object.prototype and then null.
      - A function called with new gives the new object its prototype property as the object's prototype, so methods defined there are shared by every instance instead of copied into each one.
      - class syntax is built on prototypes, with methods placed on the class's prototype object and extends linking the child's prototype to the parent's.
      - Assigning a property creates an own property on the object that shadows the one on the prototype, and Object.hasOwn tells own properties apart from inherited ones.
  - seniorityLevel: senior
    keyPoints:
      - Objects delegate property lookups along their prototype chain, which Object.create sets directly, and Object.create(null) gives a dictionary object with no inherited properties at all.
      - class is more than syntax over constructor functions, because class bodies are strict, classes must be called with new, methods are non-enumerable, and extends also links the constructors so static members are inherited.
      - Assignment usually shadows an inherited property, but if the inherited property is a setter the setter runs instead, and if it is non-writable the assignment fails, throwing in strict mode.
      - Objects and arrays placed on a prototype are shared by every instance, so mutating them through one instance changes them for all, which is why per-instance state belongs in the constructor or class fields.
      - Changing built-in prototypes affects every object in the program, and merging untrusted input with keys such as __proto__ causes prototype pollution, a real security vulnerability.
---

# Prototypal inheritance

JavaScript doesn't copy behaviour from classes into objects. Instead, objects **delegate** to other objects: each object has a link to a **prototype** object, and when a property isn't found on the object itself, JavaScript looks for it on the prototype.

## The prototype chain

Every object has an internal link, `[[Prototype]]`, to another object or to `null`. You can read it with `Object.getPrototypeOf(obj)` (and the legacy `__proto__` accessor).

When you read a property, JavaScript looks for it:

1. on the object itself (an **own** property);
2. if it's missing, on the object's prototype;
3. then on that prototype's prototype, and so on along the **prototype chain**,
4. until it reaches `Object.prototype` and then `null`, where the lookup gives `undefined`.

```js
const animal = {
  eats: true,
  describe() {
    return `eats: ${this.eats}`;
  },
};
const rabbit = Object.create(animal); // rabbit's prototype is animal
rabbit.jumps = true;

rabbit.jumps; // true, own property
rabbit.eats; // true, found on animal
rabbit.toString; // found on Object.prototype
```

`Object.create(proto)` creates an object with a **chosen prototype** directly. `Object.create(null)` creates an object with **no prototype at all**: it inherits nothing, not even `toString` or `hasOwnProperty`, which makes it a safe dictionary for arbitrary keys (a `Map` is often better still).

## Constructors and `new`

Every regular function has a `prototype` property. When a function is called with `new`, the new object gets that `prototype` object as **its** prototype. Methods defined on the `prototype` are therefore **shared** by every instance, not copied into each one:

```js
function Person(name) {
  this.name = name; // own property, one per instance
}
Person.prototype.greet = function () {
  return `Hi, I'm ${this.name}`;
};

const ada = new Person('Ada');
const grace = new Person('Grace');
ada.greet === grace.greet; // true, one shared function
Object.getPrototypeOf(ada) === Person.prototype; // true
```

## Classes

`class` syntax is built on the same mechanism. Methods go on `ClassName.prototype`, and `extends` links the child's prototype to the parent's:

```js
class Animal {
  speak() {
    return 'some sound';
  }
}
class Dog extends Animal {
  speak() {
    return `${super.speak()}, woof`;
  }
}

Object.getPrototypeOf(Dog.prototype) === Animal.prototype; // true
```

But a class is **more than syntax** over constructor functions:

- class bodies always run in **strict mode**;
- a class **must be called with `new`**; calling it as a function throws;
- class methods are **non-enumerable**, so they don't show up in `for...in`;
- `extends` also links the **constructors themselves** (`Object.getPrototypeOf(Dog) === Animal`), so **static members are inherited**;
- `super` works through the prototype chain of the object the method was defined on.

## Own properties and shadowing

Reading follows the chain, but **assigning** normally creates or changes an **own** property on the object itself. The inherited property is left alone and is now **shadowed**:

```js
rabbit.eats = false;
rabbit.eats; // false, own property
animal.eats; // true, unchanged
```

To tell own properties from inherited ones, use **`Object.hasOwn(obj, key)`** (or the older `obj.hasOwnProperty(key)`). `in` and `for...in` include inherited enumerable properties, while `Object.keys` lists own ones only.

There are two exceptions to shadowing:

- if the inherited property is a **setter**, assigning **calls the setter** instead of creating an own property;
- if the inherited property is **non-writable**, the assignment **fails**: silently in non-strict code, with a `TypeError` in strict mode.

```js
const base = {
  set value(v) {
    console.log('setter ran with', v);
  },
};
const child = Object.create(base);
child.value = 1; // "setter ran with 1", and child has no own value
```

## Shared state on the prototype

Because everything on a prototype is shared, putting **objects or arrays** there means every instance shares the **same** one. Mutating it through one instance changes it for all:

```js
function Cart() {}
Cart.prototype.items = [];

const a = new Cart();
const b = new Cart();
a.items.push('apple');
b.items; // ['apple']
```

Per-instance state belongs in the **constructor** (`this.items = []`) or in **class fields**. The prototype is for methods and shared constants.

## Changing prototypes: risks

- **Changing built-in prototypes** such as `Array.prototype` or `Object.prototype` affects **every object** in the program, including library code, and can clash with future language features.
- **Prototype pollution**: code that deep-merges or assigns keys from **untrusted input** can be tricked by a key like `__proto__` into writing onto `Object.prototype`. Every object then inherits the injected property, which attackers can use to change application logic. Defences: skip `__proto__`, `constructor` and `prototype` keys, use `Object.create(null)` or `Map` for dictionaries, and validate input.

```js
const payload = JSON.parse('{"__proto__": {"isAdmin": true}}');
deepMerge({}, payload); // a naive merge writes onto Object.prototype
({}).isAdmin; // true for every object
```
