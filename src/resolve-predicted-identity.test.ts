import { describe, expect, it } from 'vitest';
import { resolvePredictedIdentity } from './resolve-predicted-identity';
import type { BuildIdentity } from './types';

const release: BuildIdentity = {
  kind: 'release',
  version: '1.4.0',
  url: 'https://github.com/exadev/example/releases/tag/v1.4.0',
  date: '2026-01-01T00:00:00Z',
};

const commit: BuildIdentity = {
  kind: 'commit',
  version: 'abc1234',
  url: 'https://github.com/exadev/example/commit/abc1234def5678901234567890123456789abcd',
  date: '2026-01-02T00:00:00Z',
};

describe('resolvePredictedIdentity', () => {
  it('returns a release build unchanged, even when a prediction is supplied', () => {
    expect(resolvePredictedIdentity(release, '1.5.0')).toBe(release);
  });

  it('upgrades the displayed version for an unreleased build while keeping its commit URL', () => {
    const result = resolvePredictedIdentity(commit, '1.5.0');
    expect(result).toEqual({
      kind: 'commit',
      version: '1.5.0',
      url: commit.url,
      date: commit.date,
      predicted: true,
    });
  });

  it('trims surrounding whitespace from the predicted version', () => {
    const result = resolvePredictedIdentity(commit, '  1.5.0  ');
    expect(result.version).toBe('1.5.0');
  });

  it.each([undefined, '', '   '])('returns the commit build unchanged when predictedVersion is %j', (predicted) => {
    expect(resolvePredictedIdentity(commit, predicted)).toBe(commit);
  });

  it('never lets a predicted version leak into the URL -- a caller can never render a link to a release that does not exist', () => {
    const result = resolvePredictedIdentity(commit, '99.0.0');
    expect(result.url).toBe(commit.url);
    expect(result.url).not.toContain('99.0.0');
  });

  it('does no git or filesystem access of its own -- it is a pure transform of its two arguments', () => {
    const before = { ...commit };
    resolvePredictedIdentity(commit, '1.5.0');
    expect(commit).toEqual(before);
  });
});
