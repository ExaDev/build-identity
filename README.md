# @exadev/build-identity

[![GitHub](https://img.shields.io/badge/GitHub-181717?logo=github&logoColor=white)](https://github.com/ExaDev/build-identity) [![npm](https://img.shields.io/badge/npm-CB3837?logo=npm&logoColor=white)](https://www.npmjs.com/package/@exadev/build-identity) [![Release](https://img.shields.io/github/v/release/ExaDev/build-identity)](https://github.com/ExaDev/build-identity/releases/latest) [![CI](https://img.shields.io/github/actions/workflow/status/ExaDev/build-identity/ci.yml?branch=main)](https://github.com/ExaDev/build-identity/actions)

> Resolve a build's true identity -- a real, already-tagged release, or the commit it was built from -- from live git state, with an optional predicted-version display layer.

## Why

A build banner or footer link (`v1.4.0`, linking to a release page) is only honest the moment a real release actually exists at that commit. Deriving that label from `package.json` alone, or from a CI environment variable, or from "this is the main branch so it must be the latest release" is exactly how a link to a release page that doesn't exist yet gets shipped -- typically the commit that triggers the release pipeline itself, before the tag and GitHub Release the link points at have actually been created. This package makes that check live and unavoidable: it shells out to git, checks whether the release tag genuinely points at `HEAD` right now, and only then returns a `'release'` identity.

## Getting started

```sh
pnpm add -D @exadev/build-identity
```

```ts
import { resolveBuildIdentity } from '@exadev/build-identity';

const identity = resolveBuildIdentity(process.cwd(), 'exadev/build-identity');
// { kind: 'release', version: '1.4.0', url: 'https://github.com/exadev/build-identity/releases/tag/v1.4.0', date: '2026-09-08T09:12:03+01:00' }
// or, on any commit that isn't itself tagged:
// { kind: 'commit', version: 'a1b2c3d', url: 'https://github.com/exadev/build-identity/commit/a1b2c3d4e5f6...', date: '2026-09-08T09:12:03+01:00' }
```

## `resolveBuildIdentity(repoRoot, repoSlug, options?)`

```ts
type BuildIdentity =
  | { kind: 'release'; version: string; url: string; date: string }
  | { kind: 'commit'; version: string; url: string; date: string };

function resolveBuildIdentity(repoRoot: string, repoSlug: string, options?: ResolveBuildIdentityOptions): BuildIdentity;

interface ResolveBuildIdentityOptions {
  tagName?: (version: string) => string; // defaults to (version) => `v${version}`
}
```

- **`repoRoot`** -- path to the git working tree to inspect. Must contain `package.json` at its root; that file's `"version"` field is the released version this function checks for.
- **`repoSlug`** -- the GitHub `"owner/repo"` slug used to build both the release and commit URLs (e.g. `"exadev/build-identity"`).
- **`options.tagName`** -- turns the version into the tag name expected to mark its release. The default assumes the common `v<version>` convention (`"1.4.0"` -> `"v1.4.0"`); pass your own function for a repo that tags differently (a bare version, a package-scoped prefix in a monorepo, and so on).

**The one property this function exists to guarantee:** it returns `kind: 'release'` if, and only if, a tag named `tagName(version)` provably points at the exact commit `HEAD` is on right now -- checked live against git (`git tag --list <tag> --points-at HEAD`), never inferred from `package.json`, an environment variable, or any other proxy that could be true before the tag actually exists. Every other case, including a commit sitting directly on top of the commit a release will eventually tag, returns `kind: 'commit'` instead, with `version` set to the short commit hash (there is no released version to show yet) and `url` pointing at that exact commit's permalink (using the full SHA, not the short one, so the link stays a valid, unambiguous permalink).

`resolveBuildIdentity` throws rather than defaulting whenever it can't establish a real identity -- `repoRoot` isn't a git repository, `package.json` is missing or has no non-empty string `"version"` field, or `repoSlug` isn't a real `"owner/repo"` slug. There is no sensible placeholder identity for a build that isn't sitting in real, readable git history.

## `resolvePredictedIdentity(build, predictedVersion)`

```ts
function resolvePredictedIdentity(build: BuildIdentity, predictedVersion: string | undefined): BuildIdentity & { predicted?: boolean };
```

An unreleased build's `version` is a short commit hash, which isn't always what you want to show a user -- often what's actually useful is *the version this commit will become once it releases*. This function lets a caller upgrade the displayed label to a predicted version (e.g. computed by running a commit-analyzer-style tool such as `semantic-release`'s own dry-run mode) without ever upgrading the URL to a release page that doesn't exist yet:

- If `build.kind === 'release'`, it is returned **completely unchanged** -- a confirmed release always wins outright, prediction or not.
- Otherwise, when `predictedVersion` is a real, non-empty string, the result's `version` becomes that (trimmed) prediction, `predicted` becomes `true`, and `url`/`date` are copied verbatim from `build` -- the link still points at the real commit.
- With no usable prediction (`undefined`, empty, or whitespace-only), `build` is returned unchanged.

This function does no git or filesystem access of its own -- computing the predicted version is entirely the caller's job, kept deliberately out of this package's core so the one property `resolveBuildIdentity` guarantees stays easy to audit on its own.

```ts
import { resolveBuildIdentity, resolvePredictedIdentity } from '@exadev/build-identity';

const build = resolveBuildIdentity(process.cwd(), 'exadev/build-identity');
const predictedVersion = await computeNextVersionSomehow(); // out of scope for this package
const identity = resolvePredictedIdentity(build, predictedVersion);
```

## Framework-agnosticism

This package does pure Node.js filesystem and git access only -- no bundler, framework, or UI assumptions. Wiring its result into a running app is a build-time concern for whichever bundler that app already uses, done in that bundler's own config file, not in this package.

### Next.js

```ts
// next.config.ts
import { resolveBuildIdentity } from '@exadev/build-identity';
import type { NextConfig } from 'next';

const buildIdentity = resolveBuildIdentity(process.cwd(), 'exadev/example');

const config: NextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_KIND: buildIdentity.kind,
    NEXT_PUBLIC_BUILD_VERSION: buildIdentity.version,
    NEXT_PUBLIC_BUILD_URL: buildIdentity.url,
  },
};

export default config;
```

### Vite

```ts
// vite.config.ts
import { resolveBuildIdentity } from '@exadev/build-identity';
import { defineConfig } from 'vite';

const buildIdentity = resolveBuildIdentity(process.cwd(), 'exadev/example');

export default defineConfig({
  define: {
    __BUILD_KIND__: JSON.stringify(buildIdentity.kind),
    __BUILD_VERSION__: JSON.stringify(buildIdentity.version),
    __BUILD_URL__: JSON.stringify(buildIdentity.url),
  },
});
```

Either way, the values are inlined at build time -- the running app never shells out to git itself, and `resolveBuildIdentity`/`resolvePredictedIdentity` never ship as part of the app's own bundle.

## Conventions

British English throughout. Conventional commits, enforced by commitlint (`commitlint.config.ts`) and released automatically by `semantic-release` (`release.config.ts`) on every push to `main`. Strict TypeScript, no `any`, no type assertions -- see `eslint.config.ts`, which lints this package with `@exadev/eslint-config`.

## Publishing

Releases are handled entirely by `.github/workflows/ci.yml`'s `release` job: `semantic-release` analyses commits since the last tag, bumps the version, publishes to npmjs.org over OIDC trusted publishing (no stored `NPM_TOKEN`), and creates the tag and GitHub Release. See that workflow for the exact steps, and `CONTRIBUTING.md` for what a brand-new trusted-publish package needed once, by hand, before that automation could run unattended.
