---
paths:
    - 'resources/js/routes/**'
---

# Routes

## Regenerate Wayfinder with --with-form

`vite.config.ts` enables `wayfinder({ formVariants: true })`, so every `.form()` call in the app depends on the form variants being generated. Running bare `php artisan wayfinder:generate` regenerates WITHOUT them and breaks `tsc` across the whole codebase. Always pass `--with-form`, or just run `npm run build` / `npm run dev` and let the vite plugin regenerate.
