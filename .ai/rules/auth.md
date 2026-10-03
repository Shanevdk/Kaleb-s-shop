---
paths:
    - 'routes/**'
    - 'app/Http/Middleware/**'
---

# Auth

## Accounts nobody approved are held at the waiting page on every web route
Self sign-up is open, but `CreateNewUser` marks the account `pending` and `EnsureAccountIsApproved` (appended to the whole web group in `bootstrap/app.php`, not listed per route) redirects any signed-in account that is not `approved` to `account.pending`, or 403s JSON. `User::hasPermission()` also returns false for them. New routes are covered automatically; a route a pending account must still reach has to be added to `EnsureAccountIsApproved::ALLOWED_ROUTES`. The `users.status` column defaults to `approved`, so admin-created accounts, the CLI commands and the MongoDB import are let in without setting it.
