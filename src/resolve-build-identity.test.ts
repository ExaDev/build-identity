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
    const fullSha = repo.git('rev-parse', 'HEAD');
    const identity = resolveBuildIdentity(repo.root, 'exadev/example');
    expect(identity.kind).toBe('release');
    expect(identity.version).toBe('1.4.0');
    expect(identity.url).toBe('https://github.com/exadev/example/releases/tag/v1.4.0');
    expect(identity.date).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(identity.commit).toBe(fullSha);
  });

  it('never claims a release when the matching tag exists but HEAD has since moved past it -- the core correctness property', () => {
    repo = createTestRepo({ name: 'fixture', version: '1.4.0' });
    repo.tag('v1.4.0');
    repo.commit('feat: something new after the release tag');
    const identity = resolveBuildIdentity(repo.root, 'exadev/example');
    expect(identity.kind).toBe('commit');
  });

  it('reports the version the tag on HEAD names, whatever version package.json holds', () => {
    repo = createTestRepo({ name: 'fixture', version: '1.4.0' });
    repo.tag('v1.3.0');
    const identity = resolveBuildIdentity(repo.root, 'exadev/example');
    expect(identity).toMatchObject({ kind: 'release', version: '1.3.0' });
  });

  it('uses a caller-supplied tag template instead of the default v-prefix convention', () => {
    repo = createTestRepo({ name: 'fixture', version: '2.0.0' });
    repo.tag('release-2.0.0');
    const identity = resolveBuildIdentity(repo.root, 'exadev/example', {
      tagTemplate: 'release-{version}',
    });
    expect(identity.kind).toBe('release');
    expect(identity.url).toBe('https://github.com/exadev/example/releases/tag/release-2.0.0');
  });

  it('links to the full commit SHA while displaying the short SHA as the version', () => {
    repo = createTestRepo({ name: 'fixture', version: '1.0.0' });
    const fullSha = repo.git('rev-parse', 'HEAD');

    const identity = resolveBuildIdentity(repo.root, 'exadev/example');

    expect(identity.kind).toBe('commit');
    expect(identity.url).toBe(`https://github.com/exadev/example/commit/${fullSha}`);
    expect(fullSha.startsWith(identity.version)).toBe(true);
    expect(identity.version.length).toBeLessThan(fullSha.length);
    expect(identity.commit).toBe(fullSha);
  });

  it('reads the released version from the tag, not from package.json, so a release made without a version-bump commit is still a release', () => {
    repo = createTestRepo({ name: 'fixture', version: '1.4.0' });
    repo.tag('v1.4.0');
    repo.commit('feat: released without touching package.json');
    repo.tag('v1.5.0');
    const identity = resolveBuildIdentity(repo.root, 'exadev/example');
    expect(identity).toMatchObject({ kind: 'release', version: '1.5.0', url: 'https://github.com/exadev/example/releases/tag/v1.5.0' });
  });

  it('needs no package.json at all', () => {
    repo = createTestRepo();
    rmSync(join(repo.root, 'package.json'));
    repo.commit('chore: drop package.json');
    repo.tag('v1.0.0');
    expect(resolveBuildIdentity(repo.root, 'exadev/example')).toMatchObject({ kind: 'release', version: '1.0.0' });
  });

  it('reports a release when a lower release tag points at HEAD while a higher one is reachable, as after a backport', () => {
    repo = createTestRepo();
    repo.tag('v1.10.0');
    repo.commit('fix: a backport');
    repo.tag('v1.9.1');
    expect(resolveBuildIdentity(repo.root, 'exadev/example')).toMatchObject({ kind: 'release', version: '1.9.1', url: 'https://github.com/exadev/example/releases/tag/v1.9.1' });
  });

  it('reports the highest version when several release tags point at HEAD', () => {
    repo = createTestRepo();
    repo.tag('v1.9.0');
    repo.tag('v1.10.0');
    expect(resolveBuildIdentity(repo.root, 'exadev/example')).toMatchObject({ kind: 'release', version: '1.10.0' });
  });

  it('reports a release for an annotated release tag at HEAD', () => {
    repo = createTestRepo();
    repo.git('tag', '--annotate', '--message', 'Release 2.3.4', 'v2.3.4');
    expect(resolveBuildIdentity(repo.root, 'exadev/example')).toMatchObject({ kind: 'release', version: '2.3.4' });
  });

  it('reports the commit, needing no history beyond HEAD and never throwing, in a shallow clone made without tags', () => {
    repo = createTestRepo();
    repo.tag('v1.0.0');
    const headSha = repo.commit('feat: after the release');
    const clone = repo.shallowClone();
    expect(resolveBuildIdentity(clone, 'exadev/example')).toMatchObject({ kind: 'commit', commit: headSha, url: `https://github.com/exadev/example/commit/${headSha}` });
  });

  it('reports the commit, never throwing, in a full clone made without tags', () => {
    repo = createTestRepo();
    repo.tag('v1.0.0');
    const headSha = repo.commit('feat: after the release');
    expect(resolveBuildIdentity(repo.taglessClone(), 'exadev/example')).toMatchObject({ kind: 'commit', commit: headSha });
  });

  it('never treats a tag outside the template or a prerelease tag on HEAD as a release', () => {
    repo = createTestRepo();
    repo.tag('latest');
    repo.tag('v2.0.0-rc.1');
    expect(resolveBuildIdentity(repo.root, 'exadev/example').kind).toBe('commit');
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
