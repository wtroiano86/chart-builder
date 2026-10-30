# Release 0.1.0 verification

Verified locally on 2026-10-23 for package/SDK `0.1.0`, with PHP 8.5.12, Node 22.23.4 and the repository's [quality gates](testing.md).

| Check | Result |
| --- | --- |
| Pint, Rector, PHPStan max | Passed |
| Pest architecture and behavior | 101 tests, 335 assertions |
| PHP type coverage | 100% |
| PHP production line coverage | 100% |
| Highest PHP dependency set | Passed; Laravel 13.38.0, Pest 5.3.3, PHPStan 2.3.1 |
| Lowest resolvable PHP dependency set | Passed; Laravel 13.30.0, Pest 5.2.1, PHPStan 2.2.16 |
| SQLite, MySQL 8.4.11, MariaDB 11.4.13, PostgreSQL 17.11 | 101 tests / 335 assertions passed on each |
| React 18.3.1 / Inertia 2.3.29 | Type checks, 16 unit tests, build and five browser scenarios passed |
| React 19.3.1 / Inertia 2.3.29 | Type checks, 16 unit tests, build and five browser scenarios passed |
| React 19.3.1 / Inertia 3.9.1 | Type checks, 16 unit tests, build and five browser scenarios passed |
| React unit tests | 16 tests |
| Chromium / axe | Five scenarios per frontend combination, including the live PHP demo and 36 gallery examples |
| SDK tarball and independent adapter consumer | Type checks, imports and engine-free core bundle passed |
| Fresh Laravel app | Provider discovery, publishing, generation, Inertia HTTP result, TypeScript and production build passed |
| Boost 2.10.3 | Guideline/skill discovery, rendering and nested resource copying passed |
| Documentation and Composer archive | Links, snippets, skill metadata and distribution contents passed |
| Composer and npm security audits | No vulnerability advisories reported |

The lowest dependency run emits deprecation notices from its older Symfony translation helper and architecture-test reflection code: Pest reports 99 passing and two deprecated tests, with all 335 assertions successful. Static analysis and 100% coverage pass. These upstream notices are not suppressed. Composer also reports the development-only `symplify/rule-doc-generator-contracts` dependency of `driftingly/rector-laravel` as abandoned, with no suggested replacement; it is excluded from the distributed package.

The browser fixture exercises real Inertia clients against a contract server. A separate disposable Laravel application verifies installation and PHP/Inertia integration. The full ECharts adapter is a lazy chunk; smaller bundles require the documented modular adapter configuration.

Generated schemas and the PHP/JavaScript ECharts manifests are compared by `npm run check:schema`. The tested SDK uses API/payload version `1` and package version `0.1.0`; the ECharts manifest stays at its independent version `1.0.0` and declares SDK range `^0.1.0`. Local release artifacts, release notes and SHA-256 checksums are produced in `tmp/release/0.1.0`; they have not been published or tagged. Passing GitHub Actions on the candidate commit remains a publication gate.

The release browser runs complete in approximately 10–12 seconds per combination. Test screenshots and the four committed README captures were visually inspected in addition to SVG and accessibility assertions. The README captures show six actual PHP-generated charts and their shared controls.

## Shadcn adapter verification — 2026-10-30

The optional adapter was checked with PHP 8.5.12, Laravel 13.38.0, Node 22.23.4 and Recharts 3.10.1. Pint, Rector, PHPStan max, all 113 Pest architecture/behavior tests (361 assertions), 100% PHP type coverage and 100% production line coverage passed. This change used SQLite 3.53.4; the MySQL, MariaDB, PostgreSQL and lowest PHP dependency matrices were not repeated.

The frontend checks passed on React 18.3.1/Inertia 2.3.29, React 19.3.1/Inertia 2.3.29 and React 19.3.1/Inertia 3.9.1. Each combination ran TypeScript, 36 React tests, production builds and six Chromium scenarios. The shadcn scenario renders eleven presets using real SVG paths and checks formatted tooltips, row filtering, dark theme, narrow layouts, accessible data/CSV, denial clearing and axe accessibility. Unit tests additionally cover lazy loading/SSR, capability rejection, row identities/events, StrictMode cleanup, resizing, custom formatting, null/zero values, category alignment and stable slice colors.

Generated schemas remained unchanged; both bundled manifest pairs match. The isolated packed-SDK consumer verifies an engine-free core, a shadcn build without ECharts, and Recharts in lazy chunks. The fresh Laravel 13 installation smoke verifies provider discovery, the default and optional publishing paths, both PHP adapter results, TypeScript and the production build. Documentation, distribution and Boost 2.10.3 fixture checks passed. Disposable consumer directories and archives are removed by the check scripts; logs and browser artifacts remain under `tmp`.

The release gate passed after updating the ignored local dependency lock from Symfony Mime 8.1.7 to 8.1.10 for CVE-2026-45070. No dependency constraints or audit gates were relaxed. The core SDK and payload schemas remain at version 1; the optional shadcn manifest is version `1.0.0`. At this initial checkpoint shadcn supported CSV through the shared frame, before image export was added; its full supported subset is in the [consumer guide](../consumers/shadcn.md).

## Shadcn image export verification — 2026-10-30

Shadcn manifest `1.1.0` advertises SVG and PNG exports from SVG rendering. PHP 8.5.12/Laravel 13.38.0 checks passed with Pint, Rector, PHPStan max, 113 Pest architecture/behavior tests (363 assertions), 100% PHP type coverage and 100% production line coverage. The database tested for this change was SQLite 3.53.4; MySQL, MariaDB, PostgreSQL and the lowest PHP dependency matrix were not repeated.

React 18.3.1/Inertia 2.3.29, React 19.3.1/Inertia 2.3.29 and React 19.3.1/Inertia 3.9.1 each passed TypeScript, formatting, all 55 React tests, production builds and 17 Chromium scenarios, using Recharts 3.10.1. The browser checks download both formats for all eleven shadcn families, decode the saved files without application CSS, and inspect dimensions and painted pixels. They also verify resolved CSS colors, legend text, filtered dark-theme exports and a 2× PNG with a custom background. A downloaded PNG was visually inspected. Unit tests cover invalid requests, dimension limits, disposal, font loading, decoding/encoding failures, URL cleanup and suppression of pending downloads after denial, scope changes, snapshot changes or unmounting.

Generated schemas remain unchanged and PHP/JavaScript manifests match. Packed-SDK consumer checks confirm engine-free core imports and lazy Recharts loading. The fresh Laravel 13 installation smoke passed publishing, PHP/Inertia integration, TypeScript and production builds. Documentation, distribution and Boost fixture checks passed. The pinned React 19/Inertia 3 dependencies were restored after the matrix runs. Logs and local export/browser artifacts are retained under `tmp`; no release was published.

## Shadcn preview styling verification — 2026-10-30

The preview now compiles the upstream shadcn fixture's utilities with Tailwind 4.3.3 and provides light/dark theme tokens. The gallery expands the two-row PHP contract fixture to six illustrative months, with distinct forecast values. Its card and control styling is scoped to the gallery; Tailwind Preflight is not loaded. No payload schema, manifest or production adapter behavior changed.

On React 19.3.1/Inertia 3.9.1, TypeScript, formatting, 55 React tests, production builds and all 17 Chromium scenarios passed. The browser assertions now check computed layout, legend swatch sizes, tooltip background/padding/shadow, theme color changes and six rendered points, alongside existing accessibility and export checks. Light, dark and tooltip screenshots were visually inspected. React 18 and Inertia 2 combinations were not repeated for this preview-only change.

The PHP release gate passed on PHP 8.5.12/Laravel 13.38.0 with SQLite 3.53.4: Pint, Rector, PHPStan max, 113 tests/363 assertions, and 100% type and production line coverage. Other databases and the lowest dependency set were not repeated. SDK packing, the independent adapter consumer, documentation, distribution and Boost fixture checks passed. Logs and before/after screenshots are under `tmp/shadcn-style-*`.

## Shadcn merge and release review — 2026-10-30

Reviewed the complete `feature/shadcn` working tree against the declared adapter subset, versioned contracts, authorization/data boundaries, lifecycle, exports, application styling, distribution and release instructions. The PHP `0.1.1` candidate retains the published SDK `0.1.0`; SDK source and schemas are unchanged from `v0.1.0`. Both bundled manifest pairs match, and the default publish tag still excludes shadcn and its Recharts dependency.

The review corrected side legends that ignored vertical layout, axis labels that missed theme styles after Recharts markup changes, missing tooltip color indicators, palette collisions between Revenue and Forecast, and preview reloads that repeated adapter registration. Palette allocation now uses free slots before repeating and retains current identity assignments across updates, with bounded retained state. Browser tests exercise actual legend positions, themed ticks, distinct series colors and exported legend geometry. The independent SDK consumer now reads installed dependency versions, so each React/Inertia matrix entry really tests that combination.

| Local check | Result |
| --- | --- |
| Pint, Rector, PHPStan max, Pest architecture/behavior | Passed; 113 tests / 363 assertions |
| PHP type and production line coverage | 100% each |
| Highest PHP dependencies | Passed; Laravel 13.39.0, Pest 5.3.4, PHPStan 2.3.4 |
| Lowest resolvable PHP dependencies | Passed; Laravel 13.30.0, Pest 5.2.1, PHPStan 2.2.16 |
| SQLite 3.53.4 | Tested with the local, highest and lowest PHP dependency sets |
| MySQL 8.4.11, MariaDB 11.4.13, PostgreSQL 17.11 | 113 tests / 363 assertions on each with the local Laravel 13.38.0 dependencies |
| React 18.3.1 / Inertia 2.3.29 | TypeScript, formatting, 57 React tests, build, 18 Chromium scenarios and isolated packed consumer passed |
| React 19.3.1 / Inertia 2.3.29 | Same checks passed |
| React 19.3.1 / Inertia 3.9.1 | Same checks passed; pinned dependencies restored afterward |
| Fresh Laravel 13.39.0 consumer | Local checkout and extracted PHP ZIP with the published SDK tarball both passed discovery, publishing, PHP/Inertia response, TypeScript and production build |
| SDK / engine boundaries | Packed SDK types/imports, engine-free core and lazy Recharts without ECharts passed |
| Documentation, distribution, Boost 2.10.3 | Passed; adapter CSS is required in the archive |

All frontend runs used Node 22.23.4 and Recharts 3.10.1. SVG and PNG downloads were decoded and inspected for every declared chart family. Light/dark styling and side legends were visually inspected; touching the rendering module caused a clean preview reload with eleven charts and no browser errors. The temporary database containers were removed after their runs.

The local development lock was updated from Pest 5.3.3/PHPUnit 13.4.3 to Pest 5.3.4/PHPUnit 13.4.5 to resolve the PHPUnit advisory reported by the full audit. No dependency constraints or audit exclusions changed. Composer runtime audits and npm audits report no vulnerability advisories; full Composer audits have empty advisory lists but return a nonzero maintenance status for Rector's existing abandoned development-only `symplify/rule-doc-generator-contracts` dependency. The lowest dependency suite reports 111 passing and two deprecated cases (all 363 assertions pass), with its upstream notices unsuppressed.

Release instructions now preserve the already published `v0.1.0` history and prepare PHP `0.1.1`. The public SDK npm name currently returns 404; installation uses the verified, publicly downloadable `v0.1.0` GitHub tarball. Its SHA-256 is `5d3c8ffaba5d71e80a39e2c5e77d8837a7633a3bf09d9acafceea598abe2e5fc`. Candidate artifacts and checksums are under `tmp/release/0.1.1`; logs and screenshots use `tmp/shadcn-review-*`.

At completion of this local review, the documented subset was validated as a merge/release candidate and the changes were still uncommitted. The earlier successful remote run belonged to the previous `main` commit. The release workflow requires the full GitHub Actions matrix on the reviewed commit before merge/tagging; see that commit’s GitHub checks for the subsequent CI result. No merge, tag or registry publication was performed as part of the local review itself.
