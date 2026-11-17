---
paths:
  - 'app/Models/**'
---

# Models

## New models and columns are not in the data API until listed in ApiCollection
The read-only API (routes/api.php, /api/v1, admin-made keys) shares only the fields allowlisted per collection in App\Enums\ApiCollection::fields(), and only models that have a case there. When you add a model or a column other apps should see, add it there (and to the expected list in tests/Feature/DataApiTest.php). Never list anything that signs someone in or opens a private link (password, two_factor_*, remember_token, work_order_key); photos go out as URLs from RecordResource, not stored paths.
