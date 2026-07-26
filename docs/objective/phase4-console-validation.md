# Phase 4 Console Validation Gate

Run the Phase 4 objective console validation gate with:

```bash
corepack yarn test:phase4:console
```

This gate runs the frontend objective-dashboard regression suite and the
objective no-leak regression sequentially.

It is intended for Phase 4 P0 console changes and does not replace the full
root validation sequence:

```bash
corepack yarn lint
corepack yarn typecheck
corepack yarn build
```
