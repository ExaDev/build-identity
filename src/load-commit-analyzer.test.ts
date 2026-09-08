import { describe, expect, it } from 'vitest';
import { loadCommitAnalyzer } from './load-commit-analyzer';

describe('loadCommitAnalyzer', () => {
  it('resolves to a callable analyzeCommits function', async () => {
    const analyzeCommits = await loadCommitAnalyzer();

    expect(typeof analyzeCommits).toBe('function');
  });

  it('resolves to a function that genuinely runs commit-analyzer -- not a stub -- when called with real commits and rules', async () => {
    const analyzeCommits = await loadCommitAnalyzer();

    const releaseType = await analyzeCommits(
      { releaseRules: [{ type: 'feat', release: 'minor' }] },
      {
        commits: [{ hash: 'abc123', message: 'feat: add a thing' }],
        logger: { log: () => undefined, error: () => undefined },
        cwd: process.cwd(),
      },
    );

    expect(releaseType).toBe('minor');
  });
});
