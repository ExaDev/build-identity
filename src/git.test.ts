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

  it('reads the full sha, short sha, and ISO author date of HEAD', () => {
    repo = createTestRepo();
    const head = getHeadCommit(repo.root);
    const expectedFullSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo.root, encoding: 'utf8' }).trim();

    expect(head.fullSha).toBe(expectedFullSha);
    expect(expectedFullSha.startsWith(head.shortSha)).toBe(true);
    expect(head.shortSha.length).toBeLessThan(head.fullSha.length);
    expect(head.date).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('reports the author date, not the committer date, when a rebase has moved the two apart', () => {
    repo = createTestRepo();
    const originalAuthorDate = execFileSync('git', ['log', '-1', '--format=%aI', 'HEAD'], {
      cwd: repo.root,
      encoding: 'utf8',
    }).trim();

    // Simulate what a rebase does to a picked commit: the author date stays fixed, but the committer date jumps to whenever the rebase actually ran -- here, 45 minutes later.
    const rebasedCommitterDate = '2026-09-08T11:07:00+01:00';
    repo.setCommitterDate(rebasedCommitterDate);

    const rebasedCommitterDateActual = execFileSync('git', ['log', '-1', '--format=%cI', 'HEAD'], {
      cwd: repo.root,
      encoding: 'utf8',
    }).trim();
    // Sanity-check the fixture itself: if this ever fails, the test below would pass for the wrong reason (author and committer date coincidentally still equal).
    expect(rebasedCommitterDateActual).not.toBe(originalAuthorDate);

    const head = getHeadCommit(repo.root);
    expect(head.date).toBe(originalAuthorDate);
    expect(head.date).not.toBe(rebasedCommitterDateActual);
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

  it('is false when the tag exists but HEAD has since moved past it -- the case that must never be mistaken for a release', () => {
    repo = createTestRepo();
    repo.tag('v1.0.0');
    repo.commit();
    expect(tagPointsAtHead(repo.root, 'v1.0.0')).toBe(false);
  });
});
