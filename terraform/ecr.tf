resource "aws_ecr_repository" "app" {
  name = var.project

  # deploy.yml pushes `latest` alongside the commit SHA, and re-pointing a tag
  # requires mutability. The SHA tags are what you should actually deploy.
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }
}

resource "aws_ecr_lifecycle_policy" "app" {
  repository = aws_ecr_repository.app.name

  # Rules are evaluated in ascending rulePriority and an image is only ever
  # matched by the first rule that applies.
  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Expire untagged layers left behind by overwritten tags"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 14
        }
        action = { type = "expire" }
      },
      {
        rulePriority = 2
        description  = "Keep the last 30 builds, enough to roll back a long way"
        selection = {
          tagStatus      = "tagged"
          tagPatternList = ["*"]
          countType      = "imageCountMoreThan"
          countNumber    = 30
        }
        action = { type = "expire" }
      },
    ]
  })
}
