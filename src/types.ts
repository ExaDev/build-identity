/**
 * What a build actually is, as far as git can prove it right now.
 *
 * A build is `'release'` only when a real, existing tag points at the exact commit being built -- never when a release is merely expected, scheduled, or about to happen. Every other build, including one sitting directly on top of the commit a release will eventually tag, is `'commit'`.
 */
export type BuildIdentity =
  | {
      readonly kind: 'release';
      /** The released version, read from the release tag on this commit (e.g. `"1.4.0"` from `v1.4.0`). */
      readonly version: string;
      /** The tag/release page for this exact version. */
      readonly url: string;
      /** ISO 8601 date of the commit this release was tagged at. */
      readonly date: string;
      /** Full git commit SHA of the commit this release was tagged at -- the same commit `url` and `date` describe, exposed as its own field so a caller never has to parse it back out of a release URL that never contains one. */
      readonly commit: string;
    }
  | {
      readonly kind: 'commit';
      /** The short commit hash this build was made from -- there is no released version to show yet. */
      readonly version: string;
      /** The permalink to this exact commit. */
      readonly url: string;
      /** ISO 8601 date of this commit. */
      readonly date: string;
      /** Full git commit SHA this build was made from -- the same commit `version`'s short form and `url`'s permalink describe. */
      readonly commit: string;
    };

export interface ResolveBuildIdentityOptions {
  /**
   * The tag name marking a release, with `{version}` standing in for the version exactly once. Defaults to `v{version}` (`"1.4.0"` -\> `"v1.4.0"`), the convention semantic-release's own default and GitHub's own release UI both use -- override it for a repo that tags releases differently (a bare version, a package-scoped prefix in a monorepo, and so on). Releases are found by reading tags back through it, so a tag that does not fit it is never a release.
   */
  readonly tagTemplate?: string;
}

/**
 * What a build should actually display -- `BuildIdentity` refined by an optional prediction (`resolvePredictedIdentity`). All three kinds carry the identical field set; only the meaning of `kind`/`version` differs: `'release'` and `'commit'` mean exactly what they do on `BuildIdentity` (a confirmed release always wins outright, unchanged), and `'predicted'` means "not yet released, but a commit-analyzer-style tool predicts this commit will become `version` once it is" -- `url`/`date`/`commit` still describe the real underlying commit, never a release page that doesn't exist yet.
 */
export interface DisplayIdentity {
  readonly kind: 'release' | 'predicted' | 'commit';
  readonly version: string;
  readonly url: string;
  readonly date: string;
  readonly commit: string;
}
