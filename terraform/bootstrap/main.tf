terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

# Bootstrap runs with local state on purpose: it creates the bucket that every
# other configuration in this repo stores its state in, so it cannot itself
# live there. Apply this once, commit nothing, and never point it at the S3
# backend.
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project   = var.project
      ManagedBy = "terraform"
      Component = "tf-state"
    }
  }
}

variable "aws_region" {
  description = "Region holding the state bucket. Must match the `region` in the root backend block."
  type        = string
  default     = "us-east-1"
}

variable "project" {
  description = "Project slug, used to name the state bucket."
  type        = string
  default     = "lawyer-board"
}

data "aws_caller_identity" "current" {}

locals {
  # Bucket names are globally unique across all of AWS, so the account ID is
  # appended to keep this collision-free without inventing a random suffix.
  bucket_name = "${var.project}-tfstate-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket" "state" {
  bucket = local.bucket_name

  # Losing this bucket means losing the record of every resource Terraform
  # manages. `terraform destroy` here should be a deliberate, manual act.
  lifecycle {
    prevent_destroy = true
  }
}

# Versioning is what makes state recoverable after a bad apply or a corrupt
# write. Without it, a truncated upload is unrecoverable.
resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.state.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "state" {
  bucket = aws_s3_bucket.state.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "state" {
  bucket = aws_s3_bucket.state.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# State files hold resource attributes in plaintext; refuse any request that
# arrives over unencrypted HTTP.
resource "aws_s3_bucket_policy" "state_tls_only" {
  bucket = aws_s3_bucket.state.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "DenyInsecureTransport"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource = [
          aws_s3_bucket.state.arn,
          "${aws_s3_bucket.state.arn}/*",
        ]
        Condition = {
          Bool = {
            "aws:SecureTransport" = "false"
          }
        }
      },
    ]
  })
}

# Old state versions accumulate one object per apply. Keep enough history to
# recover from a bad week, not forever.
resource "aws_s3_bucket_lifecycle_configuration" "state" {
  bucket = aws_s3_bucket.state.id

  rule {
    id     = "expire-noncurrent-state"
    status = "Enabled"

    filter {}

    noncurrent_version_expiration {
      noncurrent_days = 90
    }

    # Native S3 locking writes a .tflock object; a crashed apply can leave a
    # stale one behind as an incomplete upload.
    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

output "state_bucket" {
  description = "Put this in the root backend block as `bucket`."
  value       = aws_s3_bucket.state.id
}
