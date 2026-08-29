# Deploying

The app is two independent pieces that ship together:

- **Convex** — everything in `convex/`. Runs on Convex's servers.
- **The Astro app** — a container built from the `Dockerfile`, pushed to ECR.

## The whole deploy, in order

```
npx convex deploy      # 1. generate bindings + push functions to Convex
pnpm build             # 2. compile the Astro app
                       # 3. done
```

**The order is not optional.** `convex deploy` writes `convex/_generated/`,
which is gitignored and therefore absent from a fresh checkout. Once a component
imports `api` from `convex/_generated/api`, step 2 cannot compile until step 1
has run. Deploying the backend first also means the frontend never ships a call
to a query the backend does not have yet.

In CI this is `.github/workflows/deploy.yml`: a `convex` job runs step 1, then
the `publish` job runs step 2 inside the Docker build and pushes the image.

## Environment variables

They fall into three groups, and the distinction matters more than usual here.

### Build-time — needed when `astro build` runs

| Variable | Where it is set | Notes |
| --- | --- | --- |
| `PUBLIC_CONVEX_URL` | `.env.local` locally; `production` environment variable in CI | The Convex deployment URL, e.g. `https://disciplined-toucan-793.convex.cloud` |

`PUBLIC_CONVEX_URL` is declared in the `env.schema` block of `astro.config.mjs`
and read through `astro:env/client`. Vite **inlines it at build time** — into the
server bundle as well as the client one — so:

- A missing value fails `astro build` with `PUBLIC_CONVEX_URL is missing`,
  rather than surfacing as a 500 on the first render.
- Setting it at container runtime does nothing. It has to be present when the
  bundle is compiled, which is why the `Dockerfile` takes it as a build arg:

  ```
  docker build --build-arg PUBLIC_CONVEX_URL=https://<deployment>.convex.cloud -t lawyer-board .
  ```

- An image is therefore bound to one Convex deployment. Pointing at a different
  one means rebuilding, not restarting.

### Deploy-time — needed to push, not to build or run

| Variable | Where it is set | Notes |
| --- | --- | --- |
| `CONVEX_DEPLOY_KEY` | `production` environment **secret** | Authenticates `convex deploy` in CI. Generated in the Convex dashboard under Settings → Deploy Keys; there is no CLI command that mints one. Not needed locally — the CLI uses your login in `~/.convex/config.json`. |
| `CONVEX_DEPLOYMENT` | `.env.local`, written by `npx convex dev` | Local only. Names your dev deployment; CI never reads it. |
| `AWS_DEPLOYMENT_ROLE_ARN` | repository variable | Assumed via OIDC; the workflow needs `id-token: write`. |
| `AWS_REGION` | repository variable | |
| `ECR_REPOSITORY` | repository variable | |

### Runtime — read by the container when it starts

| Variable | Default | Notes |
| --- | --- | --- |
| `HOST` | `0.0.0.0` | Set in the `Dockerfile`. Must not be `127.0.0.1`, or the container is unreachable from outside. |
| `PORT` | `4321` | Set in the `Dockerfile`. |
| `NODE_ENV` | `production` | Set in the `Dockerfile`. |

Note what is *not* in this table: no Convex variable is read at runtime. The
built server already has the URL baked in.

## First-time local setup

```
npx convex dev
```

Interactive — it needs a Convex login. It creates the dev deployment, writes
`CONVEX_DEPLOYMENT` and `CONVEX_URL` to `.env.local`, and generates
`convex/_generated/`. Then add the Astro-facing name to `.env.local`:

```
PUBLIC_CONVEX_URL=<the same URL as CONVEX_URL>
```

Day to day, leave `pnpm dev:convex` running alongside `astro dev --background`;
it watches `convex/` and pushes changes as you edit.

## Running the deploy

`.github/workflows/deploy.yml` is manual dispatch only:

```
gh workflow run deploy.yml
```

It runs CI first (typecheck, build, image build, boot smoke test), then
`convex deploy`, then builds and pushes the image to ECR tagged with the commit
SHA and `latest`. Pushing the image does not roll out the running service —
that step is outside this repo.

## Current state

| Setting | Scope | Status |
| --- | --- | --- |
| `AWS_DEPLOYMENT_ROLE_ARN` | repository variable | set |
| `AWS_REGION` | repository variable | set |
| `ECR_REPOSITORY` | repository variable | set |
| `PUBLIC_CONVEX_URL` | `production` variable | set |
| `CONVEX_DEPLOY_KEY` | `production` secret | **not set — deploy fails without it** |
