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
