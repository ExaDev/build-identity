import type { DisplayIdentity } from './types';

export type OutputFormat = 'json' | 'env';

export const OUTPUT_FORMATS: readonly OutputFormat[] = ['json', 'env'];

export function isOutputFormat(value: unknown): value is OutputFormat {
  return value === 'json' || value === 'env';
}

/** Every field of `DisplayIdentity`, in the order it is declared there. The `env` format derives its variable names by upper-casing these directly, so there is no second name mapping that could drift out of step with the type itself. */
const IDENTITY_FIELDS: readonly (keyof DisplayIdentity)[] = ['kind', 'version', 'url', 'date', 'commit'];

/** A prefix is glued straight onto an already-upper-case field name, so it only has to keep the result a legal shell/GitHub Actions variable name. An empty prefix is legitimate (bare `KIND=`, `VERSION=`, ...) for a caller that genuinely wants the unprefixed names. */
const ENV_PREFIX_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$|^$/;

export function isEnvPrefix(value: string): boolean {
  return ENV_PREFIX_PATTERN.test(value);
}

export interface FormatIdentityOptions {
  readonly format: OutputFormat;
  /** Prepended to each variable name in the `env` format; ignored by `json`. */
  readonly prefix: string;
}

/**
 * Renders a resolved identity for stdout, in whichever of the two formats the caller asked for.
 *
 * `json` emits the `DisplayIdentity` object verbatim -- the same five field names the library's own type declares, with no CLI-invented additions. In particular there is no separate `predicted` boolean: `kind` is already `'predicted'` in exactly that case, and a second field asserting the same fact would be one more thing every writer has to keep in step.
 *
 * `env` emits one `PREFIX_FIELD=value` line per field, upper-cased, ready to append straight to `$GITHUB_ENV` (or `eval`/`source` in a plain shell). Each repo maps these generic names onto whatever it calls them itself; this package never emits a consumer-specific name.
 */
export function formatIdentity(identity: DisplayIdentity, options: FormatIdentityOptions): string {
  if (options.format === 'json') {
    return JSON.stringify(identity, null, 2);
  }

  if (!isEnvPrefix(options.prefix)) {
    throw new Error(`--prefix must be empty or a legal variable-name prefix ([A-Za-z_][A-Za-z0-9_]*), got: ${JSON.stringify(options.prefix)}`);
  }

  return IDENTITY_FIELDS.map((field) => {
    const value = identity[field];
    // A newline inside a value would silently swallow the rest of the identity into one variable, or inject an arbitrary further variable, once appended to $GITHUB_ENV. None of git's own output can contain one, but `version` on a release build comes from package.json, which is only ever checked for being a non-empty string -- so this is a real corruption the CLI refuses to emit rather than a hypothetical one.
    if (/[\r\n]/.test(value)) {
      throw new Error(`${field} contains a line break, which cannot be represented as a KEY=VALUE line: ${JSON.stringify(value)}`);
    }
    return `${options.prefix}${field.toUpperCase()}=${value}`;
  }).join('\n');
}
