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

In CI this should be `.github/workflows/deploy.yml`: a job runs step 1, then the
`publish` job runs step 2 inside the Docker build and pushes the image. **That
wiring does not exist yet** — see [CI/CD handoff](#cicd-handoff) below.

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

`.github/workflows/deploy.yml` is manual dispatch (`gh workflow run deploy.yml`)
and **does not work at all now** — it runs `docker build` against a plain
checkout that has no `dist/`. It also never deploys Convex. Both gaps are below.

## CI/CD handoff

The application side of Convex is done and merged in this PR. The workflow
changes were deliberately left out so they can be reviewed and owned by whoever
runs deploys. Three things need doing.

### 1. `CONVEX_DEPLOY_KEY` must be a repository secret, or CI cannot run

`convex/_generated/` is gitignored, so CI generates it with `convex codegen`.
That command has no offline mode — it reads the deployment named by the key and
exits non-zero without one:

```
✖ No CONVEX_DEPLOYMENT set, run `npx convex dev` to configure a Convex project
```

Two consequences worth knowing before this lands:

- The secret has to exist at **repository** scope, not only on the `production`
  environment. The CI job declares no `environment:`, so environment secrets are
  not visible to it.
- Pull requests from forks receive no secrets, so CI cannot pass on them. If
  fork contributions matter, commit `convex/_generated/` instead — which is what
  Convex's own `codegen --help` recommends ("should be committed to the repo").

### 2. `deploy.yml` never deploys Convex

Functions in `convex/` are currently only reachable by someone running
`npx convex deploy` by hand. A job needs to run it before the image is built, so
the backend is never behind the frontend that calls it:

```yaml
  convex:
    name: Deploy Convex functions
    needs: verify
    runs-on: ubuntu-latest
    environment:
      name: production
    steps:
      - uses: actions/checkout@... # v4.2.2
      - uses: pnpm/action-setup@... # v4.1.0
      - uses: actions/setup-node@... # v4.1.0
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - name: Push functions to the production deployment
        run: pnpm exec convex deploy --yes
        env:
          CONVEX_DEPLOY_KEY: ${{ secrets.CONVEX_DEPLOY_KEY }}
```

Then gate publishing on it: `needs: [verify, convex]`.

### 3. `deploy.yml` builds the image straight from source, which no longer works

This is the breaking one. The `Dockerfile` is now runtime-only: it copies
`dist/` and a production `node_modules` out of the build context and compiles
nothing. `deploy.yml`'s `publish` job still runs `docker build` against a plain
checkout, where neither directory exists, so the build fails outright.

The `publish` job needs the same preparation `ci.yml` now does, before its
`docker build`:

```yaml
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec convex codegen --typecheck disable
        env:
          CONVEX_DEPLOY_KEY: ${{ secrets.CONVEX_DEPLOY_KEY }}
      - run: pnpm build
        env:
          PUBLIC_CONVEX_URL: ${{ vars.PUBLIC_CONVEX_URL }}   # the real one
      - run: pnpm install --frozen-lockfile --prod --config.node-linker=hoisted
```

Note the ordering constraint this creates: `node_modules` is copied, not
installed, so it must be produced on a runner whose libc and CPU match the base
image. `ubuntu-latest` (glibc, x64) matches `node:22.22.0-slim`. Moving either
side to Alpine or to arm64 without moving the other ships an image whose native
binaries (sharp, esbuild, lightningcss) fail to load at startup.

Also worth deciding: `ci.yml` no longer boots the image it builds, so nothing
currently catches that class of failure before it reaches ECR.

## Repository settings

| Setting | Scope | Status |
| --- | --- | --- |
| `AWS_DEPLOYMENT_ROLE_ARN` | repository variable | set |
| `AWS_REGION` | repository variable | set |
| `ECR_REPOSITORY` | repository variable | set (`lawyer-board`) |
| `PUBLIC_CONVEX_URL` | `production` variable | set (`https://disciplined-toucan-793.convex.cloud`) |
| `CONVEX_DEPLOY_KEY` | `production` secret | **not set — the Convex deploy job cannot work without it** |

The deploy key is generated in the Convex dashboard under Settings → Deploy Keys;
no CLI command mints one. Then:

```
gh secret set CONVEX_DEPLOY_KEY --env production
```

Convex production deployment:
https://dashboard.convex.dev/t/claude-session-community-6a/dashboard/disciplined-toucan-793
