import { execFileSync } from 'node:child_process';

export interface HeadCommit {
  readonly fullSha: string;
  readonly shortSha: string;
  /** ISO 8601 committer date, e.g. `2026-09-08T10:22:00+01:00`. */
  readonly date: string;
}

function runGit(repoRoot: string, args: readonly string[]): string {
  return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim();
}

/**
 * Reads HEAD's full hash, short hash, and committer date from the given git working tree. Throws whatever `git` itself throws (e.g. `repoRoot` is not a git repository, or has no commits). There is no sensible default identity for a build that isn't sitting in real git history.
 */
export function getHeadCommit(repoRoot: string): HeadCommit {
  const fullSha = runGit(repoRoot, ['rev-parse', 'HEAD']);
  const shortSha = runGit(repoRoot, ['rev-parse', '--short', 'HEAD']);
  const date = runGit(repoRoot, ['log', '-1', '--format=%cI', 'HEAD']);
  return { fullSha, shortSha, date };
}

/**
 * True only if `tagName` both exists and points at the exact commit HEAD is on right now. Uses `git tag --list <tag> --points-at HEAD`, which returns `tagName` itself when both hold and nothing otherwise. There is no separate "tag exists but points elsewhere" case to confuse this with.
 */
export function tagPointsAtHead(repoRoot: string, tagName: string): boolean {
  const output = runGit(repoRoot, ['tag', '--list', tagName, '--points-at', 'HEAD']);
  return output
    .split('\n')
    .map((line) => line.trim())
    .includes(tagName);
}
