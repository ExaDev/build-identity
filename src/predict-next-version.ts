import { execFileSync } from 'node:child_process';
import { defaultTagName, readPackageVersion } from './package-version';

const GIT_FORMAT = '%x00%H%x00%B';
const FIELD_SEP = '\x00';

export interface RawCommit {
  readonly hash: string;
  readonly message: string;
}

/**
 * Pure parsing of `git log --format=%x00%H%x00%B` output -- split out so it's testable against a raw string fixture with no real git process. NUL is git's own pretty-format escape for a real NUL byte, the one byte git guarantees can never appear inside a commit hash or message (git refuses to store one), making it the only delimiter genuinely safe against arbitrary commit content. Each record is `<hash><NUL><message>`, with a leading NUL on the whole format string, so splitting the entire raw output on NUL and dropping the resulting leading empty token leaves an exact (hash, message) pairing for every commit. Git appends its own trailing newline per record (tformat behaviour); trim() absorbs it the same way it absorbs genuine trailing blank lines in a real commit body.
 */
export function parseGitLogOutput(raw: string): RawCommit[] {
  const tokens = raw.split(FIELD_SEP);
  tokens.shift();
  const commits: RawCommit[] = [];
  for (let index = 0; index < tokens.length; index += 2) {
    commits.push({ hash: tokens[index] ?? '', message: (tokens[index + 1] ?? '').trim() });
  }
  return commits;
}

function readCommitsSince(repoRoot: string, sinceTag: string): RawCommit[] {
  const raw = execFileSync('git', ['log', `${sinceTag}..HEAD`, `--format=${GIT_FORMAT}`], { cwd: repoRoot, encoding: 'utf-8' });
  return parseGitLogOutput(raw);
}

export type ReleaseLevel = 'major' | 'minor' | 'patch';

export function isReleaseLevel(value: unknown): value is ReleaseLevel {
  return value === 'major' || value === 'minor' || value === 'patch';
}

/** One @semantic-release/commit-analyzer release rule -- either `{ type, release }` (a conventional-commit type, e.g. `"feat"`) or `{ breaking: true, release }` (any commit whose footer/body declares a breaking change, regardless of type). `release` also accepts `false`, commit-analyzer's own way to say "this type never triggers a release" -- needed to override a broader rule or preset default, distinct from simply omitting the type (which instead falls through to whatever the preset's own default is). This package hardcodes no rules of its own: a repo's commit-type-to-release-level convention is real, repo-specific configuration. */
export type ReleaseRule = { readonly type: string; readonly release: ReleaseLevel | false } | { readonly breaking: true; readonly release: ReleaseLevel | false };

/**
 * The shape of `@semantic-release/commit-analyzer`'s own `analyzeCommits` plugin hook -- untyped and undocumented as a standalone export (it exists only because semantic-release's own core loads plugins dynamically), so this package can promise no more about it than "callable with these two arguments, returns a promise." `predictNextVersion` takes an implementation of this type as a parameter, rather than loading `@semantic-release/commit-analyzer` itself, so it stays a pure function of its own arguments -- trivially testable with a fake analyzer, exactly how this file's own tests exercise it. `./load-commit-analyzer`'s `loadCommitAnalyzer` is the tested, correct way to obtain a real one; pass its result straight through when you don't need a different implementation.
 */
export type AnalyzeCommits = (pluginConfig: unknown, context: unknown) => Promise<unknown>;

/** A trivial major.minor.patch increment -- every version this package works with is a plain X.Y.Z, never a prerelease or build-metadata identifier (see `resolveBuildIdentity`'s own tag convention), so there is no broader semver grammar here worth delegating to a library for. */
export function bumpVersion(version: string, releaseType: ReleaseLevel): string {
  const [major = 0, minor = 0, patch = 0] = version.split('.').map(Number);
  if (releaseType === 'major') return `${String(major + 1)}.0.0`;
  if (releaseType === 'minor') return `${String(major)}.${String(minor + 1)}.0`;
  return `${String(major)}.${String(minor)}.${String(patch + 1)}`;
}

export interface PredictNextVersionOptions {
  /** Matches `resolveBuildIdentity`'s own option of the same name -- pass the same function to both when a repo tags non-default, so "which tag marks the last release" stays one convention rather than two that could drift apart. Defaults to the `v${version}` convention. */
  tagName?: (version: string) => string;
  /** Receives @semantic-release/commit-analyzer's own per-commit narration (e.g. "Analyzing commit: ...", "The release type for the commit is minor"). Defaults to discarding it. Pass your own to route it to stderr or a real logger -- never stdout, so a caller parsing a single predicted-version line from this process's own stdout is never at risk of it being contaminated. */
  logger?: { log: (...args: readonly unknown[]) => void; error: (...args: readonly unknown[]) => void };
}

const NOOP_LOGGER = { log: (): void => undefined, error: (): void => undefined };

/**
 * Predicts the version this repo's next release would be, from commits since the last tagged release -- WITHOUT running semantic-release's own top-level orchestrator. That orchestrator's core (not any plugin) verifies push access to the remote as part of resolving branches before analysis ever runs: genuinely slow, and needing credentials a prediction has no real reason to hold. This calls `analyzeCommits` directly instead -- no network, no registry lookups -- exactly the same hook `@semantic-release/commit-analyzer` exports, supplied by the caller (see `AnalyzeCommits`'s own doc comment for why this package never imports that module itself).
 *
 * Returns `undefined` when there is genuinely no predicted release -- no commits since the last tag, or none of them are release-worthy under `releaseRules` -- the same "nothing to report" case `resolvePredictedIdentity` already treats as valid, not an error. Throws for a genuine setup problem instead of defaulting: `repoRoot` isn't a git repository, or `package.json` has no usable version.
 *
 * @param repoRoot Path to the git working tree to inspect (must contain `package.json` at its root, same as `resolveBuildIdentity`).
 * @param releaseRules The commit-analyzer release rules this repo's own commit convention defines.
 * @param analyzeCommits `@semantic-release/commit-analyzer`'s own `analyzeCommits` export -- `loadCommitAnalyzer` (`./load-commit-analyzer`) is the tested way to obtain one.
 */
export async function predictNextVersion(repoRoot: string, releaseRules: readonly ReleaseRule[], analyzeCommits: AnalyzeCommits, options: PredictNextVersionOptions = {}): Promise<string | undefined> {
  const lastVersion = readPackageVersion(repoRoot);
  const tagName = (options.tagName ?? defaultTagName)(lastVersion);
  const logger = options.logger ?? NOOP_LOGGER;

  const commits = readCommitsSince(repoRoot, tagName);
  if (commits.length === 0) {
    return undefined;
  }

  const releaseType: unknown = await analyzeCommits({ releaseRules: releaseRules.map((rule) => ({ ...rule })) }, { commits, logger, cwd: repoRoot });

  if (!isReleaseLevel(releaseType)) {
    return undefined;
  }

  return bumpVersion(lastVersion, releaseType);
}
