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
