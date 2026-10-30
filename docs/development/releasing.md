# Releasing

PHP release `wtroiano/chart-builder` `0.1.1` adds the optional shadcn adapter to the `v0.1.0` baseline. The public SDK is unchanged and remains `@wtroiano/chart-builder-sdk` `0.1.0`; reuse its existing release tarball. Composer derives the PHP version from the Git tag; keep the `version` field out of `composer.json`.

Package versions are independent of wire contracts: adapter API and payload schema remain `1`; capability manifests are ECharts `1.0.0` and shadcn `1.1.0`. Both adapters declare SDK compatibility with `^0.1.0`. The private root npm workspace is development tooling. Before `1.0`, incompatible package changes require a new minor release and migration guidance; patches in `0.1.x` preserve compatibility.

## Validate the candidate

1. Run `composer test:release`, `npm run check`, `npm run test:package` and `npm run test:browser` (stop the interactive preview before the browser runner starts its server).
2. Verify highest/lowest PHP dependencies, SQLite/MySQL 8.4/MariaDB 11.4/PostgreSQL 17 and all three React/Inertia combinations in [Testing](testing.md).
3. Run the Boost discovery/copy tests and `sh .github/scripts/test-install.sh` for a clean Laravel consumer install, publishing and production build.
4. Run `npm run check:schema`. Regenerate schemas and the PHP fixture only for intentional contract changes; inspect the resulting diff.
5. Review runtime and development dependency audits. Resolve runtime advisories before release and record any remaining development-tool advisories separately.
6. Review [CHANGELOG](../../CHANGELOG.md), [verification results](verification.md), the README screenshots and the archives below. Keep new changes out of the already published `0.1.0` changelog section.

The full CI matrix must also pass on the exact candidate commit before a tag is published. Local checks do not establish a successful GitHub Actions run.

## Build the 0.1.1 artifacts

```sh
mkdir -p tmp/release/0.1.1
COMPOSER_ROOT_VERSION=0.1.1 composer archive --format=zip --dir=tmp/release/0.1.1 --file=chart-builder-0.1.1 --no-interaction
gh release download v0.1.0 --repo wtroiano86/chart-builder --pattern wtroiano-chart-builder-sdk-0.1.0.tgz --dir tmp/release/0.1.1
cp CHANGELOG.md tmp/release/0.1.1/RELEASE_NOTES.md
cd tmp/release/0.1.1
sha256sum chart-builder-0.1.1.zip wtroiano-chart-builder-sdk-0.1.0.tgz RELEASE_NOTES.md > SHA256SUMS
sha256sum --check SHA256SUMS
```

Verify the reused SDK tarball against its published `v0.1.0` checksum (`5d3c8ffaba5d71e80a39e2c5e77d8837a7633a3bf09d9acafceea598abe2e5fc`). If SDK source or schemas change, stop reusing that artifact and prepare a separately versioned SDK release with updated compatibility ranges.

Inspect both archives. The Composer archive includes PHP runtime, config, publishable React sources and adapter stylesheets, manifests/schemas, changelog, documentation, screenshots and Boost resources. It excludes tests, dependencies, workspaces, local tooling and temporary build artifacts. The SDK tarball includes dist, schemas, README, LICENSE and its npm manifest. Test the SDK in an independent consumer and verify the PHP archive in a disposable Laravel application before publishing.

```sh
sh .github/scripts/test-install.sh tmp/release/0.1.1/chart-builder-0.1.1.zip tmp/release/0.1.1/wtroiano-chart-builder-sdk-0.1.0.tgz
```

## Publish when ready

1. Commit and push the reviewed candidate to `wtroiano86/chart-builder`. Wait for every required CI job on that exact commit before merging/tagging.
2. Create an annotated `v0.1.1` tag on the approved commit and push it. Never move the existing `v0.1.0` tag or replace its assets.
3. Create the GitHub release from `v0.1.1`, use the reviewed release notes and attach the Composer ZIP, unchanged SDK tarball and checksums. Keep the development release marked as a GitHub prerelease.
4. Verify installation from the new GitHub tag and the SDK release tarball using [Getting started](../consumers/getting-started.md#install-release-011). Require PHP package `^0.1.1` when selecting shadcn.

The SDK is not yet published to npm. Its existing GitHub release tarball is the supported installation path. A first npm publication requires the maintainer's authorization and credentials; do not imply that a package-name installation works before it is available. If `0.1.0` is already present at publishing time, never republish that version. Packagist registration is also separate. This repository has no automatic publishing workflow.
