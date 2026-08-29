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
trust policy needs one statement per distinct OIDC subject:

| Workflow | Trigger | `sub` claim |
| --- | --- | --- |
| `deploy.yml`, `terraform-apply.yml` | main, `environment: production` | `repo:…:environment:production` |
| `terraform-drift.yml` | schedule on main, no environment | `repo:…:ref:refs/heads/main` |
| `terraform-plan.yml` | pull request | `repo:…:pull_request` |

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
          "token.actions.githubusercontent.com:sub": "repo:claude-session-community-6a/lawyer-board:environment:production",
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
          "token.actions.githubusercontent.com:sub": "repo:claude-session-community-6a/lawyer-board:ref:refs/heads/main",
          "token.actions.githubusercontent.com:job_workflow_ref": "claude-session-community-6a/lawyer-board/.github/workflows/terraform-drift.yml@refs/heads/main"
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
          "token.actions.githubusercontent.com:sub": "repo:claude-session-community-6a/lawyer-board:pull_request"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:job_workflow_ref": "claude-session-community-6a/lawyer-board/.github/workflows/terraform-plan.yml@*"
        }
      }
    }
  ]
}
```

Statements are ORed, conditions within one are ANDed — which is why the ref pin
and the pull-request subject cannot live in the same statement.

**What the pull-request statement costs you.** It lets any PR branch assume a
role that can write to the infrastructure. The `job_workflow_ref` pin narrows
that to jobs defined in `terraform-plan.yml`, so an attacker cannot add a new
workflow file to grab credentials — but they can still edit `terraform-plan.yml`
itself within the PR. That edit is visible in the diff, so the real control is
reviewing workflow changes. Require review on `.github/**` if you want it
enforced rather than observed. The narrower alternative is a second, read-only
role trusted only for `pull_request`.

`job_workflow_ref` is pinned to `@refs/heads/main` for drift because scheduled
runs always execute the default branch's copy of the file, and to `@*` for plan
because a PR job reports `@refs/pull/N/merge`.

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
