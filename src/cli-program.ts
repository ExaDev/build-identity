import { readFileSync } from 'node:fs';
import { format } from 'node:util';
import { Command, InvalidArgumentError, Option } from 'commander';
// resolveJsonModule lets rolldown (via tsdown) inline this package's own declared version straight into the bundle at build time -- no runtime fs read.
import { version as packageVersion } from '../package.json';
import { formatIdentity, isEnvPrefix, isOutputFormat, OUTPUT_FORMATS, type OutputFormat } from './format-identity';
import { loadCommitAnalyzer } from './load-commit-analyzer';
import { defaultTagName } from './package-version';
import { parseReleaseRules } from './parse-release-rules';
import { predictNextVersion, type PredictNextVersionOptions, type ReleaseRule } from './predict-next-version';
import { resolveBuildIdentity } from './resolve-build-identity';
import { resolvePredictedIdentity } from './resolve-predicted-identity';

const VERSION_PLACEHOLDER = '{version}';
export const DEFAULT_TAG_TEMPLATE = `v${VERSION_PLACEHOLDER}`;
export const DEFAULT_ENV_PREFIX = 'BUILD_';

/** `predictNextVersion` narrates through a caller-supplied logger and explicitly warns against routing it to stdout, which carries the machine-readable result. `--verbose` sends it to stderr instead, so a CI step can see why a prediction came out the way it did without contaminating what the next step parses. */
const STDERR_LOGGER = {
  log: (...args: readonly unknown[]): void => { writeStderr(args); },
  error: (...args: readonly unknown[]): void => { writeStderr(args); },
};

// node:util's format, not a plain join: commit-analyzer narrates with printf-style placeholders ("Analyzing commit: %s", message), which any other joining strategy would leave in the output verbatim next to the value meant to replace them.
function writeStderr(args: readonly unknown[]): void {
  process.stderr.write(`${format(...args)}\n`);
}

/**
 * A `{version}` template rather than a function, since a command line cannot carry one: `resolveBuildIdentity` and `predictNextVersion` are both given the same resulting function, keeping "which tag marks a release" one convention across the two calls exactly as the library's own docs advise.
 */
function parseTagTemplate(template: string): (version: string) => string {
  if (!template.includes(VERSION_PLACEHOLDER)) {
    throw new InvalidArgumentError(`--tag-name must contain the ${VERSION_PLACEHOLDER} placeholder, got: ${JSON.stringify(template)}`);
  }
  return (version: string): string => template.replaceAll(VERSION_PLACEHOLDER, version);
}

function parseFormat(value: string): OutputFormat {
  if (!isOutputFormat(value)) {
    throw new InvalidArgumentError(`--format must be one of: ${OUTPUT_FORMATS.join(', ')}`);
  }
  return value;
}

function parsePrefix(value: string): string {
  if (!isEnvPrefix(value)) {
    throw new InvalidArgumentError(`--prefix must be empty or a legal variable-name prefix ([A-Za-z_][A-Za-z0-9_]*), got: ${JSON.stringify(value)}`);
  }
  return value;
}

function parseInlineReleaseRules(value: string): ReleaseRule[] {
  try {
    return parseReleaseRules(value, '--release-rules');
  } catch (cause) {
    throw new InvalidArgumentError(cause instanceof Error ? cause.message : String(cause));
  }
}

export interface CliFlags {
  readonly repo: string;
  readonly root: string;
  readonly tagName: (version: string) => string;
  readonly predict: boolean | undefined;
  readonly releaseRules: readonly ReleaseRule[] | undefined;
  readonly releaseRulesFile: string | undefined;
  readonly format: OutputFormat;
  readonly prefix: string;
  readonly verbose: boolean | undefined;
}

function readReleaseRulesFile(path: string): ReleaseRule[] {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (cause) {
    throw new Error(`--release-rules-file ${path} could not be read: ${cause instanceof Error ? cause.message : String(cause)}`, { cause });
  }
  return parseReleaseRules(raw, `--release-rules-file ${path}`);
}

/**
 * The whole CLI as a function of its already-parsed flags: resolves the identity and returns the exact text the command prints, so the wiring between the library's three functions is testable without a subprocess and without capturing stdout.
 *
 * Prediction is gated behind `--predict` rather than inferred: it needs `@semantic-release/commit-analyzer`, an optional peer dependency of this package, and reads the whole commit range since the last tag. Both are real costs a caller that only wants `resolveBuildIdentity`'s answer should not silently pay.
 */
export async function runBuildIdentity(flags: CliFlags): Promise<string> {
  if (flags.releaseRules !== undefined && flags.releaseRulesFile !== undefined) {
    throw new Error('--release-rules and --release-rules-file are alternatives; pass one, not both');
  }

  const rules = flags.releaseRules ?? (flags.releaseRulesFile === undefined ? undefined : readReleaseRulesFile(flags.releaseRulesFile));

  if (flags.predict === true && rules === undefined) {
    throw new Error('--predict needs this repo\'s own commit-type release rules: pass --release-rules or --release-rules-file');
  }
  if (flags.predict !== true && rules !== undefined) {
    throw new Error('--release-rules/--release-rules-file only take effect with --predict, which was not passed');
  }

  const build = resolveBuildIdentity(flags.root, flags.repo, { tagName: flags.tagName });

  let predictedVersion: string | undefined;
  if (rules !== undefined) {
    const options: PredictNextVersionOptions = { tagName: flags.tagName, ...(flags.verbose === true ? { logger: STDERR_LOGGER } : {}) };
    predictedVersion = await predictNextVersion(flags.root, rules, await loadCommitAnalyzer(), options);
  }

  return formatIdentity(resolvePredictedIdentity(build, predictedVersion), { format: flags.format, prefix: flags.prefix });
}

/**
 * Builds the commander program without parsing argv or exiting the process, so the command tree stays testable in isolation. There is no subcommand: the package does exactly one thing, and a subcommand naming it again would be pure ceremony.
 */
export function createProgram(): Command {
  const program = new Command('build-identity');
  program.description("Resolve a build's true identity -- a real, already-tagged release, or the commit it was built from -- from live git state, with an optional predicted-version display layer.");
  program.version(packageVersion);

  program.requiredOption('--repo <owner/repo>', 'GitHub slug used to build the release and commit URLs, e.g. exadev/build-identity');
  program.addOption(
    new Option('--root <directory>', 'git working tree to inspect; must contain package.json at its root').default(process.cwd(), 'the current working directory'),
  );
  // The default is described rather than shown: commander renders a default value through JSON.stringify, which turns the tagName function into nothing at all.
  program.addOption(
    new Option('--tag-name <template>', `tag name marking a release, with ${VERSION_PLACEHOLDER} standing in for the version`)
      .argParser(parseTagTemplate)
      .default(defaultTagName, DEFAULT_TAG_TEMPLATE),
  );
  program.option('--predict', "also predict the version this commit's next release would be, and show that instead of a bare commit hash when there is no release tag on HEAD");
  program.option('--release-rules <json>', 'commit-analyzer release rules for --predict, as a JSON array', parseInlineReleaseRules);
  program.option('--release-rules-file <path>', 'file holding the same JSON array as --release-rules, for a rule set too awkward to quote inline');
  // parseFormat rather than commander's own .choices(), so the parsed value is genuinely narrowed to OutputFormat rather than left a bare string that only happens to be one of them.
  program.option('--format <format>', `output format: ${OUTPUT_FORMATS.join(' or ')}`, parseFormat, 'json');
  program.option('--prefix <prefix>', 'prepended to each variable name in --format env', parsePrefix, DEFAULT_ENV_PREFIX);
  program.option('--verbose', "send commit-analyzer's own per-commit narration to stderr");

  program.action(async (flags: CliFlags) => {
    process.stdout.write(`${await runBuildIdentity(flags)}\n`);
  });

  return program;
}
