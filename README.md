# Systems in Motion

Watch systems behave live: add load, see a box turn red, add the part that fixes it.
**Learn** with guided levels, or **Design** your own system and find where it breaks.

Status: M1 "One box breaks" in progress. Start with [CLAUDE.md](CLAUDE.md) and [docs/](docs/README.md).

## Run it locally

Needs Node 22.22+ (`.nvmrc` pins 24; with nvm run `nvm use`).

```sh
npm install        # once
npm run dev        # http://localhost:5173
npm test           # unit tests (Vitest)
```

Before pushing, the same checks CI runs:

```sh
npm run typecheck
npm run lint
npm run format:check   # npm run format fixes it
npm run build
npx playwright install chromium   # once
npm run e2e                       # smoke test against the production build
```

## Deploys

- `main` → GitHub Pages at `https://<owner>.github.io/Systems-in-Motion/` (`.github/workflows/deploy.yml`).
- Every PR → a preview at `…/Systems-in-Motion/pr-preview/pr-<N>/`, linked in a PR comment.

One-time setup: **Settings → Pages → Build and deployment → Source: Deploy from a branch →
`gh-pages` / `(root)`**. The branch appears after the first deploy or preview run.
