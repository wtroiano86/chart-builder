# Laravel Boost resources

The Composer archive includes `resources/boost/guidelines/core.blade.php` and three consumer skills:

- chart-builder-development: PHP definitions, authorization, datasets and aggregation.
- chart-builder-react: published components, Inertia state and frontend integration.
- chart-builder-adapters: public SDK, manifests, renderer lifecycle and exports.

These are application-consumer resources. They do not install agent configuration into this package repository. Their instructions point to the installed package's consumer docs.

The isolated Boost smoke test uses released Boost 2.10.3 to discover the package, render its guideline, parse all skills and copy nested reference material into a disposable fixture. See [testing](development/testing.md). It does not claim compatibility with every agent client or future Boost release.
