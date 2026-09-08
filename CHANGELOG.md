# [2.1.0](https://github.com/ExaDev/build-identity/compare/v2.0.0...v2.1.0) (2026-09-08)


### Bug Fixes

* keep commander within this package's own declared Node floor ([a2118c8](https://github.com/ExaDev/build-identity/commit/a2118c84747d902a9f1711a19da7eb3111688f2e))
* substitute printf placeholders in --verbose analyzer narration ([540970d](https://github.com/ExaDev/build-identity/commit/540970db5c628490a808cdf1dd87b57f2ae3ef54))


### Features

* expose the resolved identity as a build-identity command ([f4db417](https://github.com/ExaDev/build-identity/commit/f4db417c99393386081f7e9cb1e12df533118f6b))

# [2.0.0](https://github.com/ExaDev/build-identity/compare/v1.1.0...v2.0.0) (2026-09-08)


* feat!: model a predicted-but-unreleased build as its own DisplayIdentity kind ([02e1413](https://github.com/ExaDev/build-identity/commit/02e141362be05db07b0111fe61aace2d34866f54))


### Bug Fixes

* raise vitest's per-test timeout for subprocess-spawning tests ([c664a3a](https://github.com/ExaDev/build-identity/commit/c664a3a2bcb39146d573137879167e71a2b30c74))


### Features

* predict the next release version without semantic-release's own orchestrator ([fe16be0](https://github.com/ExaDev/build-identity/commit/fe16be0e66a4f2390fce6646dc94a14c3233adf1))


### BREAKING CHANGES

* resolvePredictedIdentity's return type is now
DisplayIdentity (kind: 'release' | 'predicted' | 'commit'), not
BuildIdentity & { predicted?: boolean }. An unreleased build with a
prediction now reports kind: 'predicted' instead of kind: 'commit' with
a separate predicted: true field.

# [1.1.0](https://github.com/ExaDev/build-identity/compare/v1.0.1...v1.1.0) (2026-09-08)


### Features

* expose the full commit SHA on BuildIdentity ([b18eeb9](https://github.com/ExaDev/build-identity/commit/b18eeb9903c7a01a2fc2a7309c6329aaf9eacaae))

## [1.0.1](https://github.com/ExaDev/build-identity/compare/v1.0.0...v1.0.1) (2026-09-08)


### Bug Fixes

* use author date, not committer date, for a commit's identity date ([5c54a99](https://github.com/ExaDev/build-identity/commit/5c54a99594f54c21360ff20578b473439b9a5a4b))

# 1.0.0 (2026-09-08)


### Features

* resolve a build's release-or-commit identity from git state ([6d76a70](https://github.com/ExaDev/build-identity/commit/6d76a706f0beabef8755a74f0062d07faa12c77b))
