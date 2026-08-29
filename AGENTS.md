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

The app ships as a container (Astro's standalone Node adapter). The `Dockerfile`
compiles nothing: it copies `dist/` and a production `node_modules` out of the
build context, so both must exist before you build it.

```
pnpm build
pnpm install --frozen-lockfile --prod --config.node-linker=hoisted
docker build -t lawyer-board .
docker run --rm -p 4321:4321 lawyer-board
```

Because `node_modules` is copied rather than installed, it has to come from a
host matching the base image — glibc, same CPU. The base is `node:*-slim`
(Debian), not Alpine, for exactly that reason: the tree carries native binaries
(sharp, esbuild, lightningcss). An image prepared on macOS or arm64 runs only
there. Afterwards, `pnpm install` restores the dev tree.

Keep the Node version in `Dockerfile` (`ARG NODE_VERSION`) in sync with `.nvmrc`.

Workflows:

- `.github/workflows/ci.yml` — one `build` job covering both paths. A PR runs
  Convex codegen, typecheck, tests, `astro build`, a production dependency
  install and a `push: false` image build. A push to `main` swaps codegen for
  `convex deploy`, then assumes the AWS role via OIDC and pushes the image to
  ECR tagged `:<sha>` and `:latest`. The job declares `environment: production`
  and branches on one `PUBLISH` env flag. Reusable via `workflow_call`.
- `.github/workflows/deploy.yml` — manual dispatch; calls `ci.yml` with
  `secrets: inherit` and nothing else. Publishes only when dispatched from
  `main`, since that is what `PUBLISH` keys on.
- `.github/workflows/terraform-plan.yml` — on PRs touching `terraform/`. Runs
  fmt, validate and a `-lock=false` plan, then posts the result as a single
  PR comment that it updates in place. Skipped on fork PRs, which have no OIDC.
- `.github/workflows/terraform-apply.yml` — applies automatically when
  `terraform/` changes land on `main`. Re-plans rather than reusing the PR's
  plan file, so the PR comment is advisory only.
- `.github/workflows/terraform-drift.yml` — daily at 13:17 UTC. Uses
  `plan -detailed-exitcode` and opens, updates, or closes a single tracking
  issue titled "Terraform drift detected (production)".

Apply and drift share the `terraform-apply` concurrency group so they can never
run against the state at the same time.

Publishing needs `AWS_DEPLOYMENT_ROLE_ARN` and `AWS_REGION` as repository
variables, and `ECR_REGISTRY` and `ECR_REPOSITORY` on the `production`
environment.

Note: `astro check` cannot run under TypeScript 7 — the language server needs
TypeScript's programmatic API, which the native compiler does not expose yet
(withastro/roadmap#1321). Until it does, `pnpm typecheck` is the typecheck: it
runs `astro sync` (generating the `astro:env` and content-collection types into
the gitignored `.astro/`) and then `tsc --noEmit`. Run that rather than `tsc`
directly, or a fresh checkout fails on `Cannot find module 'astro:env/client'`.

## AWS OIDC trust policy

Every workflow that touches AWS authenticates through GitHub's OIDC provider —
no stored access keys. All four share one role on account `828786775790`, so its
trust policy needs one statement per distinct OIDC subject.

**The subject prefix carries numeric IDs.** Every `sub` claim in this repo begins
with:

```
repo:claude-session-community-6a@322567787/lawyer-board@1350805390
```

`@322567787` is the organization ID and `@1350805390` the repository ID. They are
not decoration and they are not optional — a policy written against the plain
`repo:OWNER/REPO` form matches nothing here. They exist so the subject survives an
org or repo rename: the names can change, the IDs cannot, so a renamed repo cannot
inherit another's trust. Get them from a claim dump (below), never by hand.

What follows the prefix is what varies per trigger:

| Workflow | Trigger | Suffix after the prefix |
| --- | --- | --- |
| `ci.yml` (and `deploy.yml`, which calls it), `terraform-apply.yml` | main, `environment: production` | `:environment:production` |
| `terraform-drift.yml` | schedule on main, no environment | `:ref:refs/heads/main` |
| `terraform-plan.yml` | pull request | `:pull_request` |

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DeployAndApplyFromMain",
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::828786775790:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:sub": "repo:claude-session-community-6a@322567787/lawyer-board@1350805390:environment:production",
          "token.actions.githubusercontent.com:ref": "refs/heads/main"
        }
      }
    },
    {
      "Sid": "DriftDetectionOnMain",
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::828786775790:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:sub": "repo:claude-session-community-6a@322567787/lawyer-board@1350805390:ref:refs/heads/main"
        }
      }
    },
    {
      "Sid": "PlanOnPullRequests",
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::828786775790:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:sub": "repo:claude-session-community-6a@322567787/lawyer-board@1350805390:pull_request"
        }
      }
    }
  ]
}
```

Statements are ORed, conditions within one are ANDed — which is why the ref pin
and the pull-request subject cannot live in the same statement.

**What the pull-request statement costs you.** It lets any PR branch assume a
role that can write to the infrastructure. Nothing in the policy narrows that to
a particular workflow, so the control is reviewing changes under `.github/**`
before they run. Require review on that path if you want it enforced rather than
observed. The narrower alternative is a second, read-only role trusted only for
`pull_request`.

A `job_workflow_ref` condition would restrict each statement to one workflow
file, and is worth adding once you have confirmed the claim's exact value from a
dump. It was removed here rather than guessed: it embeds the same repo path as
`sub`, so writing it from the plain `OWNER/REPO` form silently matches nothing
and looks identical to a subject mismatch.

Two things about the `sub` claim that are easy to get wrong:

- Because CI's `build` job declares `environment: production`, GitHub emits the
  environment form of `sub` and **omits the ref**. It is either
  `repo:OWNER/REPO:environment:NAME` or `repo:OWNER/REPO:ref:refs/heads/BRANCH`,
  never both. Adding `:ref:...` to the end of the environment form makes the
  policy match nothing.
- The branch restriction therefore rides on the separate top-level `ref` claim.
  It matters here because `deploy.yml` is `workflow_dispatch`-only and dispatch
  can be triggered from any branch. A "Deployment branches" rule on the
  `production` environment would enforce the same thing earlier, before the
  token is minted — but **do not add one**: `ci.yml`'s single job declares that
  environment on pull requests too, to read `PUBLIC_CONVEX_URL` and
  `CONVEX_DEPLOY_KEY`, and the rule would fail every PR run outright. Splitting
  the publish steps into their own job is the prerequisite for that rule.

Changing the job's `environment:` or trigger changes the claims, so the trust
policy has to be updated in step. To see what AWS is actually comparing against,
add a temporary step before `configure-aws-credentials`:

```yaml
- name: Dump OIDC claims
  run: |
    TOKEN=$(curl -sH "Authorization: bearer $ACTIONS_ID_TOKEN_REQUEST_TOKEN" \
      "$ACTIONS_ID_TOKEN_REQUEST_URL&audience=sts.amazonaws.com" | jq -r .value)
    echo "$TOKEN" | cut -d. -f2 | base64 -d 2>/dev/null \
      | jq '{sub, ref, repository, environment, job_workflow_ref}'
```

Remove it once debugging is done — it prints a live credential into the logs.

## El dominio y el flujo de la aplicación

La app implementa la fase 1 de la especificación de Luis: cargar un expediente
laboral, entenderlo, cruzarlo contra sí mismo y contra la ley, y generar un
escrito exportable. El recorrido completo, en rutas:

```
/                                        Tablero
/expedientes                             Listado
/expedientes/nuevo                       Alta guiada · 4 pasos, ninguno opcional
/expedientes/[id]/resumen                Ficha del asunto
/expedientes/[id]/documentos             Índice · carga por arrastre y pipeline en vivo
/expedientes/[id]/documentos/[docId]     Visor + panel de extracción · validación humana
/expedientes/[id]/contradicciones        Alegado vs. documentado
/expedientes/[id]/leyes                  Cumplimiento contra la LFT en la vigencia del asunto
/expedientes/[id]/escritos               Escritos, y su editor por secciones
/expedientes/[id]/bitacora               Traza
/biblioteca                              Corpus normativo con selector de vigencia
GET /api/escritos/[id]/pdf               Exportación · la compuerta corre aquí, no sólo en el botón
```

**Qué está simulado y qué no.** Sólo `convex/ia.ts` finge. Es el pipeline de
ingesta: encadena mutaciones internas con el scheduler de Convex por los mismos
estados que tendría una Step Function real (`Recibido → Normalizando →
Clasificando → Extrayendo → Por validar → Validado`), clasifica por nombre de
archivo y emite campos con score de confianza. Sustituirlo por Textract y
Bedrock significa cambiar el cuerpo de `avanzar`; ni los estados ni la tabla
`campos` se mueven.

Todo lo demás es código determinista y se comporta como en producción:

| Pieza | Archivo | Qué garantiza |
| --- | --- | --- |
| Contradicciones | `convex/contradicciones.ts` | Cruce mecánico alegado/documentado, con foja |
| Cumplimiento | `convex/cumplimiento.ts` | Reglas sobre campos validados, citando la vigencia |
| Corpus | `convex/corpus/lft.ts` | LFT por precepto y vigencia; extractos, la fuente es el DOF |
| Prelación | `convex/prelacion.ts` | Qué documento gana cuando dos aportan el mismo dato |
| Compuerta | `convex/escritos.ts` + la ruta de PDF | Un supuesto o una cita que no verifica bloquean |

Las cinco reglas del dominio están cableadas, no comentadas:

1. **Nada falla en silencio.** `contradicciones.list` devuelve `ejecutado` y
   `motivo`; el cumplimiento reporta como `Falta dato` la regla cuyo precepto no
   existe en el corpus a esa fecha, en vez de omitirla.
2. **Cero aritmética jurídica con modelo.** Plazos, deltas y factores se calculan
   en TypeScript, con la operación impresa en pantalla.
3. **Cero cita sin verificar.** `escritos.validarCitas` compara cada artículo
   contra el corpus en la vigencia de `fechaHechos`.
4. **El original nunca se modifica.** El pipeline sólo escribe filas nuevas.
5. **El abogado firma.** Ningún campo bajo el umbral se rellena con una
   estimación: entra vacío y marcado, y los campos críticos pasan por
   confirmación humana aunque vengan al 99%.

`expedientes.sembrarDemo` siembra el asunto 1146/2022 con cinco documentos que
entran al pipeline; es el punto de partida de la demostración. El botón está en
el tablero y en el listado vacío.

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
`.env.local`, and generates `convex/_generated/`. `.env.local` also needs:

```
PUBLIC_CONVEX_URL=<the same deployment URL>
```

`PUBLIC_CONVEX_URL` is declared in the `env.schema` block of `astro.config.mjs`
and read through `astro:env/client`, so a missing value fails `astro build`
rather than the first render. Vite inlines it at build time — into the server
bundle too — which is why the `Dockerfile` takes it as a build arg and why CI
passes a placeholder.

Day to day, run `pnpm dev:convex` alongside `astro dev --background` — it watches
`convex/` and pushes changes. `pnpm convex:deploy` pushes to production.

See [DEPLOY.md](./DEPLOY.md) for the deploy sequence, the split between
build-time, deploy-time, and runtime environment variables, and the CI/CD work
still outstanding — the workflows do not deploy Convex yet.

React components read data with `useQuery`/`useMutation` from `convex/react`; the
`ConvexProvider` is wired up in `src/app/App.tsx`.

### Permissions attached to the role

The trust policy only decides *who may assume* the role. What the role can then
*do* is a separate identity policy, and it has to grow to cover Terraform: the
role now creates VPCs, ECS services, S3 buckets, OpenSearch collections and —
notably — IAM roles. `iam:CreateRole`, `iam:PutRolePolicy` and
`iam:AttachRolePolicy` are the ones usually missing, and a role that can create
roles can escalate its own privileges. Attaching an `iam:PermissionsBoundary`
condition is the standard way to bound that.

Nothing in this repo manages that policy; it is set by hand alongside the trust
policy.
