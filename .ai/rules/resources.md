---
paths:
  - 'app/Http/Resources/**'
---

# Resources

## Resolve nested JsonResource::collection() in toArray(), don't leave it unresolved
Don't write `'things' => ThingResource::collection($this->whenLoaded('things'))` and leave it as an object in toArray(). When the outer resource is later manually `->resolve()`'d in a controller (our Inertia convention) and the nested collection is still a live AnonymousResourceCollection, Inertia's PropsResolver walks every prop recursively and, since JsonResource implements Responsable, calls `->toResponse($request)` on it — which wraps it as `{"data": [...]}` instead of a plain array. The frontend then does `things.map(...)` on an object and crashes with "X.map is not a function".

Fix: resolve the nested collection yourself, keeping the whenLoaded omission behavior:
`'things' => $this->whenLoaded('things', fn (): array => ThingResource::collection($this->things)->resolve()),`
See InspectionResource::toArray() for the correct pattern, and ServiceRecordResource::toArray() (fixed 2026-10-01) for the bug this causes when skipped.
