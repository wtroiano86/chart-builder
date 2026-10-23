# Adapter lifecycle checks

- SSR does not load the rendering engine or access browser globals.
- Zero-size containers wait; resize observers and theme changes update the engine.
- React StrictMode mounting and cleanup do not leak listeners or instances.
- New snapshots reconcile stable identities and discard removed data.
- Programmatic updates cannot trigger navigation or user filter changes.
- Events identify chart, snapshot, series and the correct datum kind.
- Missing extensions and unsupported capabilities fail visibly.
- onReady reports a handle and reports null on disposal.
- Image formats match the manifest and current rendering mode.
- Accessible tables and CSV use the same normalized data/projection as the chart.
