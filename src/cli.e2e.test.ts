import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createTestRepo, type TestRepo } from './test-repo';

const PACKAGE_ROOT = fileURLToPath(new URL('..', import.meta.url));
const CLI_PATH = join(PACKAGE_ROOT, 'dist', 'cli.js');
const TSDOWN_PATH = join(PACKAGE_ROOT, 'node_modules', '.bin', 'tsdown');

/** Generous: this hook runs a real bundler, on a cold cache, on whatever CI runner or laptop happens to be executing the suite. */
const BUILD_TIMEOUT_MS = 180_000;
/** git's own default `--short` length, which `resolveBuildIdentity` reports verbatim as an unreleased build's version. */
const SHORT_SHA_LENGTH = 7;
/** The `env` format emits exactly one line per DisplayIdentity field: kind, version, url, date, commit. */
const IDENTITY_FIELD_COUNT = 5;

const RULES = JSON.stringify([
  { breaking: true, release: 'major' },
  { type: 'feat', release: 'minor' },
  { type: 'chore', release: false },
]);

interface CliResult {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

function runCli(...args: readonly string[]): CliResult {
  const result = spawnSync(process.execPath, [CLI_PATH, ...args], { encoding: 'utf8' });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

describe('build-identity CLI, as actually built and executed', () => {
  let repo: TestRepo | undefined;

  beforeAll(() => {
    // This suite exercises the real bin script, so it has to run against a real build rather than the TypeScript sources: shebang, bundling, the inlined package version and the bin's own exit codes are all properties of the built artefact only. Building here rather than depending on a prior `pnpm build` keeps `pnpm test` self-contained and, more importantly, guarantees the binary under test is the current source rather than whatever a previous build happened to leave in dist.
    execFileSync(TSDOWN_PATH, { cwd: PACKAGE_ROOT, encoding: 'utf8', stdio: 'pipe' });
  }, BUILD_TIMEOUT_MS);

  afterEach(() => {
    repo?.cleanup();
    repo = undefined;
  });

  it('prints its own version', () => {
    const result = runCli('--version');
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('prints a commit identity as JSON on stdout, and nothing on stderr', () => {
    repo = createTestRepo({ name: 'fixture', version: '1.4.0' });
    const headSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo.root, encoding: 'utf8' }).trim();

    const result = runCli('--repo', 'exadev/example', '--root', repo.root);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toEqual({
      kind: 'commit',
      version: headSha.slice(0, SHORT_SHA_LENGTH),
      url: `https://github.com/exadev/example/commit/${headSha}`,
      date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) as unknown,
      commit: headSha,
    });
  });

  it('prints a release identity when the release tag points at HEAD', () => {
    repo = createTestRepo({ name: 'fixture', version: '1.4.0' });
    repo.tag('v1.4.0');

    const result = runCli('--repo', 'exadev/example', '--root', repo.root);

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ kind: 'release', version: '1.4.0', url: 'https://github.com/exadev/example/releases/tag/v1.4.0' });
  });

  it('predicts the next version, loading the real commit analyzer, when --predict is given', () => {
    repo = createTestRepo({ name: 'fixture', version: '1.4.0' });
    repo.tag('v1.4.0');
    repo.commit('feat: add a thing');

    const result = runCli('--repo', 'exadev/example', '--root', repo.root, '--predict', '--release-rules', RULES);

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ kind: 'predicted', version: '1.5.0' });
  });

  it('emits KEY=VALUE lines ready to append to $GITHUB_ENV, keeping stdout free of analyzer narration under --verbose', () => {
    repo = createTestRepo({ name: 'fixture', version: '1.4.0' });
    repo.tag('v1.4.0');
    repo.commit('feat: add a thing');

    const result = runCli('--repo', 'exadev/example', '--root', repo.root, '--predict', '--release-rules', RULES, '--format', 'env', '--prefix', 'RELEASE_', '--verbose');

    expect(result.status).toBe(0);
    const lines = result.stdout.trim().split('\n');
    expect(lines).toHaveLength(IDENTITY_FIELD_COUNT);
    expect(lines[0]).toBe('RELEASE_KIND=predicted');
    expect(lines[1]).toBe('RELEASE_VERSION=1.5.0');
    for (const line of lines) {
      expect(line).toMatch(/^RELEASE_[A-Z]+=/);
    }
    expect(result.stderr).toContain('Analyzing commit');
  });

  it('exits non-zero with a message, not a bare stack, when the root is not a git repository', () => {
    const result = runCli('--repo', 'exadev/example', '--root', join(PACKAGE_ROOT, 'definitely-not-a-directory'));

    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('build-identity:');
  });

  it('exits non-zero when --predict is given with no release rules', () => {
    repo = createTestRepo({ name: 'fixture', version: '1.4.0' });

    const result = runCli('--repo', 'exadev/example', '--root', repo.root, '--predict');

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('--release-rules');
  });

  it('exits non-zero when --repo is missing', () => {
    const result = runCli('--root', PACKAGE_ROOT);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('--repo');
  });
});
