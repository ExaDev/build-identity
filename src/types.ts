/**
 * What a build actually is, as far as git can prove it right now.
 *
 * A build is `'release'` only when a real, existing tag points at the exact commit being built, never when a release is merely expected, scheduled, or about to happen. Every other build, including one sitting directly on top of the commit a release will eventually tag, is `'commit'`.
 */
export type BuildIdentity =
  | {
      readonly kind: 'release';
      /** The released version, read from `package.json` (e.g. `"1.4.0"`). */
      readonly version: string;
      /** The tag/release page for this exact version. */
      readonly url: string;
      /** ISO 8601 date of the commit this release was tagged at. */
      readonly date: string;
    }
  | {
      readonly kind: 'commit';
      /** The short commit hash this build was made from. There is no released version to show yet. */
      readonly version: string;
      /** The permalink to this exact commit. */
      readonly url: string;
      /** ISO 8601 date of this commit. */
      readonly date: string;
    };

export interface ResolveBuildIdentityOptions {
  /**
   * Turns the version read from `package.json` into the git tag name that is expected to mark its release. Defaults to a `v` prefix (`"1.4.0"` -> `"v1.4.0"`), the convention this package's own release tooling and GitHub's own release UI both use. Override it for a repo that tags releases differently (a bare version, a package-scoped prefix in a monorepo, and so on).
   */
  readonly tagName?: (version: string) => string;
}
