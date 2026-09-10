# Releasing create-expo-app

An existing npm maintainer must publish this package. GitHub repository access
does not grant npm publishing access. Use a supported Node.js LTS release and
complete npm's authentication prompts when publishing or changing tags.

## Prepare the release

Start from a clean checkout of the merged commit whose compatibility CI passed.
For the initial shim release, `package.json` must contain version `5.0.0`.

```sh
npm whoami
npm access list collaborators create-expo-app
npm view create-expo-app dist-tags --json
npm test
npm pack
npm publish ./create-expo-app-5.0.0.tgz --dry-run --tag shim
```

Check that the archive contains only `index.js`, `package.json`, `README.md`,
and `LICENSE`. Its runtime dependency must be `create-expo >=5.0.1`, and both
`bin` and `main` must point to `index.js`. Keep this tarball for publication.

Record the current `latest` version before proceeding. At the time this guide
was written it was `4.0.0`; use the registry output as the source of truth.

## Publish under the shim tag

Publish the tarball reviewed above:

```sh
npm publish ./create-expo-app-5.0.0.tgz --tag shim
npm view create-expo-app@5.0.0 version dependencies bin main engines --json
npm view create-expo-app dist-tags --json
```

The `shim` tag exposes the package for testing while `latest` continues to point
to its previous version. The package is public at this point, and its version
number cannot be reused. Always pass `--tag shim` when publishing the tarball.

From a new temporary directory, check the published package:

```sh
npx --yes create-expo-app@5.0.0 --help
npx --yes create-expo-app@5.0.0 --version
npx --yes create-expo-app@5.0.0 smoke-app --template blank --no-install --yes
```

Confirm that `smoke-app/package.json` exists, `smoke-app/node_modules` does not,
and `--version` reports the resolved `create-expo` version.

## Promote the tested version

Promote the same package version after the published-package checks pass:

```sh
npm dist-tag add create-expo-app@5.0.0 latest
npm view create-expo-app dist-tags --json
npx --yes create-expo-app@latest --version
```

This changes the default release without publishing another tarball. Leave
historical versions and unrelated tags available. If promotion exposes a
problem, point `latest` back to the version recorded before the release using
`npm dist-tag add create-expo-app@<previous-version> latest`.

The shim's dependency resolves at installation time. Cached installations may
keep an older `create-expo` version even after a new core release.
