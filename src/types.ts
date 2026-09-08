/**
 * What a build actually is, as far as git can prove it right now.
 *
 * A build is `'release'` only when a real, existing tag points at the exact commit being built -- never when a release is merely expected, scheduled, or about to happen. Every other build, including one sitting directly on top of the commit a release will eventually tag, is `'commit'`.
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
   * Turns the version read from `package.json` into the git tag name that is expected to mark its release. Defaults to a `v` prefix (`"1.4.0"` -> `"v1.4.0"`), the convention this package's own release tooling and GitHub's own release UI both use -- override it for a repo that tags releases differently (a bare version, a package-scoped prefix in a monorepo, and so on).
   */
  readonly tagName?: (version: string) => string;
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
