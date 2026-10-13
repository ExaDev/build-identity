import { execFileSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import { assertTagTemplate, compareReleaseVersions, DEFAULT_TAG_TEMPLATE, findLastRelease, parseReleaseTag } from './release-tags';
import { createTestRepo, type TestRepo } from './test-repo';

describe('assertTagTemplate', () => {
  it('accepts a template holding the placeholder once', () => {
    expect(() => { assertTagTemplate('release-{version}-final'); }).not.toThrow();
  });

  it.each(['latest', '{version}-{version}'])('rejects %j', (template) => {
    expect(() => { assertTagTemplate(template); }).toThrow(/exactly once/);
  });
});

describe('parseReleaseTag', () => {
  it('reads the version out of a default-template tag', () => {
    expect(parseReleaseTag(DEFAULT_TAG_TEMPLATE, 'v1.4.0')).toBe('1.4.0');
  });

  it('reads the version between a prefix and a suffix', () => {
    expect(parseReleaseTag('pkg@{version}-stable', 'pkg@2.10.3-stable')).toBe('2.10.3');
  });

  it.each(['1.4.0', 'release-1.4.0', 'v1.4', 'v1.4.0-rc.1', 'v1.4.0+build.5', 'v01.4.0', 'vlatest', 'v'])('is not a release tag under v{version}: %j', (tagName) => {
    expect(parseReleaseTag(DEFAULT_TAG_TEMPLATE, tagName)).toBeUndefined();
  });

  it('does not let a prefix and suffix overlap on a tag shorter than both', () => {
    expect(parseReleaseTag('ab{version}ba', 'aba')).toBeUndefined();
  });
});

describe('compareReleaseVersions', () => {
  it('orders numerically per field, not as strings', () => {
    expect(compareReleaseVersions('1.10.0', '1.9.0')).toBeGreaterThan(0);
    expect(compareReleaseVersions('2.0.0', '10.0.0')).toBeLessThan(0);
    expect(compareReleaseVersions('1.4.1', '1.4.0')).toBeGreaterThan(0);
    expect(compareReleaseVersions('1.4.0', '1.4.0')).toBe(0);
  });
});

describe('findLastRelease', () => {
  let repo: TestRepo | undefined;

  afterEach(() => {
    repo?.cleanup();
    repo = undefined;
  });

  it('is undefined before the first release', () => {
    repo = createTestRepo();
    expect(findLastRelease(repo.root)).toBeUndefined();
  });

  it('takes the highest release version, not the most recently created tag', () => {
    repo = createTestRepo();
    repo.tag('v1.10.0');
    repo.commit();
    repo.tag('v1.9.0');
    expect(findLastRelease(repo.root)).toEqual({ version: '1.10.0', tagName: 'v1.10.0' });
  });

  it('ignores tags that are not releases under the template, including prereleases', () => {
    repo = createTestRepo();
    repo.tag('v1.0.0');
    repo.commit();
    repo.tag('v2.0.0-rc.1');
    repo.tag('nightly');
    expect(findLastRelease(repo.root)).toEqual({ version: '1.0.0', tagName: 'v1.0.0' });
  });

  it('ignores a release tag on a commit HEAD does not contain', () => {
    repo = createTestRepo();
    repo.tag('v1.0.0');
    const { root } = repo;
    const base = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
    repo.commit('feat: on another branch');
    repo.tag('v2.0.0');
    execFileSync('git', ['checkout', '--quiet', '-b', 'other', base], { cwd: root });
    repo.commit('fix: on this branch');
    expect(findLastRelease(root)).toEqual({ version: '1.0.0', tagName: 'v1.0.0' });
  });

  it('reads tags through a caller-supplied template', () => {
    repo = createTestRepo();
    repo.tag('v9.0.0');
    repo.tag('release-2.0.0');
    expect(findLastRelease(repo.root, 'release-{version}')).toEqual({ version: '2.0.0', tagName: 'release-2.0.0' });
  });
});
