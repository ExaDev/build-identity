import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gitEnvironment } from './git';

/** A disposable git working tree used only by this package's own tests. */
export interface TestRepo {
  readonly root: string;
  /** Writes a new file and commits it, moving HEAD forward. Returns the new commit's full SHA. */
  commit: (message?: string) => string;
  /** Tags the current HEAD with a lightweight tag. */
  tag: (name: string) => void;
  /** Runs any other git command in this repository (a branch, a switch, a merge, an annotated tag), with the same isolated environment every other fixture call gets. Returns its trimmed stdout. */
  git: (...args: readonly string[]) => string;
  /** Amends HEAD in place with a new committer date, leaving the author date (identity and timestamp) untouched -- the same shape a rebase produces. Returns the resulting (unchanged) commit SHA. */
  setCommitterDate: (isoDate: string) => string;
  /** Clones this repository at depth 1 without its tags into a fresh temporary directory, the shape a default `actions/checkout` produces, and returns the clone's root. `cleanup` removes it too. */
  shallowClone: () => string;
  /** Clones this repository's full history without its tags into a fresh temporary directory, and returns the clone's root. `cleanup` removes it too. */
  taglessClone: () => string;
  /** Removes the working tree, and any clone made from it, from disk. Always call this, even when a test fails. */
  cleanup: () => void;
}

/** The branch every fixture repository starts on, named explicitly so a test that switches branches never depends on the machine's own `init.defaultBranch`. */
export const TEST_REPO_DEFAULT_BRANCH = 'main';

function git(root: string, args: readonly string[], env?: Record<string, string>): string {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    // gitEnvironment, so a suite launched from a git hook (which exports GIT_DIR and friends for the repository being committed or pushed) builds its fixtures here rather than in that outer repository.
    env: { ...gitEnvironment(), ...env },
  }).trim();
}

/**
 * Creates a throwaway git repository with a committed `package.json`, for exercising `resolveBuildIdentity`, `findLastRelease`, `predictNextVersion` and the git helpers against real git state rather than a mocked one. Nothing in the library reads the `package.json`; it gives the first commit something to hold, and lets a test show a stale version in it is ignored.
 */
export function createTestRepo(packageJson: Record<string, unknown> = { name: 'fixture', version: '1.0.0' }): TestRepo {
  const root = mkdtempSync(join(tmpdir(), 'build-identity-test-'));
  const clones: string[] = [];
  git(root, ['init', '--quiet', `--initial-branch=${TEST_REPO_DEFAULT_BRANCH}`]);
  git(root, ['config', 'user.email', 'test@example.invalid']);
  git(root, ['config', 'user.name', 'build-identity tests']);
  // This machine's global git config signs every commit and tag by default, which needs a GPG agent and turns a plain lightweight tag into an annotated one requiring a message, neither of which a disposable test fixture should depend on.
  git(root, ['config', 'commit.gpgSign', 'false']);
  git(root, ['config', 'tag.gpgSign', 'false']);
  writeFileSync(join(root, 'package.json'), JSON.stringify(packageJson, null, 2));
  git(root, ['add', 'package.json']);
  git(root, ['commit', '--quiet', '-m', 'chore: initial commit']);

  let commitCount = 0;

  return {
    root,
    commit(message = 'chore: further commit') {
      commitCount += 1;
      writeFileSync(join(root, `commit-${String(commitCount)}.txt`), message);
      git(root, ['add', '-A']);
      git(root, ['commit', '--quiet', '-m', message]);
      return git(root, ['rev-parse', 'HEAD']);
    },
    tag(name: string) {
      // -c tag.gpgSign=false: this machine's global git config signs every tag by default, which needs a GPG agent and turns a plain lightweight tag into an annotated one requiring a message -- neither of which a disposable test fixture should depend on.
      git(root, ['-c', 'tag.gpgSign=false', 'tag', name]);
    },
    setCommitterDate(isoDate: string) {
      // --no-edit keeps the message; omitting --reset-author keeps the original author identity and author date. Only GIT_COMMITTER_DATE moves, exactly what a rebase does to a picked commit.
      git(root, ['commit', '--amend', '--no-edit', '--no-gpg-sign'], { GIT_COMMITTER_DATE: isoDate });
      return git(root, ['rev-parse', 'HEAD']);
    },
    git(...args: readonly string[]) {
      return git(root, args);
    },
    shallowClone() {
      const clone = mkdtempSync(join(tmpdir(), 'build-identity-shallow-'));
      clones.push(clone);
      // A file:// URL, not a bare path: git ignores --depth for a local path clone and hard-links the whole object store instead.
      git(clone, ['clone', '--quiet', '--depth', '1', '--no-tags', `file://${root}`, '.']);
      return clone;
    },
    taglessClone() {
      const clone = mkdtempSync(join(tmpdir(), 'build-identity-tagless-'));
      clones.push(clone);
      git(clone, ['clone', '--quiet', '--no-tags', root, '.']);
      return clone;
    },
    cleanup() {
      for (const directory of [root, ...clones]) {
        rmSync(directory, { recursive: true, force: true });
      }
    },
  };
}
