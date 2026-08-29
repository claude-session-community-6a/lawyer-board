resource "aws_security_group" "tasks" {
  name        = "${local.name}-tasks"
  description = "ECS tasks running the Astro server"
  vpc_id      = aws_vpc.main.id

  tags = { Name = "${local.name}-tasks" }
}

# Only the load balancer may reach the app port. The tasks have no public IP,
# but this also blocks lateral traffic from anything else in the VPC.
resource "aws_vpc_security_group_ingress_rule" "tasks_from_alb" {
  security_group_id            = aws_security_group.tasks.id
  description                  = "App port from the ALB"
  referenced_security_group_id = aws_security_group.alb.id
  from_port                    = var.container_port
  to_port                      = var.container_port
  ip_protocol                  = "tcp"
}

# Outbound to ECR, CloudWatch, S3 and the OpenSearch endpoint. Egress leaves
# through the NAT gateway except for S3, which takes the gateway endpoint.
resource "aws_vpc_security_group_egress_rule" "tasks_all" {
  security_group_id = aws_security_group.tasks.id
  description       = "All outbound"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

resource "aws_cloudwatch_log_group" "app" {
  name              = "/ecs/${local.name}"
  retention_in_days = var.log_retention_days
}

resource "aws_ecs_cluster" "main" {
  name = local.name

  setting {
    name  = "containerInsights"
    value = var.enable_container_insights ? "enabled" : "disabled"
  }
}

resource "aws_ecs_task_definition" "app" {
  family                   = local.name
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.task_cpu
  memory                   = var.task_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }

  container_definitions = jsonencode([
    {
      name      = var.project
      image     = "${aws_ecr_repository.app.repository_url}:${var.image_tag}"
      essential = true

      portMappings = [
        {
          containerPort = var.container_port
          protocol      = "tcp"
        },
      ]

      environment = [
        # The standalone adapter reads these; 0.0.0.0 is required for the ENI
        # to accept traffic from the load balancer.
        { name = "HOST", value = "0.0.0.0" },
        { name = "PORT", value = tostring(var.container_port) },
        { name = "NODE_ENV", value = "production" },

        # Consumed by the AWS SDK and the app's own resource lookups. No
        # credentials: the SDK picks up the task role automatically.
        { name = "AWS_REGION", value = var.aws_region },
        { name = "UPLOADS_BUCKET", value = aws_s3_bucket.uploads.id },
        { name = "OPENSEARCH_ENDPOINT", value = aws_opensearchserverless_collection.main.collection_endpoint },
        { name = "OPENSEARCH_COLLECTION", value = local.collection_name },
        # SigV4 signing for Serverless uses the `aoss` service name, not `es`.
        { name = "OPENSEARCH_SERVICE", value = "aoss" },
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.app.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "ecs"
        }
      }
    },
  ])
}

resource "aws_ecs_service" "app" {
  name            = local.name
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.app.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  # The only way into a task with no public IP, no SSH and no bastion.
  enable_execute_command = true

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.tasks.id]
    assign_public_ip = false # NAT provides egress
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.app.arn
    container_name   = var.project
    container_port   = var.container_port
  }

  # Node cold start plus Astro's first render; without this the ALB can kill a
  # task that was still coming up.
  health_check_grace_period_seconds = 60

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  # Registering targets against a listener that does not exist yet is a
  # documented race in the ECS API.
  depends_on = [aws_lb_listener.http]
}
