## [3.0.1](https://github.com/ExaDev/build-identity/compare/v3.0.0...v3.0.1) (2026-10-29)

# [3.0.0](https://github.com/ExaDev/build-identity/compare/v2.2.3...v3.0.0) (2026-10-13)


* feat!: find the last release from tags, not package.json ([cc229ce](https://github.com/ExaDev/build-identity/commit/cc229ce159aa49e074f0473632fdde83172d7a6c))


### Bug Fixes

* refuse to predict from a shallow or tagless clone ([7fcaae2](https://github.com/ExaDev/build-identity/commit/7fcaae216e9b995cc83d902119e512c62ed8deb6))
* report a release whenever a release tag points at HEAD ([8bcf97a](https://github.com/ExaDev/build-identity/commit/8bcf97aeb603a8f9c0f88923ab220430b5729834))
* run git against repoRoot even when a hook exports GIT_DIR ([72fcff0](https://github.com/ExaDev/build-identity/commit/72fcff037527acff082ecef253addfeb0b2f3d3d))


### BREAKING CHANGES

* the tagName function option of resolveBuildIdentity
and predictNextVersion is replaced by tagTemplate, a string holding
{version} exactly once (the CLI's --tag-name template, unchanged).
readPackageVersion and package.json reading are removed; findLastRelease
gives the last released version from tags instead.

## [2.2.3](https://github.com/ExaDev/build-identity/compare/v2.2.2...v2.2.3) (2026-10-06)

## [2.2.2](https://github.com/ExaDev/build-identity/compare/v2.2.1...v2.2.2) (2026-10-02)

## [2.2.1](https://github.com/ExaDev/build-identity/compare/v2.2.0...v2.2.1) (2026-09-14)

# [2.2.0](https://github.com/ExaDev/build-identity/compare/v2.1.0...v2.2.0) (2026-09-08)


### Features

* expose readPackageVersion as a public export ([04724b9](https://github.com/ExaDev/build-identity/commit/04724b9abfb369900095d88411ba4369c1fc77d8))

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
