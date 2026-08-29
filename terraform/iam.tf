data "aws_iam_policy_document" "ecs_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }

    # Stops this role being assumable on behalf of a task in someone else's
    # account, the ECS variant of the confused deputy problem.
    condition {
      test     = "ArnLike"
      variable = "aws:SourceArn"
      values   = ["arn:aws:ecs:${var.aws_region}:${local.account_id}:*"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [local.account_id]
    }
  }
}

# --- Execution role ----------------------------------------------------------

# Used by the ECS agent, not the application: pulls the image and opens the log
# stream before any of your code runs.
resource "aws_iam_role" "ecs_execution" {
  name               = "${local.name}-ecs-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume_role.json
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# --- Task role ---------------------------------------------------------------

# The application's own identity. Everything the Astro server calls at runtime
# is authorized through this role.
resource "aws_iam_role" "ecs_task" {
  name               = "${local.name}-ecs-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume_role.json
}

data "aws_iam_policy_document" "task_uploads" {
  # Object-level access, scoped to this bucket's contents. No DeleteObject:
  # with versioning on, removing a case-file document should be a deliberate
  # operator action rather than something the web tier can do.
  statement {
    sid    = "ReadWriteUploads"
    effect = "Allow"
    actions = [
      "s3:GetObject",
      "s3:GetObjectVersion",
      "s3:PutObject",
      "s3:AbortMultipartUpload",
    ]
    resources = ["${local.uploads_arn}/*"]
  }

  # Bucket-level operations act on the bucket ARN itself, not on objects, so
  # they need their own statement.
  statement {
    sid    = "ListUploads"
    effect = "Allow"
    actions = [
      "s3:ListBucket",
      "s3:ListBucketMultipartUploads",
      "s3:GetBucketLocation",
    ]
    resources = [local.uploads_arn]
  }
}

data "aws_iam_policy_document" "task_opensearch" {
  # aoss:APIAccessAll is the single action covering every data-plane request to
  # the collection. Fine-grained control comes from the data access policy in
  # opensearch.tf; both are required.
  statement {
    sid       = "OpenSearchDataPlane"
    effect    = "Allow"
    actions   = ["aoss:APIAccessAll"]
    resources = [aws_opensearchserverless_collection.main.arn]
  }
}

data "aws_iam_policy_document" "task_exec_command" {
  # Backs `aws ecs execute-command`, the only practical way to get a shell in a
  # task that has no public IP and no bastion. The SSM channels are session
  # scoped and cannot be constrained to a resource ARN.
  statement {
    sid    = "SSMExecuteCommandChannels"
    effect = "Allow"
    actions = [
      "ssmmessages:CreateControlChannel",
      "ssmmessages:CreateDataChannel",
      "ssmmessages:OpenControlChannel",
      "ssmmessages:OpenDataChannel",
    ]
    resources = ["*"]
  }
}

data "aws_iam_policy_document" "ecs_task" {
  source_policy_documents = [
    data.aws_iam_policy_document.task_uploads.json,
    data.aws_iam_policy_document.task_opensearch.json,
    data.aws_iam_policy_document.task_exec_command.json,
  ]
}

resource "aws_iam_role_policy" "ecs_task" {
  name   = "${local.name}-task"
  role   = aws_iam_role.ecs_task.id
  policy = data.aws_iam_policy_document.ecs_task.json
}
