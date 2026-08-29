provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

data "aws_caller_identity" "current" {}

# Only the AZs that can actually host subnets today; a hardcoded list breaks
# when an account has no capacity in one of them.
data "aws_availability_zones" "available" {
  state = "available"

  # CloudFront places the VPC origin's service-managed ENI in the ALB's
  # subnets, and a handful of AZs are excluded from VPC origins entirely. AZ
  # *names* (us-east-1a) map to different physical AZs per account, so the
  # exclusion has to be by AZ ID. IDs from other regions are inert here, which
  # is why the whole published list is passed rather than a per-region one.
  exclude_zone_ids = var.vpc_origin_unsupported_zone_ids

  filter {
    name   = "opt-in-status"
    values = ["opt-in-not-required"]
  }
}
