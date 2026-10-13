import { afterEach, describe, expect, it } from 'vitest';
import { assertTagTemplate, compareReleaseVersions, DEFAULT_TAG_TEMPLATE, findLastRelease, parseReleaseTag } from './release-tags';
import { createTestRepo, TEST_REPO_DEFAULT_BRANCH, type TestRepo } from './test-repo';

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

  it('throws for a version that is not a plain major.minor.patch', () => {
    expect(() => compareReleaseVersions('1.4', '1.4.0')).toThrow(/major\.minor\.patch/);
  });
});

describe('findLastRelease', () => {
  let repo: TestRepo | undefined;

  afterEach(() => {
    repo?.cleanup();
    repo = undefined;
  });

  it('throws, saying to fetch the tags, when no release tag is reachable from HEAD', () => {
    repo = createTestRepo();
    repo.tag('vNext');
    const { root } = repo;
    expect(() => findLastRelease(root)).toThrow(/no tag reachable from HEAD .* marks a release .*git fetch --tags/);
  });

  it('throws, saying to fetch the tags, in a full clone made without them, rather than treating it as a repository that never released', () => {
    repo = createTestRepo();
    repo.tag('v4.2.0');
    repo.commit('feat: after the release');
    const clone = repo.taglessClone();
    expect(() => findLastRelease(clone)).toThrow(/git fetch --tags/);
  });

  it('throws, saying to fetch full history and tags, in a shallow clone made without tags', () => {
    repo = createTestRepo();
    repo.tag('v1.0.0');
    repo.commit('feat: after the release');
    const clone = repo.shallowClone();
    expect(() => findLastRelease(clone)).toThrow(/shallow clone.*git fetch --unshallow --tags.*fetch-depth: 0/);
  });

  it('reads the release tag at HEAD, and the last one behind HEAD once commits land on top of it', () => {
    repo = createTestRepo();
    repo.tag('v1.4.0');
    expect(findLastRelease(repo.root)).toEqual({ version: '1.4.0', tagName: 'v1.4.0' });
    repo.commit('feat: after the release');
    expect(findLastRelease(repo.root)).toEqual({ version: '1.4.0', tagName: 'v1.4.0' });
  });

  it('recognises an annotated release tag', () => {
    repo = createTestRepo();
    repo.git('tag', '--annotate', '--message', 'Release 3.1.4', 'v3.1.4');
    expect(findLastRelease(repo.root)).toEqual({ version: '3.1.4', tagName: 'v3.1.4' });
  });

  it('counts a release tag on a side branch once HEAD has merged it', () => {
    repo = createTestRepo();
    repo.tag('v1.0.0');
    repo.git('switch', '--quiet', '-c', 'side');
    repo.commit('feat: side work');
    repo.tag('v1.1.0');
    repo.git('switch', '--quiet', TEST_REPO_DEFAULT_BRANCH);
    repo.commit('fix: main work');
    repo.git('merge', '--quiet', '--no-ff', '--no-edit', 'side');
    expect(findLastRelease(repo.root)).toEqual({ version: '1.1.0', tagName: 'v1.1.0' });
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
    repo.tag('vNext');
    expect(findLastRelease(repo.root)).toEqual({ version: '1.0.0', tagName: 'v1.0.0' });
  });

  it('ignores a higher release tag on a branch HEAD has not merged', () => {
    repo = createTestRepo();
    repo.tag('v1.0.0');
    const base = repo.git('rev-parse', 'HEAD');
    repo.commit('feat: on another branch');
    repo.tag('v2.0.0');
    repo.git('switch', '--quiet', '-c', 'other', base);
    repo.commit('fix: on this branch');
    expect(findLastRelease(repo.root)).toEqual({ version: '1.0.0', tagName: 'v1.0.0' });
  });

  it('ignores a release tag on a commit no branch reaches any more', () => {
    repo = createTestRepo();
    repo.tag('v1.0.0');
    const base = repo.git('rev-parse', 'HEAD');
    repo.commit('feat: abandoned work');
    repo.tag('v1.1.0');
    repo.git('reset', '--quiet', '--hard', base);
    expect(findLastRelease(repo.root)).toEqual({ version: '1.0.0', tagName: 'v1.0.0' });
  });

  it('reads tags through a caller-supplied template', () => {
    repo = createTestRepo();
    repo.tag('v9.0.0');
    repo.tag('release-2.0.0');
    expect(findLastRelease(repo.root, 'release-{version}')).toEqual({ version: '2.0.0', tagName: 'release-2.0.0' });
  });
});
