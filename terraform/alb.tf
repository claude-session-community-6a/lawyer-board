resource "aws_security_group" "alb" {
  name        = "${local.name}-alb"
  description = "CloudFront ingress to the load balancer"
  vpc_id      = aws_vpc.main.id

  tags = { Name = "${local.name}-alb" }
}

# The load balancer has no listener certificate, so this hop is HTTP — but it
# never leaves AWS's network. The ALB is internal and lives in the private
# subnets; CloudFront reaches it through the VPC origin's service-managed ENI.
# See cloudfront.tf for why a TLS listener is not an option without a domain.
#
# Option 1 of the two the VPC origins guide gives. Option 2 — allowing only the
# service-managed CloudFront-VPCOrigins-Service-SG — is tighter, because it
# admits your distributions rather than all of CloudFront, but that group does
# not exist until the first VPC origin is created, so Terraform cannot
# reference it on a first apply. Worth switching to by hand afterwards.
data "aws_ec2_managed_prefix_list" "cloudfront_origin_facing" {
  name = "com.amazonaws.global.cloudfront.origin-facing"
}

# A prefix list rule costs its list's *max entries* against the security
# group's rule quota, not its current entry count — this one alone eats most of
# the default 60. Adding rules here may need a quota increase.
resource "aws_vpc_security_group_ingress_rule" "alb_from_cloudfront" {
  security_group_id = aws_security_group.alb.id
  description       = "HTTP from CloudFront edge locations only"
  prefix_list_id    = data.aws_ec2_managed_prefix_list.cloudfront_origin_facing.id
  from_port         = 80
  to_port           = 80
  ip_protocol       = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "alb_to_tasks" {
  security_group_id            = aws_security_group.alb.id
  description                  = "Forward to the ECS tasks"
  referenced_security_group_id = aws_security_group.tasks.id
  from_port                    = var.container_port
  to_port                      = var.container_port
  ip_protocol                  = "tcp"
}

resource "aws_lb" "main" {
  name               = substr("${local.name}-alb", 0, 32)
  load_balancer_type = "application"

  # Private. There is no route from the internet to this load balancer on any
  # port — CloudFront is the only way in. Changing `internal` replaces the ALB
  # rather than updating it.
  internal        = true
  security_groups = [aws_security_group.alb.id]
  subnets         = aws_subnet.private[*].id

  # Astro streams SSR responses; the default 60s is fine, but slow document
  # handling on the uploads route benefits from headroom. Note that CloudFront
  # gives up first: a VPC origin's read timeout caps at 60s, so a response
  # slower than that is a 504 from the edge no matter what this says.
  idle_timeout = 120

  drop_invalid_header_fields = true
  enable_deletion_protection = false
}

resource "aws_lb_target_group" "app" {
  name        = substr("${local.name}-tg", 0, 32)
  port        = var.container_port
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip" # awsvpc tasks register by ENI address, not instance

  # Fargate replaces tasks rather than draining them for long; a shorter delay
  # makes deploys finish in a reasonable time.
  deregistration_delay = 30

  health_check {
    enabled             = true
    path                = var.health_check_path
    protocol            = "HTTP"
    matcher             = "200"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }
}
