import { execFileSync } from 'node:child_process';

export interface HeadCommit {
  readonly fullSha: string;
  readonly shortSha: string;
  /** ISO 8601 author date, e.g. `2026-09-08T10:22:00+01:00`. */
  readonly date: string;
}

/** The variables through which git lets its environment override which repository, work tree and index a command acts on, whatever its working directory. */
const REPOSITORY_OVERRIDE_VARIABLES = new Set(['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE']);

/**
 * This process's environment without git's repository-override variables. Every function here takes the repository as `repoRoot` and runs git with that as its working directory; a git hook exports `GIT_DIR`, `GIT_WORK_TREE` and `GIT_INDEX_FILE` for the repository it fired in, and with those inherited git would silently inspect that repository instead of `repoRoot`.
 */
export function gitEnvironment(): NodeJS.ProcessEnv {
  return Object.fromEntries(Object.entries(process.env).filter(([name]) => !REPOSITORY_OVERRIDE_VARIABLES.has(name)));
}

function runGit(repoRoot: string, args: readonly string[]): string {
  return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', env: gitEnvironment() }).trim();
}

/**
 * Reads HEAD's full hash, short hash, and author date from the given git working tree. Author date, not committer date: a rebase-merged commit keeps its original author date but gets a fresh committer date at rebase time, and every consumer of this identity treats the date as "when this commit was authored", not "when it was last rewritten onto its current position". Throws whatever `git` itself throws (e.g. `repoRoot` is not a git repository, or has no commits) -- there is no sensible default identity for a build that isn't sitting in real git history.
 */
export function getHeadCommit(repoRoot: string): HeadCommit {
  const fullSha = runGit(repoRoot, ['rev-parse', 'HEAD']);
  const shortSha = runGit(repoRoot, ['rev-parse', '--short', 'HEAD']);
  const date = runGit(repoRoot, ['log', '-1', '--format=%aI', 'HEAD']);
  return { fullSha, shortSha, date };
}

/**
 * True only if `tagName` both exists and points at the exact commit HEAD is on right now. Uses `git tag --list <tag> --points-at HEAD`, which returns `tagName` itself when both hold and nothing otherwise -- there is no separate "tag exists but points elsewhere" case to confuse this with.
 */
export function tagPointsAtHead(repoRoot: string, tagName: string): boolean {
  const output = runGit(repoRoot, ['tag', '--list', tagName, '--points-at', 'HEAD']);
  return output
    .split('\n')
    .map((line) => line.trim())
    .includes(tagName);
}

/** Every tag whose commit HEAD contains (`git tag --merged HEAD`), including any tag on HEAD itself. Empty when the repository has no tags. */
export function listTagsMergedIntoHead(repoRoot: string): string[] {
  const output = runGit(repoRoot, ['tag', '--merged', 'HEAD']);
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}
