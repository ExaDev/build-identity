import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Vitest's own 5000ms default assumes pure in-memory JS. Most of this package's tests spawn several real `git` subprocesses per test (createTestRepo, .tag(), .commit(), the resolve/predict functions themselves), and predict-next-version.test.ts additionally loads and runs the real @semantic-release/commit-analyzer package -- both genuinely I/O- and process-bound, not slow logic, so they need real headroom rather than a tighter number tuned to this machine's current load.
    testTimeout: 20000,
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts'],
    },
  },
});
