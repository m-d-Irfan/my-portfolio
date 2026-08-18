# Project setup

Vite + React scaffold, folder layout, aliases and environment variables.

## Create

```bash
npm create vite@latest frontend -- --template react
cd frontend
npm install react-router-dom axios
npm install -D tailwindcss @tailwindcss/vite vitest @testing-library/react \
  @testing-library/jest-dom @testing-library/user-event jsdom eslint
```

JavaScript, not TypeScript, matches the existing project. On a new project prefer
TypeScript — most of the shape bugs in `04-serializers` and `05-state-and-cart`
are compile errors there.

Pick **one** toast library and use it everywhere. `react-hot-toast` is the
default here. Two libraries means two stacking contexts and two visual languages;
this was a real inconsistency between the frontend and admin skills.

## Layout

```
frontend/
├── .env.example              # committed; every VITE_ var, no values
├── .env.local                # gitignored
├── vite.config.js
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── routes.jsx            # route tree + lazy boundaries
│   ├── services/
│   │   ├── api.js            # the single axios instance
│   │   ├── auth.js           # login, logout, me
│   │   ├── products.js
│   │   └── orders.js
│   ├── context/
│   │   ├── AuthContext.jsx
│   │   └── CartContext.jsx
│   ├── hooks/
│   │   ├── useApi.js
│   │   └── useDebounce.js
│   ├── components/
│   │   ├── ui/               # Button, Input, Modal — no business logic
│   │   ├── layout/           # Header, Footer, Shell
│   │   └── product/          # ProductCard, VariantPicker
│   ├── pages/
│   │   ├── Home.jsx
│   │   ├── Admin/            # lazy-loaded; separate chunk
│   │   └── Inventory/
│   └── styles/
│       └── index.css
```

Two boundaries worth holding:

- **`services/` is the only place that names an endpoint.** A component importing
  `api` directly and writing a URL scatters the contract; when the backend
  renames a route you want one file to change.
- **`components/ui/` contains nothing that knows about products or orders.** That
  is what makes those components reusable, and it is where `ui-design-system`
  attaches.

## Aliases

```js
// vite.config.js
import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    port: 5173,
    // Optional: proxy /api to Django so the browser sees one origin. Removes
    // CORS from development entirely — but production still needs real CORS
    // config, so do not let the proxy hide a misconfiguration until deploy day.
    proxy: {
      "/api": { target: "http://127.0.0.1:8000", changeOrigin: true },
    },
  },
  build: { sourcemap: true, chunkSizeWarningLimit: 600 },
});
```

`sourcemap: true` makes production stack traces readable. Sourcemaps expose your
source — acceptable for a storefront frontend, which ships readable logic anyway,
but do not let it lull you into putting anything sensitive in the bundle.

Add the alias to ESLint and to `vitest` config too, or imports resolve in the app
and fail in tests.

## Environment variables

```bash
# .env.example — committed, no real values
VITE_API_URL=http://127.0.0.1:8000/api
VITE_CLOUDINARY_CLOUD_NAME=
VITE_ENABLE_ANALYTICS=false
```

Three things about `VITE_`:

1. **Only `VITE_`-prefixed vars reach the client.** Others are dropped silently —
   a missing value with no error is usually a forgotten prefix.
2. **Every `VITE_` var is in the shipped bundle.** Cloudinary *cloud name* is
   public and fine; the *API secret* is not. No bKash key, no admin token, no
   database URL. Anything privileged is proxied through Django.
3. **They are inlined at build time.** Changing one needs a rebuild. Do not
   expect a container env var to change behaviour at runtime.

Validate at boot so a missing var fails immediately rather than as a confusing
404 later:

```js
// src/services/config.js
const required = ["VITE_API_URL"];
const missing = required.filter((k) => !import.meta.env[k]);
if (missing.length && import.meta.env.PROD) {
  throw new Error(`Missing environment variables: ${missing.join(", ")}`);
}
export const API_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000/api";
```

This is the frontend half of audit finding **C1** — the backend equivalent is in
`django-backend-builder/references/02-settings-assembly.md`.

## Gitignore

```
node_modules/
dist/
.env
.env.local
.env.*.local
*.local
.DS_Store
```

Commit `.env.example`, never `.env.local`. See
`security-hardening/references/04-secrets.md` for what to do if a secret has
already been committed — rotate first, scrub second.

## Verification

```bash
npm run dev      # starts, no console errors
npm run build    # succeeds
npm run preview  # the built bundle actually works — dev-only bugs hide here

# No secrets in the bundle.
grep -riE "secret|api_key|password|bkash" dist/assets/*.js
# PASS: no output

# Aliases resolve in tests too.
npx vitest run
```

## Common mistakes

- Two toast libraries.
- Endpoints named in components instead of `services/`.
- A secret in a `VITE_` variable.
- Missing `VITE_` prefix, so the value is silently undefined.
- The alias configured in Vite but not in ESLint or Vitest.
- `.env.local` committed.
- Never running `npm run preview`, so build-only failures reach production.
