# create-expo-app

Compatibility shim that forwards `create-expo-app` to
[create-expo](https://www.npmjs.com/package/create-expo).

For new projects, use `create-expo` directly:

```sh
npx create-expo@latest my-app
```

The shim resolves `create-expo` at install time. Cached installations can keep
an older version.

## Tests

```sh
npm test
```
