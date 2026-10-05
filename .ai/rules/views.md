---
paths:
  - 'resources/views/**'
---

# Views

## Scripts must fit the Content-Security-Policy
AddSecurityHeaders (global middleware) sends a CSP whose script-src is 'self', the per-request Vite nonce, the asset URL, the Scandit CDN and the Vite dev server only. Any inline <script> in a Blade view needs nonce="{{ Vite::cspNonce() }}", and a new third-party script, worker or iframe origin must be added to the policy in app/Http/Middleware/AddSecurityHeaders.php, or the browser silently blocks it.
