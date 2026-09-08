import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { Command } from 'commander';
import { createProgram, DEFAULT_ENV_PREFIX, runBuildIdentity, type CliFlags } from './cli-program';
import { defaultTagName } from './package-version';
import type { ReleaseRule } from './predict-next-version';
import { createTestRepo, type TestRepo } from './test-repo';

const COMMIT_TYPE_RULES: readonly ReleaseRule[] = [
  { breaking: true, release: 'major' },
  { type: 'feat', release: 'minor' },
  { type: 'fix', release: 'patch' },
  { type: 'chore', release: false },
];

/** Turns commander's own report-and-exit behaviour into a throw, and discards its usage output, so a parse failure is assertable rather than killing the test process. */
function silentProgram(): Command {
  const program = createProgram();
  program.exitOverride();
  program.configureOutput({ writeOut: () => undefined, writeErr: () => undefined });
  return program;
}

async function parseArgs(...args: readonly string[]): Promise<Command> {
  return silentProgram().parseAsync([...args], { from: 'user' });
}

function flags(overrides: Partial<CliFlags> & Pick<CliFlags, 'repo' | 'root'>): CliFlags {
  return {
    tagName: defaultTagName,
    predict: undefined,
    releaseRules: undefined,
    releaseRulesFile: undefined,
    format: 'json',
    prefix: DEFAULT_ENV_PREFIX,
    verbose: undefined,
    ...overrides,
  };
}

describe('createProgram defaults', () => {
  it('defaults root to the current working directory, format to json, and prefix to BUILD_', () => {
    const opts = createProgram().opts<CliFlags>();
    expect(opts.root).toBe(process.cwd());
    expect(opts.format).toBe('json');
    expect(opts.prefix).toBe(DEFAULT_ENV_PREFIX);
  });

  it('defaults the tag name to the same v-prefixed convention the library itself defaults to', () => {
    expect(createProgram().opts<CliFlags>().tagName('1.4.0')).toBe(defaultTagName('1.4.0'));
  });
});

describe('createProgram argument parsing', () => {
  it('requires --repo', async () => {
    await expect(parseArgs()).rejects.toThrow(/--repo/);
  });

  it('rejects an unknown --format', async () => {
    await expect(parseArgs('--repo', 'exadev/example', '--format', 'yaml')).rejects.toThrow(/--format must be one of/);
  });

  it('rejects a --prefix that would not be a legal variable name', async () => {
    await expect(parseArgs('--repo', 'exadev/example', '--prefix', '1BUILD_')).rejects.toThrow(/--prefix/);
  });

  it('rejects a --tag-name template with no {version} placeholder', async () => {
    await expect(parseArgs('--repo', 'exadev/example', '--tag-name', 'latest')).rejects.toThrow(/\{version\}/);
  });

  it('rejects --release-rules that is not valid JSON', async () => {
    await expect(parseArgs('--repo', 'exadev/example', '--release-rules', '[{')).rejects.toThrow(/--release-rules is not valid JSON/);
  });

  it('rejects --release-rules holding something other than release rules', async () => {
    await expect(parseArgs('--repo', 'exadev/example', '--release-rules', '[{"type":"feat","release":"huge"}]')).rejects.toThrow(/entry 0 must be/);
  });

  it('turns a --tag-name template into the substituting function both library calls receive', () => {
    // parseOptions rather than parseAsync: this asserts the option coercion alone, without also running the action against a real repository.
    const program = silentProgram();
    program.parseOptions(['--repo', 'exadev/example', '--tag-name', 'release-{version}']);
    expect(program.opts<CliFlags>().tagName('2.0.0')).toBe('release-2.0.0');
  });
});

describe('runBuildIdentity', () => {
  let repo: TestRepo | undefined;

  afterEach(() => {
    repo?.cleanup();
    repo = undefined;
  });

  it('reports a commit identity as JSON when no tag points at HEAD', async () => {
    repo = createTestRepo({ name: 'fixture', version: '1.4.0' });
    const parsed: unknown = JSON.parse(await runBuildIdentity(flags({ repo: 'exadev/example', root: repo.root })));
    expect(parsed).toMatchObject({ kind: 'commit', url: expect.stringContaining('https://github.com/exadev/example/commit/') as unknown });
  });

  it('reports a release identity when the release tag points at HEAD', async () => {
    repo = createTestRepo({ name: 'fixture', version: '1.4.0' });
    repo.tag('v1.4.0');
    const parsed: unknown = JSON.parse(await runBuildIdentity(flags({ repo: 'exadev/example', root: repo.root })));
    expect(parsed).toMatchObject({ kind: 'release', version: '1.4.0' });
  });

  it('honours a caller-supplied tag convention for both the release check and the prediction base', async () => {
    repo = createTestRepo({ name: 'fixture', version: '2.0.0' });
    repo.tag('release-2.0.0');
    repo.commit('feat: add a thing');
    const output = await runBuildIdentity(
      flags({ repo: 'exadev/example', root: repo.root, tagName: (version) => `release-${version}`, predict: true, releaseRules: COMMIT_TYPE_RULES }),
    );
    expect(JSON.parse(output)).toMatchObject({ kind: 'predicted', version: '2.1.0' });
  });

  it('shows the predicted next version instead of a commit hash when --predict is given', async () => {
    repo = createTestRepo({ name: 'fixture', version: '1.4.0' });
    repo.tag('v1.4.0');
    repo.commit('feat: add a thing');
    const parsed: unknown = JSON.parse(await runBuildIdentity(flags({ repo: 'exadev/example', root: repo.root, predict: true, releaseRules: COMMIT_TYPE_RULES })));
    expect(parsed).toMatchObject({ kind: 'predicted', version: '1.5.0' });
  });

  it('falls back to the commit identity when --predict finds nothing release-worthy', async () => {
    repo = createTestRepo({ name: 'fixture', version: '1.4.0' });
    repo.tag('v1.4.0');
    repo.commit('chore: tidy up');
    const parsed: unknown = JSON.parse(await runBuildIdentity(flags({ repo: 'exadev/example', root: repo.root, predict: true, releaseRules: COMMIT_TYPE_RULES })));
    expect(parsed).toMatchObject({ kind: 'commit' });
  });

  it('never lets a prediction override a confirmed release', async () => {
    repo = createTestRepo({ name: 'fixture', version: '1.4.0' });
    repo.tag('v1.4.0');
    const parsed: unknown = JSON.parse(await runBuildIdentity(flags({ repo: 'exadev/example', root: repo.root, predict: true, releaseRules: COMMIT_TYPE_RULES })));
    expect(parsed).toMatchObject({ kind: 'release', version: '1.4.0' });
  });

  it('reads rules from --release-rules-file', async () => {
    repo = createTestRepo({ name: 'fixture', version: '1.4.0' });
    repo.tag('v1.4.0');
    repo.commit('fix: correct a thing');
    const rulesFile = join(repo.root, 'release-rules.json');
    writeFileSync(rulesFile, JSON.stringify(COMMIT_TYPE_RULES));
    const parsed: unknown = JSON.parse(await runBuildIdentity(flags({ repo: 'exadev/example', root: repo.root, predict: true, releaseRulesFile: rulesFile })));
    expect(parsed).toMatchObject({ kind: 'predicted', version: '1.4.1' });
  });

  it('names the file in a --release-rules-file read failure', async () => {
    repo = createTestRepo({ name: 'fixture', version: '1.4.0' });
    const missing = join(repo.root, 'absent.json');
    await expect(runBuildIdentity(flags({ repo: 'exadev/example', root: repo.root, predict: true, releaseRulesFile: missing }))).rejects.toThrow(/could not be read/);
  });

  it('rejects both rule sources at once rather than silently preferring one', async () => {
    repo = createTestRepo({ name: 'fixture', version: '1.4.0' });
    await expect(
      runBuildIdentity(flags({ repo: 'exadev/example', root: repo.root, predict: true, releaseRules: COMMIT_TYPE_RULES, releaseRulesFile: 'rules.json' })),
    ).rejects.toThrow(/pass one, not both/);
  });

  it('rejects --predict with no rules, rather than predicting against a rule set this package invented', async () => {
    repo = createTestRepo({ name: 'fixture', version: '1.4.0' });
    await expect(runBuildIdentity(flags({ repo: 'exadev/example', root: repo.root, predict: true }))).rejects.toThrow(/--release-rules/);
  });

  it('rejects rules supplied without --predict, rather than accepting a flag that would do nothing', async () => {
    repo = createTestRepo({ name: 'fixture', version: '1.4.0' });
    await expect(runBuildIdentity(flags({ repo: 'exadev/example', root: repo.root, releaseRules: COMMIT_TYPE_RULES }))).rejects.toThrow(/only take effect with --predict/);
  });

  it('emits prefixed KEY=VALUE lines in env format', async () => {
    repo = createTestRepo({ name: 'fixture', version: '1.4.0' });
    repo.tag('v1.4.0');
    const lines = (await runBuildIdentity(flags({ repo: 'exadev/example', root: repo.root, format: 'env', prefix: 'RELEASE_' }))).split('\n');
    expect(lines[0]).toBe('RELEASE_KIND=release');
    expect(lines[1]).toBe('RELEASE_VERSION=1.4.0');
  });
});
