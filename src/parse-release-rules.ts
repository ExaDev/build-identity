import { isReleaseLevel, type ReleaseLevel, type ReleaseRule } from './predict-next-version';

function isUnknownArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

function isReleaseValue(value: unknown): value is ReleaseLevel | false {
  return value === false || isReleaseLevel(value);
}

export function isReleaseRule(value: unknown): value is ReleaseRule {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  if (!('release' in value) || !isReleaseValue(value.release)) {
    return false;
  }
  if ('breaking' in value) {
    return value.breaking === true;
  }
  if (!('type' in value)) {
    return false;
  }
  return typeof value.type === 'string' && value.type.length > 0;
}

/**
 * Validates a JSON array of `@semantic-release/commit-analyzer` release rules supplied on the command line, into the `ReleaseRule[]` `predictNextVersion` takes.
 *
 * The library deliberately hardcodes no rules of its own -- a repo's commit-type-to-release-level convention is real, repo-specific configuration -- so the CLI cannot either, and this is the only route by which it learns them. Every failure names `source` (the flag or file path the JSON came from) so a malformed rule set is traceable back to whichever of the two supplied it.
 */
export function parseReleaseRules(raw: string, source: string): ReleaseRule[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (cause) {
    throw new Error(`${source} is not valid JSON: ${cause instanceof Error ? cause.message : String(cause)}`, { cause });
  }

  if (!isUnknownArray(parsed)) {
    throw new Error(`${source} must be a JSON array of commit-analyzer release rules, e.g. [{"breaking":true,"release":"major"},{"type":"feat","release":"minor"}]`);
  }

  const rules: ReleaseRule[] = [];
  for (const [index, entry] of parsed.entries()) {
    if (!isReleaseRule(entry)) {
      throw new Error(`${source}: entry ${String(index)} must be {"type":<string>,"release":"major"|"minor"|"patch"|false} or {"breaking":true,"release":"major"|"minor"|"patch"|false}, got: ${JSON.stringify(entry)}`);
    }
    rules.push(entry);
  }
  return rules;
}
