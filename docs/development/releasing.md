# Releasing

The first release is `0.1.0` for both `wtroiano/chart-builder` and `@wtroiano/chart-builder-sdk`. Composer derives its version from the Git tag `v0.1.0`; keep the `version` field out of `composer.json`. The npm version lives in `packages/sdk/package.json` and the root lockfile. The private root npm workspace is development tooling.

Package versions are independent of wire contracts: adapter API and payload schema remain `1`, and the ECharts capability manifest remains `1.0.0`. Both copies of the ECharts manifest and the independent adapter fixture declare SDK compatibility with `^0.1.0`. Keep these ranges, consumer installation examples and release notes synchronized. Before `1.0`, incompatible package changes require a new minor release and migration guidance; patches in `0.1.x` preserve compatibility.

## Validate the candidate

1. Run `composer test:release`, `npm run check`, `npm run test:package` and `npm run test:browser` (stop the interactive preview before the browser runner starts its server).
2. Verify highest/lowest PHP dependencies, SQLite/MySQL 8.4/MariaDB 11.4/PostgreSQL 17 and all three React/Inertia combinations in [Testing](testing.md).
3. Run the Boost discovery/copy tests and `sh .github/scripts/test-install.sh` for a clean Laravel consumer install, publishing and production build.
4. Run `npm run check:schema`. Regenerate schemas and the PHP fixture only for intentional contract changes; inspect the resulting diff.
5. Review runtime and development dependency audits. Resolve runtime advisories before release and record any remaining development-tool advisories separately.
6. Review [CHANGELOG](../../CHANGELOG.md), [verification results](verification.md), the README screenshots and the archives below.

The full CI matrix must also pass on the exact candidate commit before a tag is published. Local checks do not establish a successful GitHub Actions run.

## Build the 0.1.0 artifacts

```sh
mkdir -p tmp/release/0.1.0
COMPOSER_ROOT_VERSION=0.1.0 composer archive --format=zip --dir=tmp/release/0.1.0 --file=chart-builder-0.1.0 --no-interaction
npm run build:sdk
npm pack --workspace=@wtroiano/chart-builder-sdk --pack-destination=tmp/release/0.1.0
cp CHANGELOG.md tmp/release/0.1.0/RELEASE_NOTES.md
cd tmp/release/0.1.0
sha256sum chart-builder-0.1.0.zip wtroiano-chart-builder-sdk-0.1.0.tgz RELEASE_NOTES.md > SHA256SUMS
sha256sum --check SHA256SUMS
```

Inspect both archives. The Composer archive includes PHP runtime, config, publishable React sources, manifests/schemas, changelog, documentation, screenshots and Boost resources. It excludes tests, dependencies, workspaces, local tooling and temporary build artifacts. The SDK tarball includes dist, schemas, README, LICENSE and its npm manifest. Test the packed SDK in an independent consumer; verify both artifacts in a disposable Laravel application before publishing.

## Publish when ready

1. Commit and push the reviewed candidate to `wtroiano86/chart-builder`, including the workflows, release notes and screenshots. Wait for every required CI job on that commit.
2. Create an annotated `v0.1.0` tag on that exact commit and push it. Never move a published tag; corrections require another release.
3. Publish the reviewed SDK tarball to npm with public access, using the maintainer's authorized credentials. The SDK workspace declares `publishConfig.access` as `public`.
4. Create the GitHub release from `v0.1.0`, use the prepared release notes and attach the Composer ZIP, SDK tarball and checksums. Mark this initial development release as a GitHub prerelease.
5. Verify installation from the GitHub tag and npm registry using [Getting started](../consumers/getting-started.md#install-release-010). Until Packagist registration, consumers use the documented Composer VCS repository; the SDK tarball also supports installation without npm publication.

Packagist registration and registry publication are separate from preparing the release. This repository has no automatic publishing workflow.
