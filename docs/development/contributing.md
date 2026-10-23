# Development conventions

Follow PHP 8.5/Laravel 13 and the sibling Table Builder standards. Use strict types, final concrete classes, small public contracts and explicit generics. PHPStan runs at max. Do not add suppressions, widen types to hide errors, lower coverage gates or exclude untested production code.

Keep identifiers stable, authorize before providers/cache access, validate filters before queries, and check expansion budgets before allocation. Do not embed engine options into the portable core or eagerly import engines from the SDK/shared UI.

Frontend code uses strict TypeScript, React effects for browser resources, scoped CSS and typed event/reference contracts. Use shared formatting and accessible data paths. Match supported Inertia versions through the transport boundary.

For a contract change, update SDK types, regenerate schemas, adapt PHP serializers/validators, update the real PHP fixture, add meaningful behavior tests, and revise docs and Boost resources. The fixture update is intentional: run Pest with `UPDATE_REACT_CONTRACT=1` only when the wire change is understood.

[Testing](testing.md) lists gates; [agent workflow](agent-workflow.md) describes repository automation.
