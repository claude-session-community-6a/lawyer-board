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

Deploy needs three repository variables: `AWS_DEPLOYMENT_ROLE_ARN`, `AWS_REGION`,
and `ECR_REPOSITORY`.

Note: `astro check` cannot run under TypeScript 7, so `tsc --noEmit` is the
typecheck in CI.

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
| `deploy.yml`, `terraform-apply.yml` | main, `environment: production` | `:environment:production` |
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
    echo "$TOKEN" | cut -d. -f2 | base64 -d 2>/dev/null \
      | jq '{sub, ref, repository, environment, job_workflow_ref}'
```

Remove it once debugging is done — it prints a live credential into the logs.

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
