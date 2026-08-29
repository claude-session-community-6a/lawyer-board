variable "project" {
  description = "Project slug. Prefixes every resource name."
  type        = string
  default     = "lawyer-board"
}

variable "environment" {
  description = "Environment name. Matches the GitHub environment the deploy workflow targets."
  type        = string
  default     = "production"
}

variable "aws_region" {
  description = "Region for every resource. Must match the backend block in versions.tf."
  type        = string
  default     = "us-east-1"
}

# --- Networking --------------------------------------------------------------

variable "vpc_cidr" {
  description = "CIDR for the VPC. /16 leaves room to add subnets without renumbering."
  type        = string
  default     = "10.0.0.0/16"
}

variable "az_count" {
  description = "How many AZs to spread subnets across. Two is the minimum an ALB accepts."
  type        = number
  default     = 2

  validation {
    condition     = var.az_count >= 2 && var.az_count <= 4
    error_message = "An ALB requires subnets in at least 2 AZs, and 4 is more than this app needs."
  }
}

variable "vpc_origin_unsupported_zone_ids" {
  description = <<-EOT
    AZ IDs that CloudFront VPC origins cannot use. Subnets are kept out of
    these so the service-managed ENI can be created. The default is the
    exception list from the VPC origins documentation; entries outside the
    current region are ignored, so it needs no per-region tailoring.
  EOT
  type        = list(string)
  default     = ["use1-az3", "usw1-az2", "apne1-az3", "cac1-az3"]
}

variable "single_nat_gateway" {
  description = <<-EOT
    Route every private subnet through one NAT gateway instead of one per AZ.
    Saves roughly $33/mo per AZ avoided, at the cost of making that AZ a single
    point of failure for outbound traffic. Flip to false before this carries
    real production load.
  EOT
  type        = bool
  default     = true
}

# --- Application container ---------------------------------------------------

variable "container_port" {
  description = "Port the Astro standalone server listens on. Matches PORT in the Dockerfile."
  type        = number
  default     = 4321
}

variable "image_tag" {
  description = <<-EOT
    ECR image tag the service runs. The deploy workflow pushes both `latest` and
    the commit SHA; pin to a SHA when you want Terraform to control rollouts.
  EOT
  type        = string
  default     = "latest"
}

variable "task_cpu" {
  description = "Fargate CPU units. 512 = 0.5 vCPU."
  type        = number
  default     = 512
}

variable "task_memory" {
  description = "Fargate memory in MiB. Must be a legal pairing with task_cpu."
  type        = number
  default     = 1024
}

variable "desired_count" {
  description = "Number of tasks to run."
  type        = number
  default     = 1
}

variable "health_check_path" {
  description = <<-EOT
    Path the ALB polls. Defaults to the same route the Dockerfile HEALTHCHECK
    uses. Worth replacing with a dedicated /healthz that skips rendering.
  EOT
  type        = string
  default     = "/expedientes"
}

variable "log_retention_days" {
  description = "CloudWatch Logs retention for the task log group."
  type        = number
  default     = 30
}

variable "enable_container_insights" {
  description = "Container Insights costs per metric ingested; off until the dashboards are worth it."
  type        = bool
  default     = false
}

# --- OpenSearch Serverless ---------------------------------------------------

variable "opensearch_standby_replicas" {
  description = <<-EOT
    ENABLED keeps warm replicas in a second AZ and doubles the OCU floor from 2
    to 4 — a large fixed cost. DISABLED is the right call until the collection
    is load-bearing.
  EOT
  type        = string
  default     = "DISABLED"

  validation {
    condition     = contains(["ENABLED", "DISABLED"], var.opensearch_standby_replicas)
    error_message = "Must be ENABLED or DISABLED."
  }
}

variable "opensearch_admin_principals" {
  description = <<-EOT
    Extra IAM principal ARNs granted full access to the collection and its
    Dashboards — your own user or SSO role. Without an entry here, no human can
    read the collection even with admin IAM permissions, because the data
    access policy is a separate gate.
  EOT
  type        = list(string)
  default     = []
}

# --- CloudFront --------------------------------------------------------------

variable "cloudfront_price_class" {
  description = <<-EOT
    Which edge locations serve the distribution. PriceClass_100 is the United
    States, Mexico, Canada, Europe and Israel — enough for this app, and the
    cheapest. PriceClass_All adds South America and Asia Pacific.
  EOT
  type        = string
  default     = "PriceClass_100"

  validation {
    condition     = contains(["PriceClass_100", "PriceClass_200", "PriceClass_All"], var.cloudfront_price_class)
    error_message = "Must be PriceClass_100, PriceClass_200 or PriceClass_All."
  }
}

# --- Storage -----------------------------------------------------------------

variable "uploads_noncurrent_expiration_days" {
  description = "How long superseded versions of an uploaded document are retained."
  type        = number
  default     = 365
}
