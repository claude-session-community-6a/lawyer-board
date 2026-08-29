# Infrastructure

Terraform for the `production` stack in `us-east-1`, account `828786775790`.

```
terraform/
  bootstrap/     state bucket only — applied once, with local state
  network.tf     VPC, public/private subnets, NAT, S3 gateway endpoint
  alb.tf         internet-facing ALB, HTTP listener, target group
  ecs.tf         Fargate cluster, task definition, service, log group
  ecr.tf         image repository and expiry rules
  s3.tf          uploads bucket for case-file documents
  opensearch.tf  Serverless collection and its three policies
  iam.tf         task execution role and the application's task role
```

## Shape of it

Requests hit an ALB in the public subnets, which forwards to Fargate tasks in
the private subnets on port 4321. The tasks have no public IP; outbound traffic
goes through a NAT gateway, except S3, which takes a free gateway endpoint —
worth having when every upload is a 25 MB PDF that would otherwise be billed
per GB through the NAT.

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

Nothing here depends on the ALB hostname, so TLS is additive: create or import
the hosted zone, request an ACM certificate in `us-east-1` with DNS validation,
add a 443 listener with the certificate, and turn the existing port 80 listener
into a redirect.

## Not managed here

The GitHub Actions OIDC deploy role and its trust policy are maintained by hand
— see the AWS OIDC section in `AGENTS.md`. If you want Terraform to take them
over, import rather than recreate; a recreate briefly breaks deploys.
