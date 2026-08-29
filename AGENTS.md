## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)

## Container and CI

The app ships as a container built by the multi-stage `Dockerfile` (Astro's
standalone Node adapter). Build and run locally:

```
docker build -t lawyer-board .
docker run --rm -p 4321:4321 lawyer-board
```

Keep the Node version in `Dockerfile` (`ARG NODE_VERSION`) in sync with `.nvmrc`.

Workflows:

- `.github/workflows/ci.yml` — typecheck, `astro build`, then build the image and
  boot it to confirm it serves traffic. Runs on pushes to `main` and on PRs, and
  is reusable via `workflow_call`.
- `.github/workflows/deploy.yml` — manual dispatch. Calls CI first, then assumes
  the AWS role via OIDC and pushes the image to ECR.

Deploy needs three repository variables: `AWS_DEPLOYMENT_ROLE_ARN`, `AWS_REGION`,
and `ECR_REPOSITORY`.

Note: `astro check` cannot run under TypeScript 7, so `tsc --noEmit` is the
typecheck in CI.

## AWS OIDC trust policy

The deploy job authenticates to AWS with GitHub's OIDC provider — no stored
access keys. The role's trust policy on account `828786775790`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::828786775790:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:sub": "repo:claude-session-community-6a/lawyer-board:environment:production",
          "token.actions.githubusercontent.com:ref": "refs/heads/main"
        }
      }
    }
  ]
}
```

Two things about the `sub` claim that are easy to get wrong:

- Because the `publish` job declares `environment: production`, GitHub emits the
  environment form of `sub` and **omits the ref**. It is either
  `repo:OWNER/REPO:environment:NAME` or `repo:OWNER/REPO:ref:refs/heads/BRANCH`,
  never both. Adding `:ref:...` to the end of the environment form makes the
  policy match nothing.
- The branch restriction therefore rides on the separate top-level `ref` claim.
  It matters here because `deploy.yml` is `workflow_dispatch`-only and dispatch
  can be triggered from any branch. Setting the `production` environment's
  "Deployment branches" rule to `main` enforces the same thing earlier, before
  the token is minted.

Changing the job's `environment:` or trigger changes the claims, so the trust
policy has to be updated in step. To see what AWS is actually comparing against,
add a temporary step before `configure-aws-credentials`:

```yaml
- name: Dump OIDC claims
  run: |
    TOKEN=$(curl -sH "Authorization: bearer $ACTIONS_ID_TOKEN_REQUEST_TOKEN" \
      "$ACTIONS_ID_TOKEN_REQUEST_URL&audience=sts.amazonaws.com" | jq -r .value)
    echo "$TOKEN" | cut -d. -f2 | base64 -d 2>/dev/null | jq '{sub, ref, repository, environment}'
```

Remove it once debugging is done — it prints a live credential into the logs.
## Convex

Backend functions live in `convex/` and run on Convex, not in the Astro server.
`convex/_generated/` is written by the CLI — never edit it by hand. The root
`tsconfig.json` excludes `convex/`; that directory has its own `tsconfig.json`
and `convex dev` typechecks it.

First-time setup (interactive, needs a Convex login):

```
npx convex dev
```

It creates the deployment, writes `CONVEX_DEPLOYMENT` and the deployment URL to
`.env.local`, and generates `convex/_generated/`. Astro only exposes
`PUBLIC_`-prefixed vars to the browser, so `.env.local` also needs:

```
PUBLIC_CONVEX_URL=<the same deployment URL>
```

Day to day, run `pnpm dev:convex` alongside `astro dev --background` — it watches
`convex/` and pushes changes. `pnpm convex:deploy` pushes to production.

React components read data with `useQuery`/`useMutation` from `convex/react`; the
`ConvexProvider` is wired up in `src/app/App.tsx`.
