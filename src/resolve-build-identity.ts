import { getHeadCommit, tagPointsAtHead } from './git';
import { DEFAULT_TAG_TEMPLATE, findLastRelease } from './release-tags';
import type { BuildIdentity, ResolveBuildIdentityOptions } from './types';

const REPO_SLUG_PATTERN = /^[^/\s]+\/[^/\s]+$/;

function assertRepoSlug(repoSlug: string): void {
  if (!REPO_SLUG_PATTERN.test(repoSlug)) {
    throw new Error(`repoSlug must be a GitHub "owner/repo" slug, got: ${JSON.stringify(repoSlug)}`);
  }
}

/**
 * Resolves what the current build actually is: a real, already-tagged release, or a build made from a commit that hasn't been released yet.
 *
 * This is the one property the whole package exists to guarantee: `kind: 'release'` is returned if and only if the last release reachable from HEAD (`findLastRelease`: the highest release tag in `options.tagTemplate`, default `v{version}`) provably points at the exact commit HEAD is on right now, checked live against git -- never inferred from a version recorded in a file such as `package.json`, a CI environment variable, or any other proxy that could be true before the tag actually exists. The released version is read from that tag. A caller can render `url` as a link the moment it gets a result back, in either case, without first checking whether that link is real.
 * @param repoRoot - Path to the git working tree to inspect.
 * @param repoSlug - The GitHub `owner/repo` slug used to build both release and commit URLs.
 */
export function resolveBuildIdentity(repoRoot: string, repoSlug: string, options: ResolveBuildIdentityOptions = {}): BuildIdentity {
  assertRepoSlug(repoSlug);
  const lastRelease = findLastRelease(repoRoot, options.tagTemplate ?? DEFAULT_TAG_TEMPLATE);
  const head = getHeadCommit(repoRoot);

  if (lastRelease !== undefined && tagPointsAtHead(repoRoot, lastRelease.tagName)) {
    return {
      kind: 'release',
      version: lastRelease.version,
      url: `https://github.com/${repoSlug}/releases/tag/${lastRelease.tagName}`,
      date: head.date,
      commit: head.fullSha,
    };
  }

  return {
    kind: 'commit',
    version: head.shortSha,
    url: `https://github.com/${repoSlug}/commit/${head.fullSha}`,
    date: head.date,
    commit: head.fullSha,
  };
}
