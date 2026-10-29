## [3.0.2](https://github.com/ExaDev/build-identity/compare/v3.0.1...v3.0.2) (2026-10-29)

### Bug Fixes

* list every commit type in the release notes ([58112ba](https://github.com/ExaDev/build-identity/commit/58112ba5e3c9f65d9c8f2107ce19c2b031c3c677))

### Documentation

* list the commits behind each release that had an empty changelog entry ([f469aec](https://github.com/ExaDev/build-identity/commit/f469aecd0759eb3cea08793ba71597d5e2352fde))

## [3.0.1](https://github.com/ExaDev/build-identity/compare/v3.0.0...v3.0.1) (2026-10-29)

### Documentation

* give the npm trust command the workflow file name, not its path ([f88f8d8](https://github.com/ExaDev/build-identity/commit/f88f8d83dfdf045a8ed3722bc770bd97e50db35c))

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

### Chores

* upgrade turbo to 2.11.5 and disable agentGuidance ([5c4c950](https://github.com/ExaDev/build-identity/commit/5c4c950bd2488ca0fdbf8d4e669ea69ebe76f17d))

## [2.2.2](https://github.com/ExaDev/build-identity/compare/v2.2.1...v2.2.2) (2026-10-02)

### Documentation

* add live usage charts to the readme ([22e5d8c](https://github.com/ExaDev/build-identity/commit/22e5d8c5d78b888d505a3bcbbd1ea87a4e990a1c))

## [2.2.1](https://github.com/ExaDev/build-identity/compare/v2.2.0...v2.2.1) (2026-09-14)

### Documentation

* add the required hyphen to resolveBuildIdentity's [@param](https://github.com/param) tags ([742f066](https://github.com/ExaDev/build-identity/commit/742f066779a2893261d49d9af43b3463ac025806))
* escape the arrow's greater-than in tagName's doc comment ([b47f10d](https://github.com/ExaDev/build-identity/commit/b47f10d4d6d551336fd60cf4eb588f7210fd6e1e))
* quote @semantic-release/commit-analyzer and hyphenate predictNextVersion's [@param](https://github.com/param) tags ([1589dac](https://github.com/ExaDev/build-identity/commit/1589dac7fdc3f8588a6fff4ff6becc59ae8940ea))

### Build System

* **deps:** bump @exadev/eslint-config to exact 2.12.1 ([fcab8b0](https://github.com/ExaDev/build-identity/commit/fcab8b08e1fef7f0216d498c0cd9a69709d5b167))

### Chores

* bump the pinned package manager from pnpm 11.6.0 to 12.4.1 ([9ebe591](https://github.com/ExaDev/build-identity/commit/9ebe5913cb608b1f858b38ad78f40d122606edca))
* default future installs to exact versions, exempt eslint-config from the release-age gate ([c1f6440](https://github.com/ExaDev/build-identity/commit/c1f6440457c6fb9c223b932ecdca6ab35d9318db))

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
