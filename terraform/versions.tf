terraform {
  # 1.10 is the floor for `use_lockfile`, which replaces the DynamoDB lock
  # table with a lock object written straight to S3.
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }

  backend "s3" {
    # Backend blocks cannot interpolate, so these are literals. The bucket is
    # created by terraform/bootstrap; the suffix is the AWS account ID.
    bucket       = "lawyer-board-tfstate-828786775790"
    key          = "production/terraform.tfstate"
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true
  }
}
