#!/usr/bin/env node
import { createProgram } from './cli-program';

// This file is deliberately nothing but the bootstrap: everything worth testing lives in ./cli-program, which has no top-level side effects, so importing it from a test never parses the test runner's own argv. parseAsync rather than parse: the action is async, and a sync parse would surface any failure as an unhandled rejection instead of the message and exit code below. Usage failures (a missing required option, --help, --version) never reach here at all -- commander reports and exits on those itself -- so everything caught here is a genuine failure of the resolution this command exists to do.
createProgram()
  .parseAsync(process.argv)
  .catch((cause: unknown) => {
    process.stderr.write(`build-identity: ${cause instanceof Error ? (cause.stack ?? cause.message) : String(cause)}\n`);
    process.exitCode = 1;
  });
