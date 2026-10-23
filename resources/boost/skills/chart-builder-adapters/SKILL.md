---
name: chart-builder-adapters
description: Build or integrate rendering adapters using Chart Builder's public SDK, capability manifests, lazy loading, lifecycle, events and image exports.
---

Read vendor/wtroiano/chart-builder/docs/consumers/adapters.md and [the lifecycle checklist](references/lifecycle.md).

Keep the PHP-defined API portable. Register the same versioned manifest in PHP and JavaScript. Unsupported combinations must produce explicit errors before rendering, and before provider work where possible.

Import only the public @wtroiano/chart-builder-sdk and peer React in the adapter contract. Load the rendering engine lazily. Use stable datum references and distinguish user events from programmatic updates. Require typed projections for custom data.

Declare supported rendering/export combinations accurately. Keep named formatters, renderers and geography assets in local JavaScript; PHP sends names and JSON parameters. Verify the adapter in an independent consumer without application import aliases.
