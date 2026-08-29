locals {
  name        = "${var.project}-${var.environment}"
  account_id  = data.aws_caller_identity.current.account_id
  azs         = slice(data.aws_availability_zones.available.names, 0, var.az_count)
  nat_count   = var.single_nat_gateway ? 1 : var.az_count
  uploads_arn = aws_s3_bucket.uploads.arn

  # OpenSearch Serverless names are capped at 32 characters and must be
  # lowercase alphanumeric or hyphen. Capped at 27 rather than 32 so the
  # `-data` suffix on the derived policy names still fits.
  collection_name = substr(local.name, 0, 27)

  # Public subnets get the low half of the VPC range, private the high half, so
  # a later /20 addition on either side does not collide.
  public_subnet_cidrs  = [for i in range(var.az_count) : cidrsubnet(var.vpc_cidr, 4, i)]
  private_subnet_cidrs = [for i in range(var.az_count) : cidrsubnet(var.vpc_cidr, 4, i + 8)]
}
