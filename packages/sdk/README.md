# Chart Builder SDK

Public version-1 types, JSON schemas, runtime validators, capability checks, formatting, option merge and CSV helpers for Chart Builder adapters.

SDK release `0.1.0` accompanies Chart Builder `0.1.0`. Install `@wtroiano/chart-builder-sdk@^0.1.0` once published, or use the locally packed tarball. Package versions are independent of adapter API and payload schema version `1`. Before `1.0`, breaking SDK changes may arrive in a new minor version; patch releases within `0.1.x` preserve compatibility.

Import from `@wtroiano/chart-builder-sdk`; schemas are also exported at `@wtroiano/chart-builder-sdk/schemas/*.v1.json`. The SDK has no rendering-engine or Inertia dependency. React is a peer for adapter component types.

Implement `ChartAdapter` with a manifest, validation and lazy loader. Its module exports a component taking `ChartAdapterProps`; report a `ChartAdapterHandle` when ready and null when disposed. Match the manifest registered by the PHP package.

This repository's consumer adapter guide contains lifecycle, event, extension, export and versioning requirements. Run `npm run build:sdk` and pack this workspace to test a local, unpublished version.
