import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** A disposable git working tree used only by this package's own tests. */
export interface TestRepo {
  readonly root: string;
  /** Writes a new file and commits it, moving HEAD forward. Returns the new commit's full SHA. */
  commit: (message?: string) => string;
  /** Tags the current HEAD. */
  tag: (name: string) => void;
  /** Amends HEAD in place with a new committer date, leaving the author date (identity and timestamp) untouched -- the same shape a rebase produces. Returns the resulting (unchanged) commit SHA. */
  setCommitterDate: (isoDate: string) => string;
  /** Removes the working tree from disk. Always call this, even when a test fails. */
  cleanup: () => void;
}

function git(root: string, args: readonly string[], env?: Record<string, string>): string {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    ...(env ? { env: { ...process.env, ...env } } : {}),
  }).trim();
}

/**
 * Creates a throwaway git repository with a committed `package.json`, for exercising `resolveBuildIdentity` and the git helpers against real git state rather than a mocked one.
 */
export function createTestRepo(packageJson: Record<string, unknown> = { name: 'fixture', version: '1.0.0' }): TestRepo {
  const root = mkdtempSync(join(tmpdir(), 'build-identity-test-'));
  git(root, ['init', '--quiet']);
  git(root, ['config', 'user.email', 'test@example.invalid']);
  git(root, ['config', 'user.name', 'build-identity tests']);
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
    cleanup() {
      rmSync(root, { recursive: true, force: true });
    },
  };
}
