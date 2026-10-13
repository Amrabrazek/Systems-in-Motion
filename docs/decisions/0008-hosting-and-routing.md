# 0008 GitHub Pages with PR previews and hash routes

**Status:** proposed (from the tech-stack review, `research/tech-stack.md` in the planning project)

GitHub Pages serves one site: no per-PR preview, and no "send every URL to index.html".

## Previews

| Option | Preview per PR | Cost |
|---|---|---|
| **Pages + `pr-preview-action` (pick)** | `/pr-preview/pr-12/` subfolder | stays in the repo; deploys from a `gh-pages` branch |
| Cloudflare Pages | own URL per PR, automatic | one more account; switch is ~10 min |

## Routes

| Option | Pro | Con |
|---|---|---|
| Clean URLs (`/learn/x`) | pretty | refresh = 404 on Pages without a `404.html` redirect hack |
| **Hash URLs (`#/learn/x`) (pick)** | zero hacks; also works inside preview subfolders | slightly uglier |

## Consequences
- Vite `base` comes from an env var (`/Systems-in-Motion/` for prod, `/Systems-in-Motion/pr-preview/pr-N/` for previews). Set in M1 step 1.
- React Router in hash mode; each topic lazy-loaded (see [navigation.md](../navigation.md)).

**Revisit if:** we move to Cloudflare/Netlify or Astro. Then clean URLs and per-PR URLs come free.
