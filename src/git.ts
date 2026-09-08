import { execFileSync } from 'node:child_process';

export interface HeadCommit {
  readonly fullSha: string;
  readonly shortSha: string;
  /** ISO 8601 author date, e.g. `2026-09-08T10:22:00+01:00`. */
  readonly date: string;
}

function runGit(repoRoot: string, args: readonly string[]): string {
  return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim();
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
