import type { BuildIdentity } from './types';

/**
 * Upgrades an unreleased build's displayed version to a predicted one (e.g. the version a commit-analyzer-style tool computes the next release will be), without ever upgrading its URL.
 *
 * A confirmed release always wins outright: if `build.kind === 'release'`, this returns `build` completely unchanged, prediction or not. A real, already-tagged release can never be second-guessed by a prediction. Otherwise, when `predictedVersion` is a real, non-empty string, the returned `version` becomes that predicted label, `predicted` becomes `true`, and `url` is copied verbatim from `build`, so it still points at the real commit, never at a release page that doesn't exist yet. With no usable prediction, `build` is returned unchanged.
 *
 * This function does no git or filesystem access of its own: predicting the next version (e.g. by running a commit-analyzer) is entirely the caller's job. It exists to keep that prediction, and the guarantee `resolveBuildIdentity` makes about `url`, cleanly separate.
 */
export function resolvePredictedIdentity(build: BuildIdentity, predictedVersion: string | undefined): BuildIdentity & { readonly predicted?: boolean } {
  if (build.kind === 'release') {
    return build;
  }

  const trimmedPrediction = predictedVersion?.trim();
  if (trimmedPrediction === undefined || trimmedPrediction.length === 0) {
    return build;
  }

  return {
    kind: 'commit',
    version: trimmedPrediction,
    url: build.url,
    date: build.date,
    predicted: true,
  };
}
