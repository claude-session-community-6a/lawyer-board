# Infrastructure

Terraform for the `production` stack in `us-east-1`, account `828786775790`.

```
terraform/
  bootstrap/     state bucket only — applied once, with local state
  network.tf     VPC, public/private subnets, NAT, S3 gateway endpoint
  cloudfront.tf  the public entry point: VPC origin and distribution
  alb.tf         internal ALB, HTTP listener, target group
  ecs.tf         Fargate cluster, task definition, service, log group
  ecr.tf         image repository and expiry rules
  s3.tf          uploads bucket for case-file documents
  opensearch.tf  Serverless collection and its three policies
  iam.tf         task execution role and the application's task role
```

## Shape of it

```
viewer ──HTTPS──▶ CloudFront ──HTTP, inside the VPC──▶ internal ALB ──▶ Fargate
```

CloudFront is the only public entry point. Nothing else in the stack has a
route from the internet: the ALB is `internal`, sits in the private subnets
alongside the tasks, and its security group admits only the CloudFront
origin-facing prefix list. The tasks have no public IP; outbound traffic goes
through a NAT gateway, except S3, which takes a free gateway endpoint — worth
having when every upload is a 25 MB PDF that would otherwise be billed per GB
through the NAT.

The public subnets now hold nothing but the NAT gateways.

### Why the last hop is HTTP

Because it cannot be anything else without a domain. CloudFront validates an
origin's certificate against the public CA list *and* against the origin's
domain name; that name here is `*.elb.amazonaws.com`, and ACM will not issue a
certificate for a zone AWS owns. A self-signed or Private CA certificate makes
CloudFront drop the connection and return 502 — this is documented behaviour,
not a misconfiguration to work around.

What stands in for origin TLS is topology. The ALB has no public address on any
port, and CloudFront reaches it over a service-managed ENI that AWS places in
the private subnets. The plaintext hop runs between AWS's network and your own
subnet and never touches the internet. That is strictly stronger than the
common alternative — a public ALB locked to the CloudFront prefix list with a
shared secret header — where the plaintext leg *is* on the internet.

Two consequences worth knowing:

- **Viewer TLS floor is TLS 1.0.** The free `*.cloudfront.net` certificate
  cannot take a `minimum_protocol_version`; CloudFront pins the security policy
  to `TLSv1`. Raising it needs an alternate domain name.
- **Responses must finish in 60s.** A VPC origin's read timeout maxes out
  there, below the ALB's `idle_timeout` of 120.

Both go away with a domain — see [Adding a domain later](#adding-a-domain-later).

### Caching

The default behavior uses `Managed-CachingDisabled` and `Managed-AllViewer`:
every route is server-rendered and per-user, so CloudFront acts as a TLS
terminator and reverse proxy, not a cache. `AllViewer` keeps the viewer's
`Host`, so `Astro.url` sees the real hostname.

The one exception is `/_astro/*`, which Astro fingerprints and which therefore
gets `Managed-CachingOptimized`. That behavior is what keeps asset traffic off
Fargate. Adding any other cached path means first proving the response does not
vary per user.

### Availability zones

Subnets skip the AZ IDs CloudFront excludes from VPC origins
(`vpc_origin_unsupported_zone_ids`, `use1-az3` among them) — CloudFront puts
the ENI in the ALB's subnets, and one in an unsupported AZ fails the origin.
The exclusion is by AZ *ID*, since AZ names map to different physical zones per
account.

The application authenticates to AWS with its task role. No access keys exist
anywhere in this configuration; the AWS SDK picks the role up from the task
metadata endpoint on its own.

## First apply

The state bucket has to exist before the root configuration can store state in
it, so bootstrap runs first and keeps its own state locally.

```
cd terraform/bootstrap
terraform init
terraform apply
```

Confirm the `state_bucket` output matches the `bucket` in `../versions.tf`,
then bring up the stack:

```
cd terraform
terraform init
terraform apply
```

**The ECR repository is empty on first apply**, so the ECS service has no image
to pull. Terraform does not wait for the service to stabilise, so the apply
still succeeds — the service simply sits there failing to pull until an image
exists. Push one, then force a rollout:

```
gh workflow run deploy.yml
aws ecs update-service --cluster lawyer-board-production \
  --service lawyer-board-production --force-new-deployment
```

Set the `ECR_REPOSITORY` GitHub repository variable to the `ecr_repository_name`
output before running the workflow.

## OpenSearch Serverless

Access is gated by four independent things, and all four must agree:

1. **Encryption policy** — must exist before the collection can be created.
2. **Network policy** — public endpoint here, so reachability is not the gate.
3. **Data access policy** — which principals may touch which indexes.
4. **IAM** — `aoss:APIAccessAll` on the collection ARN, on the task role.

A 403 with everything "obviously correct" is nearly always IAM granted without
the data access policy, or the reverse. Note that the collection is invisible
to humans by default: add your own role ARN to `opensearch_admin_principals`
or you will not be able to open Dashboards no matter what IAM says.

Sign requests with SigV4 against service name **`aoss`**, not `es`. The task
gets `OPENSEARCH_ENDPOINT`, `OPENSEARCH_COLLECTION` and `OPENSEARCH_SERVICE` in
its environment.

The collection type is `VECTORSEARCH`, which carries both k-NN vector fields
and ordinary full-text search. It is immutable — moving to a different type
means a new collection and a reindex.

### Cost

Serverless bills a fixed OCU floor whether or not anything is querying, and it
does not scale to zero. `opensearch_standby_replicas = "DISABLED"` halves that
floor by giving up warm capacity in a second AZ, and is by far the largest
single cost lever in this stack — check current OCU pricing before leaving it
running. The NAT gateway is the next one, at roughly $33/mo plus data.

## Debugging a task

The tasks have no public IP and there is no bastion, so use ECS Exec:

```
aws ecs execute-command --cluster lawyer-board-production \
  --task <task-id> --container lawyer-board \
  --interactive --command /bin/sh
```

Logs are in the `/ecs/lawyer-board-production` CloudWatch group.

## Adding a domain later

A domain buys three things this stack cannot have without one: end-to-end TLS,
a viewer TLS floor above 1.0, and a URL worth printing. Nothing depends on the
CloudFront hostname, so it is additive:

1. Create or import the hosted zone and request an ACM certificate in
   `us-east-1` with DNS validation. CloudFront only reads certificates from
   `us-east-1`; the ALB reads them from its own region, which is the same
   region here, so one certificate covers both if it carries both names.
2. Add `aliases` and a `viewer_certificate` with `acm_certificate_arn`,
   `ssl_support_method = "sni-only"` and
   `minimum_protocol_version = "TLSv1.2_2021"` to the distribution, plus an A
   alias record pointing at it.
3. For origin TLS: an `origin.<domain>` record aliased to the ALB, a 443
   listener carrying a certificate for that name, and
   `origin_protocol_policy = "https-only"` on the VPC origin. The ALB stays
   internal, so the record resolves to private addresses — that is fine, and
   CloudFront still validates the certificate against the origin domain name.

Step 3 is the only one that changes the security posture; 1 and 2 are cosmetic
plus the TLS floor.

## Updating cached assets

`/_astro/*` is cached at the edge. Astro fingerprints those filenames, so a
deploy publishes new paths and no invalidation is needed. Invalidate only when
something under that prefix changes without its name changing:

```
aws cloudfront create-invalidation \
  --distribution-id "$(terraform output -raw cloudfront_distribution_id)" \
  --paths '/_astro/*'
```

## Not managed here

The GitHub Actions OIDC deploy role and its trust policy are maintained by hand
— see the AWS OIDC section in `AGENTS.md`. If you want Terraform to take them
over, import rather than recreate; a recreate briefly breaks deploys.

Its identity policy needs `cloudfront:*` on the distribution and VPC origin,
and `ec2:GetManagedPrefixListEntries` for the prefix list lookup. Without them
the plan fails at the CloudFront resources rather than at `terraform init`.
