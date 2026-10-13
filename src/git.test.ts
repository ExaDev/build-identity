import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getHeadCommit, gitEnvironment, listTagsMergedIntoHead, listTagsPointingAtHead } from './git';
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
    const expectedFullSha = repo.git('rev-parse', 'HEAD');

    expect(head.fullSha).toBe(expectedFullSha);
    expect(expectedFullSha.startsWith(head.shortSha)).toBe(true);
    expect(head.shortSha.length).toBeLessThan(head.fullSha.length);
    expect(head.date).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('reports the author date, not the committer date, when a rebase has moved the two apart', () => {
    repo = createTestRepo();
    const originalAuthorDate = repo.git('log', '-1', '--format=%aI', 'HEAD');

    // Simulate what a rebase does to a picked commit: the author date stays fixed, but the committer date jumps to whenever the rebase actually ran -- here, 45 minutes later.
    const rebasedCommitterDate = '2026-09-08T11:07:00+01:00';
    repo.setCommitterDate(rebasedCommitterDate);

    const rebasedCommitterDateActual = repo.git('log', '-1', '--format=%cI', 'HEAD');
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

describe('listTagsPointingAtHead', () => {
  let repo: TestRepo | undefined;

  afterEach(() => {
    repo?.cleanup();
    repo = undefined;
  });

  it('is empty when no tag points at HEAD', () => {
    repo = createTestRepo();
    expect(listTagsPointingAtHead(repo.root)).toEqual([]);
  });

  it('lists every tag at HEAD, lightweight and annotated', () => {
    repo = createTestRepo();
    repo.tag('v1.0.0');
    repo.git('tag', '--annotate', '--message', 'annotated', 'v1.0.1');
    expect(listTagsPointingAtHead(repo.root).sort()).toEqual(['v1.0.0', 'v1.0.1']);
  });

  it('leaves out a tag once HEAD has moved past it, the case that must never be mistaken for a release', () => {
    repo = createTestRepo();
    repo.tag('v1.0.0');
    repo.commit();
    repo.tag('v1.1.0');
    expect(listTagsPointingAtHead(repo.root)).toEqual(['v1.1.0']);
  });
});

describe('listTagsMergedIntoHead', () => {
  let repo: TestRepo | undefined;

  afterEach(() => {
    repo?.cleanup();
    repo = undefined;
  });

  it('is empty in a repository with no tags', () => {
    repo = createTestRepo();
    expect(listTagsMergedIntoHead(repo.root)).toEqual([]);
  });

  it('lists tags on HEAD and on its ancestors', () => {
    repo = createTestRepo();
    repo.tag('v1.0.0');
    repo.commit();
    repo.tag('v1.1.0');
    expect([...listTagsMergedIntoHead(repo.root)].sort()).toEqual(['v1.0.0', 'v1.1.0']);
  });
});

describe('gitEnvironment', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('drops the variables a git hook exports for its own repository, keeping the rest of the environment', () => {
    vi.stubEnv('GIT_DIR', '/elsewhere/.git');
    vi.stubEnv('GIT_WORK_TREE', '/elsewhere');
    vi.stubEnv('GIT_INDEX_FILE', '/elsewhere/.git/index');
    vi.stubEnv('BUILD_IDENTITY_TEST_MARKER', 'kept');
    const environment = gitEnvironment();
    expect(environment).toMatchObject({ BUILD_IDENTITY_TEST_MARKER: 'kept' });
    for (const name of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE']) {
      expect(environment).not.toHaveProperty(name);
    }
  });

  it('keeps every git call on repoRoot even when a hook has pointed GIT_DIR at another repository', () => {
    const inspected = createTestRepo();
    const other = createTestRepo();
    try {
      other.commit();
      // Read before GIT_DIR is set, so the expectation cannot itself be redirected to the other repository.
      const inspectedHead = inspected.git('rev-parse', 'HEAD');
      expect(other.git('rev-parse', 'HEAD')).not.toBe(inspectedHead);
      vi.stubEnv('GIT_DIR', join(other.root, '.git'));
      expect(getHeadCommit(inspected.root).fullSha).toBe(inspectedHead);
    } finally {
      inspected.cleanup();
      other.cleanup();
    }
  });
});
