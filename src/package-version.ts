import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Turns a version into the tag name expected to mark its release -- the shared default (and shared option shape) both `resolveBuildIdentity` and `predictNextVersion` accept, so a repo that tags differently only has to say so once per call site, not maintain two independent conventions. */
export function defaultTagName(version: string): string {
  return `v${version}`;
}

function isPackageJsonWithVersion(value: unknown): value is { version: string } {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  if (!('version' in value)) {
    return false;
  }
  return typeof value.version === 'string' && value.version.length > 0;
}

/** The single semantic-release-managed version, read from `package.json` at `repoRoot`'s root -- shared by `resolveBuildIdentity` (what this build's version is, if released) and `predictNextVersion` (the version to diff commits since). Throws rather than defaulting, matching this package's own "no sensible placeholder identity" stance. */
export function readPackageVersion(repoRoot: string): string {
  const packageJsonPath = join(repoRoot, 'package.json');
  const raw = readFileSync(packageJsonPath, 'utf8');
  const parsed: unknown = JSON.parse(raw);
  if (!isPackageJsonWithVersion(parsed)) {
    throw new Error(`${packageJsonPath} must contain a non-empty string "version" field`);
  }
  return parsed.version;
}
