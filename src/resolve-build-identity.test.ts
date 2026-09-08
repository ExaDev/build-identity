import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveBuildIdentity } from './resolve-build-identity';
import { createTestRepo, type TestRepo } from './test-repo';

describe('resolveBuildIdentity', () => {
  let repo: TestRepo | undefined;

  afterEach(() => {
    repo?.cleanup();
    repo = undefined;
  });

  it('returns a commit identity when no tag points at HEAD', () => {
    repo = createTestRepo({ name: 'fixture', version: '1.4.0' });
    const identity = resolveBuildIdentity(repo.root, 'exadev/example');
    expect(identity.kind).toBe('commit');
  });

  it('returns a release identity when v<version> tags HEAD exactly', () => {
    repo = createTestRepo({ name: 'fixture', version: '1.4.0' });
    repo.tag('v1.4.0');
    const identity = resolveBuildIdentity(repo.root, 'exadev/example');
    expect(identity.kind).toBe('release');
    expect(identity.version).toBe('1.4.0');
    expect(identity.url).toBe('https://github.com/exadev/example/releases/tag/v1.4.0');
    expect(identity.date).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('never claims a release when the matching tag exists but HEAD has since moved past it: the core correctness property', () => {
    repo = createTestRepo({ name: 'fixture', version: '1.4.0' });
    repo.tag('v1.4.0');
    repo.commit('feat: something new after the release tag');
    const identity = resolveBuildIdentity(repo.root, 'exadev/example');
    expect(identity.kind).toBe('commit');
  });

  it('never claims a release for a version that has never been tagged at all', () => {
    repo = createTestRepo({ name: 'fixture', version: '1.4.0' });
    repo.tag('v1.3.0'); // an earlier release, not this one, and not at HEAD
    const identity = resolveBuildIdentity(repo.root, 'exadev/example');
    expect(identity.kind).toBe('commit');
  });

  it('uses a caller-supplied tagName function instead of the default v-prefix convention', () => {
    repo = createTestRepo({ name: 'fixture', version: '2.0.0' });
    repo.tag('release-2.0.0');
    const identity = resolveBuildIdentity(repo.root, 'exadev/example', {
      tagName: (version) => `release-${version}`,
    });
    expect(identity.kind).toBe('release');
    expect(identity.url).toBe('https://github.com/exadev/example/releases/tag/release-2.0.0');
  });

  it('links to the full commit SHA while displaying the short SHA as the version', () => {
    repo = createTestRepo({ name: 'fixture', version: '1.0.0' });
    const fullSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo.root, encoding: 'utf8' }).trim();

    const identity = resolveBuildIdentity(repo.root, 'exadev/example');

    expect(identity.kind).toBe('commit');
    expect(identity.url).toBe(`https://github.com/exadev/example/commit/${fullSha}`);
    expect(fullSha.startsWith(identity.version)).toBe(true);
    expect(identity.version.length).toBeLessThan(fullSha.length);
  });

  it('throws rather than defaulting when package.json has no version field', () => {
    repo = createTestRepo({ name: 'fixture' });
    const { root } = repo;
    expect(() => resolveBuildIdentity(root, 'exadev/example')).toThrow(/version/);
  });

  it('throws rather than defaulting when package.json does not even contain a JSON object', () => {
    repo = createTestRepo();
    writeFileSync(join(repo.root, 'package.json'), 'null');
    const { root } = repo;
    expect(() => resolveBuildIdentity(root, 'exadev/example')).toThrow(/version/);
  });

  it('throws rather than defaulting when package.json has an empty version field', () => {
    repo = createTestRepo({ name: 'fixture', version: '' });
    const { root } = repo;
    expect(() => resolveBuildIdentity(root, 'exadev/example')).toThrow(/version/);
  });

  it('throws for a repoSlug that is not a real "owner/repo" slug', () => {
    repo = createTestRepo({ name: 'fixture', version: '1.0.0' });
    const { root } = repo;
    expect(() => resolveBuildIdentity(root, 'not-a-slug')).toThrow(/owner\/repo/);
  });

  it('throws rather than inventing an identity when repoRoot is not a git repository', () => {
    const notARepo = mkdtempSync(join(tmpdir(), 'build-identity-not-a-repo-'));
    writeFileSync(join(notARepo, 'package.json'), JSON.stringify({ name: 'fixture', version: '1.0.0' }));
    try {
      expect(() => resolveBuildIdentity(notARepo, 'exadev/example')).toThrow();
    } finally {
      rmSync(notARepo, { recursive: true, force: true });
    }
  });
});
