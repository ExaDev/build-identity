import type { BuildIdentity, DisplayIdentity } from './types';

/**
 * Upgrades an unreleased build's displayed version to a predicted one (e.g. the version `predictNextVersion` computes the next release will be), without ever upgrading its URL.
 *
 * A confirmed release always wins outright: if `build.kind === 'release'`, this returns `build` completely unchanged, prediction or not -- a real, already-tagged release can never be second-guessed by a prediction. Otherwise, when `predictedVersion` is a real, non-empty string, the result is `kind: 'predicted'` with `version` set to that predicted label -- `url`/`date`/`commit` are copied verbatim from `build`, still describing the real commit, never a release page that doesn't exist yet. With no usable prediction, `build` is returned unchanged (still a valid `DisplayIdentity`, since every `BuildIdentity` kind is also a `DisplayIdentity` kind).
 *
 * This function does no git or filesystem access of its own: predicting the next version is entirely the caller's job, typically `predictNextVersion` (`./predict-next-version`). It exists to keep that prediction, and the guarantee `resolveBuildIdentity` makes about `url`, cleanly separate.
 */
export function resolvePredictedIdentity(build: BuildIdentity, predictedVersion: string | undefined): DisplayIdentity {
  if (build.kind === 'release') {
    return build;
  }

  const trimmedPrediction = predictedVersion?.trim();
  if (trimmedPrediction === undefined || trimmedPrediction.length === 0) {
    return build;
  }

  return {
    kind: 'predicted',
    version: trimmedPrediction,
    url: build.url,
    date: build.date,
    commit: build.commit,
  };
}
