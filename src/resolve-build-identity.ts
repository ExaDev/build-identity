import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getHeadCommit, tagPointsAtHead } from './git';
import type { BuildIdentity, ResolveBuildIdentityOptions } from './types';

const REPO_SLUG_PATTERN = /^[^/\s]+\/[^/\s]+$/;

function defaultTagName(version: string): string {
  return `v${version}`;
}

function isPackageJsonWithVersion(value: unknown): value is { version: string } {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  if (!('version' in value)) {
    return false;
  }
  return typeof value.version === 'string' && value.version.length > 0;
}

function readPackageVersion(repoRoot: string): string {
  const packageJsonPath = join(repoRoot, 'package.json');
  const raw = readFileSync(packageJsonPath, 'utf8');
  const parsed: unknown = JSON.parse(raw);
  if (!isPackageJsonWithVersion(parsed)) {
    throw new Error(`${packageJsonPath} must contain a non-empty string "version" field`);
  }
  return parsed.version;
}

function assertRepoSlug(repoSlug: string): void {
  if (!REPO_SLUG_PATTERN.test(repoSlug)) {
    throw new Error(`repoSlug must be a GitHub "owner/repo" slug, got: ${JSON.stringify(repoSlug)}`);
  }
}

/**
 * Resolves what the current build actually is: a real, already-tagged release, or a build made from a commit that hasn't been released yet.
 *
 * This is the one property the whole package exists to guarantee: `kind: 'release'` is returned if and only if a tag named `tagName(version)` (default `v${version}`) provably points at the exact commit HEAD is on right now. This is checked live against git, never inferred from `package.json` alone, a CI environment variable, or any other proxy that could be true before the tag actually exists. A caller can render `url` as a link the moment it gets a result back, in either case, without first checking whether that link is real.
 *
 * @param repoRoot Path to the git working tree to inspect (must contain `package.json` at its root).
 * @param repoSlug The GitHub `owner/repo` slug used to build both release and commit URLs.
 */
export function resolveBuildIdentity(repoRoot: string, repoSlug: string, options: ResolveBuildIdentityOptions = {}): BuildIdentity {
  assertRepoSlug(repoSlug);
  const version = readPackageVersion(repoRoot);
  const tagName = (options.tagName ?? defaultTagName)(version);
  const head = getHeadCommit(repoRoot);

  if (tagPointsAtHead(repoRoot, tagName)) {
    return {
      kind: 'release',
      version,
      url: `https://github.com/${repoSlug}/releases/tag/${tagName}`,
      date: head.date,
    };
  }

  return {
    kind: 'commit',
    version: head.shortSha,
    url: `https://github.com/${repoSlug}/commit/${head.fullSha}`,
    date: head.date,
  };
}
