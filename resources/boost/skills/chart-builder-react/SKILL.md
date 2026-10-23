---
name: chart-builder-react
description: Integrate Chart Builder published React components with Inertia page props, deferred data, filters, polling, state and accessible exports.
---

Read vendor/wtroiano/chart-builder/docs/consumers/react.md, state.md and exports.md.

Use the published full entry for default ECharts or core for another registered adapter. Install the matching public SDK and avoid a second React copy. Keep chart name and propName distinct and correct.

Mount Chart for deferred props even before a result arrives. Preserve the shared page coordinator and namespaced URL state. Keep newer edits during requests; handle retry, history and unrelated table updates. Clear prior data, links and exports on denial or scope changes.

Verify initial SSR/loading, resize, theme, empty data, invalid filters, retryable errors and accessibility. Use the shared accessible table and CSV projection rather than creating a competing data transform. Review customized published sources before using vendor:publish --force.
