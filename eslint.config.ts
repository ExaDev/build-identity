import { defineConfig } from 'eslint/config';
import exadev from '@exadev/eslint-config';

export default defineConfig(
  {
    ignores: ['dist', 'coverage', 'node_modules', '.turbo'],
  },
  {
    languageOptions: {
      parserOptions: { project: './tsconfig.json', tsconfigRootDir: import.meta.dirname },
    },
  },
  ...exadev,
  // src/index.ts is this package's own entry-point barrel. Keep it, don't ban it.
  { files: ['src/index.ts'], rules: { 'exadev/barrel-policy': ['error', { mode: 'single' }] } },
);
