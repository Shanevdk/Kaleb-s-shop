---
paths:
  - 'resources/js/**'
---

# Js

## Code must load under SSR (no browser globals at module level)
Inertia SSR is on, and in dev the @inertiajs/vite plugin evaluates resources/js/app.tsx (plus everything it imports) in Node. Any code that runs at module level or during render must guard `window`/`document`/`localStorage` with `typeof window !== 'undefined'`, or put them in effects/event handlers. In app.tsx, `void createInertiaApp(...)` has to stay a top-level statement, never inside an `if`. The plugin only turns a top-level call into the SSR render function. Otherwise SSR quietly falls back to client rendering ("Failed to warm up Inertia SSR module graph").
