import type { AnalyzeCommits } from './predict-next-version';

// Read through a variable, never a string literal: TypeScript resolves an import()'s type by statically looking up a declaration for its specifier, and @semantic-release/commit-analyzer ships none. A literal specifier would force a choice between two bad options -- a hand-written ambient declaration (which either lies about a contract this undocumented plugin export never promised, or, left as a bare `declare module` with no members, implicitly types the *entire* module `any`, not just the one export used here) or none at all (a compile error). Reading the specifier through a variable sidesteps that lookup entirely: TypeScript never attempts to resolve types for a dynamically-computed specifier, so the result is genuinely `unknown` -- exactly what it should be for a module with no real, published contract -- verified by the runtime guard below rather than asserted by a type this package has no authority to make.
const COMMIT_ANALYZER_SPECIFIER = '@semantic-release/commit-analyzer';

function hasAnalyzeCommits(value: unknown): value is { analyzeCommits: AnalyzeCommits } {
  if (typeof value !== 'object' || value === null) return false;
  if (!('analyzeCommits' in value)) return false;
  return typeof value.analyzeCommits === 'function';
}

/**
 * Loads `@semantic-release/commit-analyzer`'s own `analyzeCommits` export -- the tested, correct way to obtain the `AnalyzeCommits` implementation `predictNextVersion` (`./predict-next-version`) needs. Split out from `predictNextVersion` itself so that function stays a pure, easily-fakeable function of its own arguments; this is the one place in the package that actually touches the untyped module.
 *
 * `@semantic-release/commit-analyzer` is an optional peer dependency (see this package's own `package.json`): not required to use `resolveBuildIdentity`/`resolvePredictedIdentity`, only to call this function. Throws a clear error, rather than a bare "Cannot find module", when it isn't installed or doesn't export `analyzeCommits` -- a version bump of the real package removing or renaming that export fails loudly here, not silently.
 */
export async function loadCommitAnalyzer(): Promise<AnalyzeCommits> {
  let commitAnalyzerModule: unknown;
  try {
    commitAnalyzerModule = await import(COMMIT_ANALYZER_SPECIFIER);
  } catch (error) {
    throw new Error('@semantic-release/commit-analyzer is not installed -- it is an optional peer dependency of @exadev/build-identity, required only for loadCommitAnalyzer/predictNextVersion.', { cause: error });
  }

  if (!hasAnalyzeCommits(commitAnalyzerModule)) {
    throw new Error('@semantic-release/commit-analyzer has no analyzeCommits export.');
  }

  return commitAnalyzerModule.analyzeCommits;
}
