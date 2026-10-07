// Backward-compatible entry point. All village masks are generated from the
// villageId manifest in one pass so assets cannot be paired by filename order.
await import('./build-village-walkable-masks.mjs')
