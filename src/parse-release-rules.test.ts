import { describe, expect, it } from 'vitest';
import { isReleaseRule, parseReleaseRules } from './parse-release-rules';

describe('isReleaseRule', () => {
  it.each([
    { type: 'feat', release: 'minor' },
    { type: 'fix', release: 'patch' },
    { type: 'chore', release: false },
    { breaking: true, release: 'major' },
  ])('accepts %j', (value) => {
    expect(isReleaseRule(value)).toBe(true);
  });

  it.each([
    undefined,
    null,
    'feat',
    [],
    {},
    { type: 'feat' },
    { release: 'minor' },
    { type: 'feat', release: 'breaking' },
    { type: 'feat', release: true },
    { type: '', release: 'minor' },
    { type: 42, release: 'minor' },
    { breaking: false, release: 'major' },
  ])('rejects %j', (value) => {
    expect(isReleaseRule(value)).toBe(false);
  });
});

describe('parseReleaseRules', () => {
  it('parses a real rule set', () => {
    const raw = '[{"breaking":true,"release":"major"},{"type":"feat","release":"minor"},{"type":"chore","release":false}]';
    expect(parseReleaseRules(raw, '--release-rules')).toEqual([
      { breaking: true, release: 'major' },
      { type: 'feat', release: 'minor' },
      { type: 'chore', release: false },
    ]);
  });

  it('accepts an empty rule set, which is a real (if unhelpful) configuration rather than an error', () => {
    expect(parseReleaseRules('[]', '--release-rules')).toEqual([]);
  });

  it('names the source in a malformed-JSON failure', () => {
    expect(() => parseReleaseRules('[{', '--release-rules-file rules.json')).toThrow(/--release-rules-file rules\.json is not valid JSON/);
  });

  it('rejects JSON that is not an array', () => {
    expect(() => parseReleaseRules('{"type":"feat","release":"minor"}', '--release-rules')).toThrow(/must be a JSON array/);
  });

  it('names the offending entry index', () => {
    expect(() => parseReleaseRules('[{"type":"feat","release":"minor"},{"type":"fix","release":"nope"}]', '--release-rules')).toThrow(/entry 1 must be/);
  });
});
