# create-expo-app

Compatibility wrapper for [create-expo](https://www.npmjs.com/package/create-expo).
Existing commands continue to work:

```sh
npx create-expo-app my-app
```

For new projects, use the maintained package directly:

```sh
npx create-expo@latest my-app
```

## How it works

The executable and package entry point load `create-expo` in the same Node.js
process. Arguments, environment variables, terminal input, and exit codes pass
through to the underlying CLI. Help and version output come from `create-expo`.

The runtime dependency is `create-expo >=5.0.1`. Version 5.0.1 includes support for
npm 12's `npm pack --json` output. The range permits future major releases, which
may change CLI behavior or Node.js requirements.

This wrapper requires Node.js 20 or newer. The underlying `create-expo@5.0.1`
fails during project creation on Node.js 18 because it uses the global `File`
API, despite declaring a lower minimum in its package metadata.

The dependency is resolved at installation time. npm can reuse an installed or
cached copy without refreshing its dependencies, including when invoking
`create-expo-app@latest`. This wrapper does not update itself on every invocation.

## Development

Run the package checks with Node.js and npm:

```sh
npm test
```

The tests pack this repository, install the tarball and its runtime dependency
in a temporary directory, and exercise the installed executable and package
entry point. They also create a project from a local template with
`--no-install`, checking that arguments and package-manager identity reach the
underlying CLI. They require access to the npm registry and remove their
temporary files when finished.

To test another installed package manager on macOS or Linux:

```sh
SHIM_TEST_PACKAGE_MANAGER=pnpm npm test
SHIM_TEST_PACKAGE_MANAGER=yarn npm test
SHIM_TEST_PACKAGE_MANAGER=bun npm test
```

CI covers npm 9 on the minimum Node.js version, npm 12 on Linux, macOS, and
Windows, and pnpm 10, Yarn Classic, Yarn Berry, and Bun on Linux. Yarn Berry
uses its `node-modules` linker in these tests.
