import { getHeadCommit, listTagsPointingAtHead } from './git';
import { DEFAULT_TAG_TEMPLATE, highestReleaseTag } from './release-tags';
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
 * This is the one property the whole package exists to guarantee: `kind: 'release'` is returned if and only if a release tag (a tag `options.tagTemplate`, default `v{version}`, produces from a plain `major.minor.patch` version) provably points at the exact commit HEAD is on right now, checked live against git (`git tag --points-at HEAD`), never inferred from a version recorded in a file such as `package.json`, a CI environment variable, or any other proxy that could be true before the tag actually exists. The released version is read from that tag; when several release tags point at HEAD, the highest wins. That holds even when a higher release is reachable elsewhere in history, such as a backport tagged after a newer release.
 *
 * Only HEAD is inspected, never its history, so this works in a shallow clone. A clone made without tags has no tag at HEAD to find and reports `kind: 'commit'`, the honest answer for a release git cannot see, and never throws for it. A caller can render `url` as a link the moment it gets a result back, in either case, without first checking whether that link is real.
 * @param repoRoot - Path to the git working tree to inspect.
 * @param repoSlug - The GitHub `owner/repo` slug used to build both release and commit URLs.
 */
export function resolveBuildIdentity(repoRoot: string, repoSlug: string, options: ResolveBuildIdentityOptions = {}): BuildIdentity {
  assertRepoSlug(repoSlug);
  const template = options.tagTemplate ?? DEFAULT_TAG_TEMPLATE;
  const head = getHeadCommit(repoRoot);
  const release = highestReleaseTag(template, listTagsPointingAtHead(repoRoot));

  if (release !== undefined) {
    return {
      kind: 'release',
      version: release.version,
      url: `https://github.com/${repoSlug}/releases/tag/${release.tagName}`,
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
