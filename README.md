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
// { kind: 'release', version: '1.4.0', url: 'https://github.com/exadev/build-identity/releases/tag/v1.4.0', date: '2026-09-08T09:12:03+01:00', commit: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2' }
// or, on any commit that isn't itself tagged:
// { kind: 'commit', version: 'a1b2c3d', url: 'https://github.com/exadev/build-identity/commit/a1b2c3d4e5f6...', date: '2026-09-08T09:12:03+01:00', commit: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2' }
```

The same thing is available as a command, for build and deploy steps that cannot import anything -- see [`build-identity` (CLI)](#build-identity-cli).

## `resolveBuildIdentity(repoRoot, repoSlug, options?)`

```ts
type BuildIdentity =
  | { kind: 'release'; version: string; url: string; date: string; commit: string }
  | { kind: 'commit'; version: string; url: string; date: string; commit: string };

function resolveBuildIdentity(repoRoot: string, repoSlug: string, options?: ResolveBuildIdentityOptions): BuildIdentity;

interface ResolveBuildIdentityOptions {
  tagName?: (version: string) => string; // defaults to (version) => `v${version}`
}
```

- **`repoRoot`** -- path to the git working tree to inspect. Must contain `package.json` at its root; that file's `"version"` field is the released version this function checks for.
- **`repoSlug`** -- the GitHub `"owner/repo"` slug used to build both the release and commit URLs (e.g. `"exadev/build-identity"`).
- **`options.tagName`** -- turns the version into the tag name expected to mark its release. The default assumes the common `v<version>` convention (`"1.4.0"` -> `"v1.4.0"`); pass your own function for a repo that tags differently (a bare version, a package-scoped prefix in a monorepo, and so on).

**The one property this function exists to guarantee:** it returns `kind: 'release'` if, and only if, a tag named `tagName(version)` provably points at the exact commit `HEAD` is on right now -- checked live against git (`git tag --list <tag> --points-at HEAD`), never inferred from `package.json`, an environment variable, or any other proxy that could be true before the tag actually exists. Every other case, including a commit sitting directly on top of the commit a release will eventually tag, returns `kind: 'commit'` instead, with `version` set to the short commit hash (there is no released version to show yet) and `url` pointing at that exact commit's permalink (using the full SHA, not the short one, so the link stays a valid, unambiguous permalink).

**`commit`** is always the full git commit SHA of the exact commit this build resolves to, in both branches -- present so a caller who needs the raw SHA (to compare two builds for identity, or to construct its own link) never has to parse it back out of `url`, which never carries one at all in the `'release'` case.

`resolveBuildIdentity` throws rather than defaulting whenever it can't establish a real identity -- `repoRoot` isn't a git repository, `package.json` is missing or has no non-empty string `"version"` field, or `repoSlug` isn't a real `"owner/repo"` slug. There is no sensible placeholder identity for a build that isn't sitting in real, readable git history.

## `resolvePredictedIdentity(build, predictedVersion)`

```ts
type DisplayIdentity = { kind: 'release' | 'predicted' | 'commit'; version: string; url: string; date: string; commit: string };

function resolvePredictedIdentity(build: BuildIdentity, predictedVersion: string | undefined): DisplayIdentity;
```

An unreleased build's `version` is a short commit hash, which isn't always what you want to show a user -- often what's actually useful is *the version this commit will become once it releases*. This function lets a caller upgrade the displayed label to a predicted version (e.g. computed by `predictNextVersion`, below, or `semantic-release`'s own dry-run mode) without ever upgrading the URL to a release page that doesn't exist yet:

- If `build.kind === 'release'`, it is returned **completely unchanged** -- a confirmed release always wins outright, prediction or not.
- Otherwise, when `predictedVersion` is a real, non-empty string, the result is `kind: 'predicted'` with `version` set to that (trimmed) prediction -- `url`/`date`/`commit` are copied verbatim from `build`, still describing the real commit.
- With no usable prediction (`undefined`, empty, or whitespace-only), `build` is returned unchanged.

This function does no git or filesystem access of its own -- computing the predicted version is entirely the caller's job, kept deliberately out of this package's core so the one property `resolveBuildIdentity` guarantees stays easy to audit on its own.

```ts
import { resolveBuildIdentity, resolvePredictedIdentity, predictNextVersion, loadCommitAnalyzer } from '@exadev/build-identity';

const build = resolveBuildIdentity(process.cwd(), 'exadev/build-identity');
const predictedVersion = await predictNextVersion(process.cwd(), releaseRules, await loadCommitAnalyzer());
const identity = resolvePredictedIdentity(build, predictedVersion);
```

## `predictNextVersion(repoRoot, releaseRules, analyzeCommits, options?)`

```ts
type ReleaseLevel = 'major' | 'minor' | 'patch';
type ReleaseRule = { type: string; release: ReleaseLevel | false } | { breaking: true; release: ReleaseLevel | false };
type AnalyzeCommits = (pluginConfig: unknown, context: unknown) => Promise<unknown>;

function predictNextVersion(repoRoot: string, releaseRules: readonly ReleaseRule[], analyzeCommits: AnalyzeCommits, options?: PredictNextVersionOptions): Promise<string | undefined>;

interface PredictNextVersionOptions {
  tagName?: (version: string) => string; // matches resolveBuildIdentity's own option of the same name
  logger?: { log: (...args: unknown[]) => void; error: (...args: unknown[]) => void }; // defaults to discarding
}
```

Predicts the version a repo's next release would be, from the commits since its last tagged release -- **without** running `semantic-release`'s own top-level orchestrator. That orchestrator verifies push access to the remote as part of resolving branches before analysis ever runs, on every call, dry-run or not -- slow, and needing credentials a prediction has no real reason to hold. `predictNextVersion` instead calls `@semantic-release/commit-analyzer`'s own `analyzeCommits` hook directly: no network, no registry lookups, no push check.

`releaseRules` is your own repo's commit-type-to-release-level convention (the same shape `@semantic-release/commit-analyzer`'s own `releaseRules` option takes) -- this package hardcodes none of its own.

Returns `undefined` when there is genuinely no predicted release -- no commits since the last tag, or none of them are release-worthy -- the same "nothing to report" case `resolvePredictedIdentity` already treats as valid, not an error. Throws for a genuine setup problem instead of defaulting: `repoRoot` isn't a git repository, or `package.json` has no usable version.

**`analyzeCommits`** is supplied by the caller rather than imported by this package: `@semantic-release/commit-analyzer` ships no type declarations and `analyzeCommits` isn't part of its documented public API, so loading it safely is a concern specific to your own toolchain. `predictNextVersion` itself stays a pure function of its arguments -- easy to test with a fake analyzer.

## `loadCommitAnalyzer()`

```ts
function loadCommitAnalyzer(): Promise<AnalyzeCommits>;
```

The tested, correct way to obtain a real `analyzeCommits` for `predictNextVersion` above -- the one place in this package that actually loads `@semantic-release/commit-analyzer`. `@semantic-release/commit-analyzer` is an **optional peer dependency**: install it yourself if you use this function (or `predictNextVersion`); every other export in this package works without it. Throws a clear error, rather than a bare "Cannot find module", when it isn't installed or doesn't export `analyzeCommits`.

```ts
import { resolveBuildIdentity, resolvePredictedIdentity, predictNextVersion, loadCommitAnalyzer } from '@exadev/build-identity';

const releaseRules = [
  { breaking: true, release: 'major' },
  { type: 'feat', release: 'minor' },
  { type: 'fix', release: 'patch' },
];

const build = resolveBuildIdentity(process.cwd(), 'exadev/build-identity');
const predictedVersion = await predictNextVersion(process.cwd(), releaseRules, await loadCommitAnalyzer());
const identity = resolvePredictedIdentity(build, predictedVersion);
```

## `build-identity` (CLI)

The same three functions, wired together, as a command. It exists for build and deploy steps that are a shell invocation rather than a JavaScript config file, so nothing in them can `import` this package at all -- `wrangler deploy --var RELEASE_VERSION:...` being the case it was built for. A step that *is* a JavaScript config file (`next.config.ts`, `vite.config.ts`) should import the functions directly instead; see [Framework-agnosticism](#framework-agnosticism) below.

```sh
pnpm add -D @exadev/build-identity
pnpm exec build-identity --repo exadev/build-identity
```

```
Usage: build-identity [options]

Options:
  -V, --version                output the version number
  --repo <owner/repo>          GitHub slug used to build the release and commit URLs
  --root <directory>           git working tree to inspect (default: the current working directory)
  --tag-name <template>        tag name marking a release, with {version} standing in for the version (default: v{version})
  --predict                    also predict the version this commit's next release would be
  --release-rules <json>       commit-analyzer release rules for --predict, as a JSON array
  --release-rules-file <path>  file holding the same JSON array as --release-rules
  --format <format>            output format: json or env (default: "json")
  --prefix <prefix>            prepended to each variable name in --format env (default: "BUILD_")
  --verbose                    send commit-analyzer's own per-commit narration to stderr
  -h, --help                   display help for command
```

`--repo` is the only required flag, and the command's whole output is a single `DisplayIdentity` on stdout:

```sh
$ build-identity --repo exadev/build-identity
{
  "kind": "commit",
  "version": "a1b2c3d",
  "url": "https://github.com/exadev/build-identity/commit/a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
  "date": "2026-09-08T09:12:03+01:00",
  "commit": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2"
}
```

Those are exactly the five fields `DisplayIdentity` declares, under exactly its own names -- there is no CLI-specific shape and no consumer-specific naming. In particular there is no separate `predicted` boolean: `kind` is already `"predicted"` in precisely that case, and a second field asserting the same fact would just be one more thing that could disagree with the first.

### Prediction

`--predict` adds the `predictNextVersion` step, turning an unreleased build's short commit hash into the version that commit would release as. It is opt-in rather than automatic because it costs something real: it needs `@semantic-release/commit-analyzer` (this package's optional peer dependency) to be installed, and it reads every commit since the last tag.

Release rules are yours, not this package's -- your repo's commit-type-to-release-level convention is real configuration, and nothing here invents a default for it. Pass them inline, or from a file when quoting a full rule set through YAML and a shell gets unreadable:

```sh
build-identity --repo exadev/build-identity --predict \
  --release-rules '[{"breaking":true,"release":"major"},{"type":"feat","release":"minor"},{"type":"fix","release":"patch"}]'

build-identity --repo exadev/build-identity --predict --release-rules-file release-rules.json
```

A confirmed release still wins outright: on a commit an actual release tag points at, `--predict` changes nothing at all.

### `--format env`

```sh
$ build-identity --repo exadev/build-identity --format env --prefix RELEASE_
RELEASE_KIND=commit
RELEASE_VERSION=a1b2c3d
RELEASE_URL=https://github.com/exadev/build-identity/commit/a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2
RELEASE_DATE=2026-09-08T09:12:03+01:00
RELEASE_COMMIT=a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2
```

The variable names are the same generic field names, upper-cased, behind a prefix of your choosing. This format is deliberately additional surface rather than "emit JSON and document a `jq` one-liner": appending to `$GITHUB_ENV` is the realistic use for both of the cases that motivated this CLI, and the one-liner alternative would put a `jq` dependency and a quoting-sensitive shell expression into every consumer's workflow to produce output this package can simply print. A value containing a line break is refused outright rather than emitted, since it would silently swallow or inject `$GITHUB_ENV` entries.

```yaml
- name: Resolve the build's identity
  run: pnpm exec build-identity --repo my-org/my-repo --predict --release-rules-file release-rules.json --format env --prefix RELEASE_ >> "$GITHUB_ENV"

- name: Deploy
  run: wrangler deploy --var RELEASE_VERSION:$RELEASE_VERSION --var RELEASE_COMMIT:$RELEASE_COMMIT
```

Where a repo's own variable names differ from the generic ones, map them in that repo's own workflow rather than expecting this package to know them -- `--prefix` covers most of it, and `jq` covers the rest:

```sh
echo "MY_OWN_VERSION_NAME=$(build-identity --repo my-org/my-repo | jq -r .version)" >> "$GITHUB_ENV"
```

`--verbose` routes commit-analyzer's own per-commit narration to **stderr**, never stdout, so it is always safe to pipe or capture stdout while debugging why a prediction came out as it did.

The CLI is the one part of this package with a runtime dependency (`commander`, itself dependency-free). It is bundled into `dist/cli.js` alone: importing the library never loads it.

## Framework-agnosticism

This package does pure Node.js filesystem and git access only -- no bundler, framework, or UI assumptions. Wiring its result into a running app is a build-time concern for whichever bundler that app already uses, done in that bundler's own config file, not in this package.

**A config file that is itself JavaScript does not need the CLI** -- it can import the functions directly, which is both simpler and better typed than shelling out and parsing JSON back. Reach for `build-identity` (above) only where there is genuinely nothing to import from: a `wrangler deploy --var ...` line, a `docker build --build-arg ...` line, a plain `sh` deploy script.

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

Either way, the values are inlined at build time -- the running app never shells out to git itself, and `resolveBuildIdentity`/`resolvePredictedIdentity`/`predictNextVersion`/`loadCommitAnalyzer` never ship as part of the app's own bundle.

## Conventions

British English throughout. Conventional commits, enforced by commitlint (`commitlint.config.ts`) and released automatically by `semantic-release` (`release.config.ts`) on every push to `main`. Strict TypeScript, no `any`, no type assertions -- see `eslint.config.ts`, which lints this package with `@exadev/eslint-config`.

## Publishing

Releases are handled entirely by `.github/workflows/ci.yml`'s `release` job: `semantic-release` analyses commits since the last tag, bumps the version, publishes to npmjs.org over OIDC trusted publishing (no stored `NPM_TOKEN`), and creates the tag and GitHub Release. See that workflow for the exact steps, and `CONTRIBUTING.md` for what a brand-new trusted-publish package needed once, by hand, before that automation could run unattended.
