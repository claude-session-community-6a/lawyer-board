# OpenSearch Serverless is gated by three separate policies plus IAM. All four
# must line up or requests fail with an opaque 403:
#   1. encryption policy  — required before the collection can be created
#   2. network policy     — whether the endpoint is reachable at all
#   3. data access policy — which principals may touch which indexes
#   4. IAM (iam.tf)       — aoss:APIAccessAll on the collection ARN
# Granting only IAM, or only the data access policy, is the usual failure.

resource "aws_opensearchserverless_security_policy" "encryption" {
  name = "${local.collection_name}-enc"
  type = "encryption"

  policy = jsonencode({
    Rules = [
      {
        ResourceType = "collection"
        Resource     = ["collection/${local.collection_name}"]
      },
    ]
    # An AWS-owned key avoids a KMS key to manage and rotate. Swap to a
    # customer-managed key if the case files need a dedicated key boundary.
    AWSOwnedKey = true
  })
}

resource "aws_opensearchserverless_security_policy" "network" {
  name = "${local.collection_name}-net"
  type = "network"

  # Public endpoint by choice: the tasks reach it via NAT, and every request is
  # SigV4-signed. The data access policy below is the actual authorization
  # boundary — reachability alone grants nothing.
  policy = jsonencode([
    {
      Rules = [
        {
          ResourceType = "collection"
          Resource     = ["collection/${local.collection_name}"]
        },
        {
          ResourceType = "dashboard"
          Resource     = ["collection/${local.collection_name}"]
        },
      ]
      AllowFromPublic = true
    },
  ])
}

resource "aws_opensearchserverless_collection" "main" {
  name = local.collection_name

  # VECTORSEARCH carries both k-NN vector fields and full-text search, so
  # keyword queries over expediente fields and semantic search over document
  # text share one collection. Type is immutable after creation.
  type = "VECTORSEARCH"

  description = "Expedientes and document search for ${local.name}"

  # DISABLED halves the OCU floor from 4 to 2. This is the difference between
  # roughly $350 and $700 a month at idle, and it gives up warm standby
  # capacity in a second AZ.
  standby_replicas = var.opensearch_standby_replicas

  depends_on = [
    aws_opensearchserverless_security_policy.encryption,
    aws_opensearchserverless_security_policy.network,
  ]
}

locals {
  # The application: enough to create and maintain its own indexes and to read
  # and write documents. Deliberately without DeleteIndex.
  aoss_app_statement = {
    Rules = [
      {
        ResourceType = "collection"
        Resource     = ["collection/${local.collection_name}"]
        Permission = [
          "aoss:DescribeCollectionItems",
          "aoss:CreateCollectionItems",
          "aoss:UpdateCollectionItems",
        ]
      },
      {
        ResourceType = "index"
        Resource     = ["index/${local.collection_name}/*"]
        Permission = [
          "aoss:CreateIndex",
          "aoss:DescribeIndex",
          "aoss:UpdateIndex",
          "aoss:ReadDocument",
          "aoss:WriteDocument",
        ]
      },
    ]
    Principal = [aws_iam_role.ecs_task.arn]
  }

  # Human operators. Full access, including deletes and the Dashboards UI.
  aoss_admin_statement = {
    Rules = [
      {
        ResourceType = "collection"
        Resource     = ["collection/${local.collection_name}"]
        Permission   = ["aoss:*"]
      },
      {
        ResourceType = "index"
        Resource     = ["index/${local.collection_name}/*"]
        Permission   = ["aoss:*"]
      },
    ]
    Principal = var.opensearch_admin_principals
  }

  # A statement with an empty Principal list is rejected outright, so the admin
  # statement only appears once someone is actually named.
  aoss_data_policy = concat(
    [local.aoss_app_statement],
    length(var.opensearch_admin_principals) > 0 ? [local.aoss_admin_statement] : [],
  )
}

resource "aws_opensearchserverless_access_policy" "data" {
  name   = "${local.collection_name}-data"
  type   = "data"
  policy = jsonencode(local.aoss_data_policy)
}
