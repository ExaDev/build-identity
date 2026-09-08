import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { bumpVersion, isReleaseLevel, parseGitLogOutput, predictNextVersion, type AnalyzeCommits, type ReleaseRule } from './predict-next-version';
import { loadCommitAnalyzer } from './load-commit-analyzer';
import { createTestRepo, type TestRepo } from './test-repo';

const COMMIT_TYPE_RULES: readonly ReleaseRule[] = [
  { breaking: true, release: 'major' },
  { type: 'feat', release: 'minor' },
  { type: 'fix', release: 'patch' },
  { type: 'chore', release: false },
];

let analyzeCommits: AnalyzeCommits;

beforeAll(async () => {
  analyzeCommits = await loadCommitAnalyzer();
});

describe('parseGitLogOutput', () => {
  it('returns an empty array for empty input', () => {
    expect(parseGitLogOutput('')).toEqual([]);
  });

  it('parses a single record with a leading NUL', () => {
    const raw = '\x00abc123\x00feat: add a thing\n';
    expect(parseGitLogOutput(raw)).toEqual([{ hash: 'abc123', message: 'feat: add a thing' }]);
  });

  it('parses several records in order', () => {
    const raw = '\x00hash1\x00feat: first\n\x00hash2\x00fix: second\n\x00hash3\x00chore: third\n';
    expect(parseGitLogOutput(raw)).toEqual([
      { hash: 'hash1', message: 'feat: first' },
      { hash: 'hash2', message: 'fix: second' },
      { hash: 'hash3', message: 'chore: third' },
    ]);
  });

  it('preserves a multi-line commit body, trimming only the trailing newline git appends', () => {
    const raw = '\x00abc123\x00feat: add a thing\n\nWith a body.\n\nAnd a footer.\n';
    expect(parseGitLogOutput(raw)).toEqual([{ hash: 'abc123', message: 'feat: add a thing\n\nWith a body.\n\nAnd a footer.' }]);
  });
});

describe('bumpVersion', () => {
  it('increments major and resets minor/patch to 0', () => {
    expect(bumpVersion('1.4.2', 'major')).toBe('2.0.0');
  });

  it('increments minor and resets patch to 0, leaving major untouched', () => {
    expect(bumpVersion('1.4.2', 'minor')).toBe('1.5.0');
  });

  it('increments patch, leaving major/minor untouched', () => {
    expect(bumpVersion('1.4.2', 'patch')).toBe('1.4.3');
  });
});

describe('isReleaseLevel', () => {
  it.each(['major', 'minor', 'patch'])('accepts %j', (value) => {
    expect(isReleaseLevel(value)).toBe(true);
  });

  it.each([undefined, null, false, '', 'breaking', 0])('rejects %j', (value) => {
    expect(isReleaseLevel(value)).toBe(false);
  });
});

describe('predictNextVersion', () => {
  let repo: TestRepo | undefined;

  afterEach(() => {
    repo?.cleanup();
    repo = undefined;
  });

  it('returns undefined when there are no commits since the last tag', async () => {
    repo = createTestRepo({ name: 'fixture', version: '1.4.0' });
    repo.tag('v1.4.0');

    await expect(predictNextVersion(repo.root, COMMIT_TYPE_RULES, analyzeCommits)).resolves.toBeUndefined();
  });

  it('predicts a minor bump from a feat commit', async () => {
    repo = createTestRepo({ name: 'fixture', version: '1.4.0' });
    repo.tag('v1.4.0');
    repo.commit('feat: add a thing');

    await expect(predictNextVersion(repo.root, COMMIT_TYPE_RULES, analyzeCommits)).resolves.toBe('1.5.0');
  });

  it('predicts a patch bump from a fix commit', async () => {
    repo = createTestRepo({ name: 'fixture', version: '1.4.0' });
    repo.tag('v1.4.0');
    repo.commit('fix: correct a thing');

    await expect(predictNextVersion(repo.root, COMMIT_TYPE_RULES, analyzeCommits)).resolves.toBe('1.4.1');
  });

  it('predicts a major bump from a breaking change footer, even on a feat commit', async () => {
    repo = createTestRepo({ name: 'fixture', version: '1.4.0' });
    repo.tag('v1.4.0');
    repo.commit('feat: add a thing\n\nBREAKING CHANGE: removes the old thing');

    await expect(predictNextVersion(repo.root, COMMIT_TYPE_RULES, analyzeCommits)).resolves.toBe('2.0.0');
  });

  it('takes the highest release level across several commits, not just the most recent', async () => {
    repo = createTestRepo({ name: 'fixture', version: '1.4.0' });
    repo.tag('v1.4.0');
    repo.commit('fix: correct a thing');
    repo.commit('feat: add a thing');

    await expect(predictNextVersion(repo.root, COMMIT_TYPE_RULES, analyzeCommits)).resolves.toBe('1.5.0');
  });

  it('returns undefined when every commit since the last tag is explicitly rule-excluded from releasing', async () => {
    repo = createTestRepo({ name: 'fixture', version: '1.4.0' });
    repo.tag('v1.4.0');
    repo.commit('chore: tidy up');

    await expect(predictNextVersion(repo.root, COMMIT_TYPE_RULES, analyzeCommits)).resolves.toBeUndefined();
  });

  it('uses a caller-supplied tagName function to find the last release, matching resolveBuildIdentity', async () => {
    repo = createTestRepo({ name: 'fixture', version: '2.0.0' });
    repo.tag('release-2.0.0');
    repo.commit('feat: add a thing');

    await expect(predictNextVersion(repo.root, COMMIT_TYPE_RULES, analyzeCommits, { tagName: (version) => `release-${version}` })).resolves.toBe('2.1.0');
  });

  it('routes commit-analyzer narration through a caller-supplied logger', async () => {
    repo = createTestRepo({ name: 'fixture', version: '1.4.0' });
    repo.tag('v1.4.0');
    repo.commit('feat: add a thing');
    const logged: (readonly unknown[])[] = [];

    const log = (...args: readonly unknown[]): void => {
      logged.push(args);
    };

    await predictNextVersion(repo.root, COMMIT_TYPE_RULES, analyzeCommits, { logger: { log, error: log } });

    expect(logged.length).toBeGreaterThan(0);
  });

  it('never calls analyzeCommits when there are no commits to analyze', async () => {
    repo = createTestRepo({ name: 'fixture', version: '1.4.0' });
    repo.tag('v1.4.0');
    let called = false;
    const spyAnalyzeCommits: AnalyzeCommits = async () => {
      called = true;
      return Promise.resolve(undefined);
    };

    await predictNextVersion(repo.root, COMMIT_TYPE_RULES, spyAnalyzeCommits);

    expect(called).toBe(false);
  });

  it('returns undefined, rather than throwing, when analyzeCommits resolves to something that is not a release level', async () => {
    repo = createTestRepo({ name: 'fixture', version: '1.4.0' });
    repo.tag('v1.4.0');
    repo.commit('feat: add a thing');
    const noopAnalyzeCommits: AnalyzeCommits = async () => Promise.resolve(undefined);

    await expect(predictNextVersion(repo.root, COMMIT_TYPE_RULES, noopAnalyzeCommits)).resolves.toBeUndefined();
  });

  it('throws rather than defaulting when package.json has no version field', async () => {
    repo = createTestRepo({ name: 'fixture' });
    const { root } = repo;

    await expect(predictNextVersion(root, COMMIT_TYPE_RULES, analyzeCommits)).rejects.toThrow(/version/);
  });
});
