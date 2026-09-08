import { describe, expect, it } from 'vitest';
import { formatIdentity, isEnvPrefix, isOutputFormat } from './format-identity';
import type { DisplayIdentity } from './types';

const RELEASE: DisplayIdentity = {
  kind: 'release',
  version: '1.4.0',
  url: 'https://github.com/exadev/example/releases/tag/v1.4.0',
  date: '2026-09-08T09:12:03+01:00',
  commit: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
};

describe('isOutputFormat', () => {
  it.each(['json', 'env'])('accepts %j', (value) => {
    expect(isOutputFormat(value)).toBe(true);
  });

  it.each([undefined, null, '', 'JSON', 'yaml', 'dotenv', 0])('rejects %j', (value) => {
    expect(isOutputFormat(value)).toBe(false);
  });
});

describe('isEnvPrefix', () => {
  it.each(['', 'BUILD_', 'RELEASE_', '_', 'a1_'])('accepts %j', (value) => {
    expect(isEnvPrefix(value)).toBe(true);
  });

  it.each(['1BUILD_', 'BUILD-', 'BUILD ', 'BUILD.', 'BUILD\n'])('rejects %j', (value) => {
    expect(isEnvPrefix(value)).toBe(false);
  });
});

describe('formatIdentity json', () => {
  it('emits exactly the DisplayIdentity fields, and no CLI-invented ones', () => {
    const parsed: unknown = JSON.parse(formatIdentity(RELEASE, { format: 'json', prefix: 'BUILD_' }));
    expect(parsed).toEqual(RELEASE);
    expect(Object.keys(RELEASE)).toEqual(['kind', 'version', 'url', 'date', 'commit']);
  });

  it('reports a predicted build through kind alone, not a second field', () => {
    const predicted: DisplayIdentity = { ...RELEASE, kind: 'predicted', version: '1.5.0' };
    const parsed: unknown = JSON.parse(formatIdentity(predicted, { format: 'json', prefix: 'BUILD_' }));
    expect(parsed).toEqual(predicted);
  });

  it('ignores the prefix, which only applies to the env format', () => {
    expect(formatIdentity(RELEASE, { format: 'json', prefix: 'ANYTHING_' })).toBe(formatIdentity(RELEASE, { format: 'json', prefix: '' }));
  });
});

describe('formatIdentity env', () => {
  it('emits one upper-cased, prefixed KEY=VALUE line per field, in declaration order', () => {
    expect(formatIdentity(RELEASE, { format: 'env', prefix: 'BUILD_' })).toBe(
      [
        'BUILD_KIND=release',
        'BUILD_VERSION=1.4.0',
        'BUILD_URL=https://github.com/exadev/example/releases/tag/v1.4.0',
        'BUILD_DATE=2026-09-08T09:12:03+01:00',
        'BUILD_COMMIT=a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
      ].join('\n'),
    );
  });

  it('applies a caller-supplied prefix', () => {
    expect(formatIdentity(RELEASE, { format: 'env', prefix: 'RELEASE_' }).split('\n')[0]).toBe('RELEASE_KIND=release');
  });

  it('emits bare field names for an empty prefix', () => {
    expect(formatIdentity(RELEASE, { format: 'env', prefix: '' }).split('\n')[0]).toBe('KIND=release');
  });

  it('rejects a prefix that would not be a legal variable name', () => {
    expect(() => formatIdentity(RELEASE, { format: 'env', prefix: '1BUILD_' })).toThrow(/--prefix/);
  });

  it.each(['\n', '\r'])('refuses to emit a value containing %j, rather than silently corrupting the KEY=VALUE stream', (lineBreak) => {
    const corrupt: DisplayIdentity = { ...RELEASE, version: `1.4.0${lineBreak}INJECTED=yes` };
    expect(() => formatIdentity(corrupt, { format: 'env', prefix: 'BUILD_' })).toThrow(/line break/);
  });
});
