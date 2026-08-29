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

In CI this is `.github/workflows/ci.yml`, in one job: it deploys Convex, builds
the app, installs a production dependency tree, then packages and pushes the
image. A pull request runs the same job but stops after the image builds — it
runs `convex codegen` instead of `convex deploy`, and never pushes.

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
- Setting it at container runtime does nothing. It has to be present when
  `astro build` runs. The `Dockerfile` no longer compiles anything, so this is
  an environment variable on the build step, not a Docker build arg:

  ```
  PUBLIC_CONVEX_URL=https://<deployment>.convex.cloud pnpm build
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
| `ECR_REGISTRY` | `production` variable | e.g. `828786775790.dkr.ecr.us-east-1.amazonaws.com` |
| `ECR_REPOSITORY` | `production` variable | |

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

Today, manually, from a checkout with the Convex CLI logged in. The image is
packaged from build output, so everything is prepared first and `docker build`
only copies:

```
npx convex deploy
PUBLIC_CONVEX_URL=https://disciplined-toucan-793.convex.cloud pnpm build
pnpm install --frozen-lockfile --prod --config.node-linker=hoisted
docker build -t lawyer-board .
```

On macOS or arm64 that produces an image that only runs locally: the copied
native binaries match the machine that installed them. A publishable image has
to be prepared on glibc x64.

`.github/workflows/deploy.yml` is manual dispatch
(`gh workflow run deploy.yml`) and does nothing but call `ci.yml` — it exists so
a deploy can be re-run without an empty commit. It publishes only when
dispatched from `main`, because that is the condition `ci.yml` keys on.

## What CI does

`ci.yml` is one job on `ubuntu-latest` with `environment: production`, so it can
read the environment's variables and secrets. A single `PUBLISH` flag —
`github.event_name != 'pull_request' && github.ref == 'refs/heads/main'` —
decides which of the paired steps run.

| Step | Pull request | Push to `main` |
| --- | --- | --- |
| `convex codegen` | ✓ | — |
| `convex deploy --yes` | — | ✓ |
| `pnpm typecheck` | ✓ | ✓ |
| `pnpm test`, if a `test` script exists | ✓ | ✓ |
| `pnpm build` | ✓ | ✓ |
| production dependency install | ✓ | ✓ |
| `docker build` | ✓ (`push: false`) | — |
| assume the AWS role, log in to ECR, build and push | — | ✓ |

The image is tagged twice: `:${{ github.sha }}`, which is the immutable tag a
deployment should reference, and `:latest`.

`ubuntu-latest` (glibc, x64) is not incidental — `node_modules` is copied into
the image rather than installed, so the runner has to match `node:22.22.0-slim`.
Moving either side to Alpine or arm64 without the other ships an image whose
native binaries (sharp, esbuild, lightningcss) fail to load at startup.

### Two things still open

**`CONVEX_DEPLOY_KEY` gates every run, including pull requests.**
`convex/_generated/` is gitignored, so CI generates it. `convex codegen` has no
offline mode — it reads the deployment named by the key and exits non-zero
without one:

```
✖ No CONVEX_DEPLOYMENT set, run `npx convex dev` to configure a Convex project
```

The job declares `environment: production`, so an environment secret is enough.
But pull requests from forks receive no secrets at all, so CI cannot pass on
them. If fork contributions matter, commit `convex/_generated/` instead — which
is what Convex's own `codegen --help` recommends ("should be committed to the
repo") — and drop the codegen step.

**Nothing boots the image before it reaches ECR.** The `Dockerfile` has a
`HEALTHCHECK`, but CI never runs the container, so a bundle that builds and
crashes on start is caught only after the push.

## Repository settings

| Setting | Scope | Status |
| --- | --- | --- |
| `AWS_DEPLOYMENT_ROLE_ARN` | repository variable | set |
| `AWS_REGION` | repository variable | set |
| `ECR_REGISTRY` | `production` variable | **must be set — the push tags are built from it** |
| `ECR_REPOSITORY` | `production` variable | set (`lawyer-board`) |
| `PUBLIC_CONVEX_URL` | `production` variable | set (`https://disciplined-toucan-793.convex.cloud`) |
| `CONVEX_DEPLOY_KEY` | `production` secret | **not set — no run can pass without it, pull requests included** |

The deploy key is generated in the Convex dashboard under Settings → Deploy Keys;
no CLI command mints one. Then:

```
gh secret set CONVEX_DEPLOY_KEY --env production
```

Convex production deployment:
https://dashboard.convex.dev/t/claude-session-community-6a/dashboard/disciplined-toucan-793
