## Server-side JSX for Deno

A simple JSX library for server-side rendering with Deno.

Supports only functional components. Asynchronous components are resolved concurrently.

#### Basic example
```jsx
/** @jsx h */
/** @jsxFrag Fragment */
import { Fragment, h, renderJSX } from "./mod.js";

const html = await renderJSX(
  <h1>Hello World 😎</h1>
);
```

#### Async component
```jsx
/** @jsx h */
/** @jsxFrag Fragment */
import { Fragment, h, renderJSX } from "./mod.js";

const Welcome = async function ({userId}) {
  const user = await findUser(userId)
  return (<span>Welcome, {user.name}!</span>)
}

const html = await renderJSX(
  <>
    <Welcome userId={id} />
  </>
);
```
---

##### TODO
- append 'px' to numeric values (except for unitless props)
- write more tests
