output "app_url" {
  description = "Where the app is reachable. HTTPS on CloudFront's own certificate; plain HTTP is redirected."
  value       = "https://${aws_cloudfront_distribution.app.domain_name}"
}

output "cloudfront_distribution_id" {
  description = "For `aws cloudfront create-invalidation` after a deploy that changes cached assets."
  value       = aws_cloudfront_distribution.app.id
}

output "alb_dns_name" {
  description = "Internal only — resolves to private addresses and is not reachable from outside the VPC."
  value       = aws_lb.main.dns_name
}

output "ecr_repository_url" {
  description = "Push target for the deploy workflow."
  value       = aws_ecr_repository.app.repository_url
}

output "ecr_repository_name" {
  description = "Set the ECR_REPOSITORY GitHub repository variable to this."
  value       = aws_ecr_repository.app.name
}

output "uploads_bucket" {
  description = "UPLOADS_BUCKET the task reads from its environment."
  value       = aws_s3_bucket.uploads.id
}

output "opensearch_endpoint" {
  description = "Collection data-plane endpoint. Sign requests with SigV4 against service `aoss`."
  value       = aws_opensearchserverless_collection.main.collection_endpoint
}

output "opensearch_dashboards_endpoint" {
  description = "Dashboards UI. Only reachable by principals in opensearch_admin_principals."
  value       = aws_opensearchserverless_collection.main.dashboard_endpoint
}

output "ecs_cluster_name" {
  description = "For `aws ecs execute-command` and manual service updates."
  value       = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  value = aws_ecs_service.app.name
}

output "task_role_arn" {
  description = "The application's runtime identity."
  value       = aws_iam_role.ecs_task.arn
}
