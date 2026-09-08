import { defineConfig } from 'tsdown';

// Two build passes: the library ("." export, imported directly by a bundler's own config file) and the bin script. They differ in every setting that matters, which is why they are separate entries rather than one entry list.
export default defineConfig([
  {
    entry: ['src/index.ts'],
    root: 'src',
    format: ['esm', 'cjs'],
    dts: true,
    // The library itself only ever runs inside whatever toolchain imports it, and declares no platform assumptions of its own.
    platform: 'neutral',
    clean: true,
  },
  {
    // ESM only -- a bin script is executed, never require()'d, and nothing imports it for its types. The shebang (written as the literal first line of src/cli.ts) is preserved at the top of the output chunk by Rolldown, and tsdown's own shebang plugin chmods the resulting file during writeBundle, so no postbuild chmod +x step is needed.
    entry: ['src/cli.ts'],
    root: 'src',
    format: ['esm'],
    dts: false,
    // Unlike the library, the bin script genuinely is a node program: it reads process.argv, writes to process.stdout/stderr, and sets an exit code.
    platform: 'node',
    // Must not clean: this pass runs after the library pass above, into the same dist directory.
    clean: false,
    // platform: 'node' defaults fixedExtension to true (always .mjs/.cjs), which would emit dist/cli.mjs and not match package.json's bin field (./dist/cli.js). Disabling it lets the extension follow package.json's "type": "module" instead.
    fixedExtension: false,
  },
]);
