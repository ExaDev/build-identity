import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { getHeadCommit, tagPointsAtHead } from './git';
import { createTestRepo, type TestRepo } from './test-repo';

describe('getHeadCommit', () => {
  let repo: TestRepo | undefined;

  afterEach(() => {
    repo?.cleanup();
    repo = undefined;
  });

  it('reads the full sha, short sha, and ISO committer date of HEAD', () => {
    repo = createTestRepo();
    const head = getHeadCommit(repo.root);
    const expectedFullSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo.root, encoding: 'utf8' }).trim();

    expect(head.fullSha).toBe(expectedFullSha);
    expect(expectedFullSha.startsWith(head.shortSha)).toBe(true);
    expect(head.shortSha.length).toBeLessThan(head.fullSha.length);
    expect(head.date).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('throws rather than inventing a commit identity when the directory is not a git repository', () => {
    const notARepo = mkdtempSync(join(tmpdir(), 'build-identity-not-a-repo-'));
    try {
      expect(() => getHeadCommit(notARepo)).toThrow();
    } finally {
      rmSync(notARepo, { recursive: true, force: true });
    }
  });
});

describe('tagPointsAtHead', () => {
  let repo: TestRepo | undefined;

  afterEach(() => {
    repo?.cleanup();
    repo = undefined;
  });

  it('is false when the tag does not exist at all', () => {
    repo = createTestRepo();
    expect(tagPointsAtHead(repo.root, 'v9.9.9')).toBe(false);
  });

  it('is true when the tag exists and points at HEAD', () => {
    repo = createTestRepo();
    repo.tag('v1.0.0');
    expect(tagPointsAtHead(repo.root, 'v1.0.0')).toBe(true);
  });

  it('is false when the tag exists but HEAD has since moved past it: the case that must never be mistaken for a release', () => {
    repo = createTestRepo();
    repo.tag('v1.0.0');
    repo.commit();
    expect(tagPointsAtHead(repo.root, 'v1.0.0')).toBe(false);
  });
});
