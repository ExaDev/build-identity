import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { defaultTagName, readPackageVersion } from './package-version';

describe('readPackageVersion', () => {
  let root: string | undefined;

  afterEach(() => {
    if (root !== undefined) rmSync(root, { recursive: true, force: true });
    root = undefined;
  });

  function writePackageJson(contents: string): string {
    root = mkdtempSync(join(tmpdir(), 'build-identity-package-version-'));
    writeFileSync(join(root, 'package.json'), contents);
    return root;
  }

  it("reads package.json's own version field, needing no git state at all -- the whole point of exposing this separately from resolveBuildIdentity, whose version is a release-or-commit identity rather than the plain field", () => {
    expect(readPackageVersion(writePackageJson(JSON.stringify({ name: 'fixture', version: '1.4.0' })))).toBe('1.4.0');
  });

  it('throws when package.json is missing entirely', () => {
    const emptyRoot = mkdtempSync(join(tmpdir(), 'build-identity-package-version-'));
    root = emptyRoot;
    expect(() => readPackageVersion(emptyRoot)).toThrow();
  });

  it('throws rather than defaulting when the version field is absent, the wrong type, or empty', () => {
    expect(() => readPackageVersion(writePackageJson(JSON.stringify({ name: 'fixture' })))).toThrow(/non-empty string "version"/);
    expect(() => readPackageVersion(writePackageJson(JSON.stringify({ name: 'fixture', version: 140 })))).toThrow(/non-empty string "version"/);
    expect(() => readPackageVersion(writePackageJson(JSON.stringify({ name: 'fixture', version: '' })))).toThrow(/non-empty string "version"/);
  });

  it('throws rather than defaulting when package.json is not an object at all', () => {
    expect(() => readPackageVersion(writePackageJson('"just a string"'))).toThrow(/non-empty string "version"/);
    expect(() => readPackageVersion(writePackageJson('null'))).toThrow(/non-empty string "version"/);
  });
});

describe('defaultTagName', () => {
  it('prefixes the version with v, the convention resolveBuildIdentity and predictNextVersion share by default', () => {
    expect(defaultTagName('1.4.0')).toBe('v1.4.0');
  });
});
