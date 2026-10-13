import { isShallowRepository, listTagsMergedIntoHead } from './git';

/** Stands in for the version inside a tag template. The same placeholder the CLI's `--tag-name` takes, so one template string works in both places. */
export const VERSION_PLACEHOLDER = '{version}';

/** The `v<version>` convention semantic-release's own default `tagFormat` and GitHub's release UI both use. */
export const DEFAULT_TAG_TEMPLATE = `v${VERSION_PLACEHOLDER}`;

/** A plain `major.minor.patch` release version, as semver writes it (no leading zeros). Prerelease and build-metadata versions are not releases of a release branch, so a tag carrying one is never the last release. */
const RELEASE_VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

/** The most recent release reachable from HEAD: its version, and the tag that marks it. */
export interface LastRelease {
  readonly version: string;
  readonly tagName: string;
}

/**
 * Throws unless `template` contains the version placeholder exactly once: with none, every release would share one tag name, and with two or more a tag name could not be read back into a single version.
 */
export function assertTagTemplate(template: string): void {
  if (template.split(VERSION_PLACEHOLDER).length !== 2) {
    throw new Error(`a tag template must contain the ${VERSION_PLACEHOLDER} placeholder exactly once, got: ${JSON.stringify(template)}`);
  }
}

/** The release version `tagName` marks under `template`, or `undefined` when the tag is not a release tag in that template (a different prefix, a prerelease, not a version at all). */
export function parseReleaseTag(template: string, tagName: string): string | undefined {
  assertTagTemplate(template);
  const placeholderAt = template.indexOf(VERSION_PLACEHOLDER);
  const prefix = template.slice(0, placeholderAt);
  const suffix = template.slice(placeholderAt + VERSION_PLACEHOLDER.length);
  if (tagName.length < prefix.length + suffix.length || !tagName.startsWith(prefix) || !tagName.endsWith(suffix)) {
    return undefined;
  }
  const version = tagName.slice(prefix.length, tagName.length - suffix.length);
  return RELEASE_VERSION_PATTERN.test(version) ? version : undefined;
}

function releaseVersionParts(version: string): readonly [number, number, number] {
  const [, major, minor, patch] = RELEASE_VERSION_PATTERN.exec(version) ?? [];
  if (major === undefined || minor === undefined || patch === undefined) {
    throw new Error(`not a plain major.minor.patch release version: ${JSON.stringify(version)}`);
  }
  return [Number(major), Number(minor), Number(patch)];
}

/** Orders two release versions by semver precedence: negative when `a` is lower, positive when higher, zero when equal. Throws when either is not a plain `major.minor.patch` release version. */
export function compareReleaseVersions(a: string, b: string): number {
  const [leftMajor, leftMinor, leftPatch] = releaseVersionParts(a);
  const [rightMajor, rightMinor, rightPatch] = releaseVersionParts(b);
  return leftMajor - rightMajor || leftMinor - rightMinor || leftPatch - rightPatch;
}

/** The highest release among `tagNames` under `template`, by semver precedence rather than list or creation order, ignoring every tag that is not a release in that template. */
export function highestReleaseTag(template: string, tagNames: readonly string[]): LastRelease | undefined {
  assertTagTemplate(template);
  let highest: LastRelease | undefined;
  for (const tagName of tagNames) {
    const version = parseReleaseTag(template, tagName);
    if (version !== undefined && (highest === undefined || compareReleaseVersions(version, highest.version) > 0)) {
      highest = { version, tagName };
    }
  }
  return highest;
}

/**
 * Finds the last release the way semantic-release's own core does: the highest release version among the tags in `template` that are reachable from HEAD (`git tag --merged HEAD`). A tag on a commit HEAD does not contain, such as a release cut from another branch, is never the last release of this one.
 *
 * Throws rather than returning a guess, saying what to do, because a caller predicting the next version from a wrong base would name a version that may already exist as a tag:
 * - in a shallow clone, even when some release tag is visible, since a higher one could sit beyond the cut;
 * - when no release tag is reachable from HEAD, which is what a clone made without its tags looks like, as much as a repository that has never released;
 * - when `repoRoot` is not a git repository or `template` is malformed.
 * @param repoRoot - Path to the git working tree to inspect.
 * @param template - The tag template releases are tagged with; defaults to `v{version}`.
 */
export function findLastRelease(repoRoot: string, template: string = DEFAULT_TAG_TEMPLATE): LastRelease {
  assertTagTemplate(template);
  if (isShallowRepository(repoRoot)) {
    throw new Error(
      `${repoRoot} is a shallow clone, so the last release tag reachable from HEAD cannot be determined: fetch the full history and tags first (git fetch --unshallow --tags, or actions/checkout with fetch-depth: 0)`,
    );
  }
  const release = highestReleaseTag(template, listTagsMergedIntoHead(repoRoot));
  if (release === undefined) {
    throw new Error(
      `no tag reachable from HEAD in ${repoRoot} marks a release under the tag template ${JSON.stringify(template)}: if the repository has released before, fetch its tags (git fetch --tags, or actions/checkout with fetch-depth: 0) or pass the template it actually tags with`,
    );
  }
  return release;
}
