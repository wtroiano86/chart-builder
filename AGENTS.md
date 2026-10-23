# Chart Builder contributor instructions

Use PHP 8.5/Laravel 13 and the same quality gates as the sibling Table Builder package. Read [Contributing](docs/development/contributing.md), [Testing](docs/development/testing.md), and the [specification](docs/specification.md).

Keep PHP serialization, SDK types/schemas, React consumers, documentation, and Boost resources consistent. Preserve authorization before data/cache access and bound normalization before expansion. Rendering engines belong in adapters; the SDK and shared UI must not import them eagerly.

Run Pint, Rector, PHPStan at max, Pest architecture/behavior/type coverage/100% line coverage, TypeScript, formatting, React tests, browser tests, documentation and distribution checks. Do not weaken gates or add exclusions to conceal untested production behavior. Report the database and frontend combinations actually tested. Consumer Boost resources must not install agent configuration in this repository.
