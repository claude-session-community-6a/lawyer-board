# CloudFront is the public entry point, and the only one. It terminates TLS
# with the free *.cloudfront.net certificate, so the app is reachable over
# HTTPS without owning a domain.
#
# Why the origin hop is HTTP and not HTTPS
# ----------------------------------------
# It cannot be HTTPS here. CloudFront validates the origin's certificate: it
# must chain to a public CA *and* carry the origin's domain name. The origin
# domain is the load balancer's own `*.elb.amazonaws.com` name, and ACM will
# not issue a certificate for a zone AWS owns. A self-signed or Private CA
# certificate makes CloudFront drop the connection and return 502.
#
# What replaces it is topology rather than transport: the ALB is internal, in
# private subnets, with no path from the internet, and CloudFront reaches it
# through a service-managed ENI inside the VPC. The plaintext hop exists only
# between AWS's network and your own subnet.
#
# To get real end-to-end TLS, buy a domain. Then: an ACM certificate for
# `origin.<domain>`, a 443 listener on the ALB, a 301 on port 80, and
# `origin_protocol_policy = "https-only"` below.

resource "aws_cloudfront_vpc_origin" "alb" {
  vpc_origin_endpoint_config {
    name                   = "${local.name}-alb"
    arn                    = aws_lb.main.arn
    http_port              = 80
    https_port             = 443
    origin_protocol_policy = "http-only"

    # Required by the API even when the protocol policy is http-only.
    origin_ssl_protocols {
      items    = ["TLSv1.2"]
      quantity = 1
    }
  }
}

# --- Managed policies --------------------------------------------------------

# Looked up rather than hardcoded: the managed policy UUIDs are stable but
# opaque, and a typo in one is a runtime 4xx rather than a plan error.
data "aws_cloudfront_cache_policy" "caching_disabled" {
  name = "Managed-CachingDisabled"
}

data "aws_cloudfront_cache_policy" "caching_optimized" {
  name = "Managed-CachingOptimized"
}

# Forwards every header, cookie and query string, including Host. Keeping the
# viewer's Host means the Astro server sees the cloudfront.net name the user
# actually typed, so anything derived from `Astro.url` stays correct. Safe here
# because the listener has one default action and does not route on Host.
data "aws_cloudfront_origin_request_policy" "all_viewer" {
  name = "Managed-AllViewer"
}

# --- Distribution ------------------------------------------------------------

resource "aws_cloudfront_distribution" "app" {
  enabled         = true
  comment         = local.name
  price_class     = var.cloudfront_price_class
  http_version    = "http2and3"
  is_ipv6_enabled = true

  origin {
    origin_id   = "alb"
    domain_name = aws_lb.main.dns_name

    vpc_origin_config {
      vpc_origin_id = aws_cloudfront_vpc_origin.alb.id

      # 60 is the ceiling for a VPC origin, not a preference.
      origin_keepalive_timeout = 60
      origin_read_timeout      = 60
    }
  }

  # Everything not matched below is server-rendered and per-user. Caching it
  # would serve one lawyer another's expediente, so the cache is off and the
  # distribution acts purely as a TLS-terminating reverse proxy.
  default_cache_behavior {
    target_origin_id       = "alb"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    # The write methods are needed for Astro actions and form posts. CloudFront
    # never caches them regardless of the cache policy.
    allowed_methods = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods  = ["GET", "HEAD"]

    cache_policy_id          = data.aws_cloudfront_cache_policy.caching_disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer.id
  }

  # Astro fingerprints everything under /_astro/, so these are immutable and
  # safe to cache at the edge. This is the one behavior that takes load off the
  # tasks; without it every asset request wakes up Fargate.
  ordered_cache_behavior {
    path_pattern           = "/_astro/*"
    target_origin_id       = "alb"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    allowed_methods = ["GET", "HEAD", "OPTIONS"]
    cached_methods  = ["GET", "HEAD"]

    cache_policy_id = data.aws_cloudfront_cache_policy.caching_optimized.id
  }

  viewer_certificate {
    # The free certificate that comes with every *.cloudfront.net name.
    # minimum_protocol_version cannot be set alongside it — CloudFront pins the
    # security policy to TLSv1. Raising that floor requires an alternate domain
    # name and a certificate of your own.
    cloudfront_default_certificate = true
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }
}
