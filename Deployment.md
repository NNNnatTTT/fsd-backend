# CS464 Group 9 – Plant Care System Deployment Guide

## 1. Overview

This document explains how to manually set up our **Plant Care System** on AWS.

The system provides:
- A set of backend microservices (login, user, plants, plant catalogue, photo upload, plant doctor, proxy, scheduler, reminder).
- A notification pipeline (scheduler → reminder service → notification Lambda → Twilio).
- Integration with external services:
  - **Perenual API** for plant catalogue data.
  - **S3 Photo bucket** for user-uploaded images.
  - **Twilio** for SMS/WhatsApp notifications.
  - **SageMaker** for plant disease detection / plant doctor model.

All infrastructure is currently created manually via the AWS Console.

**Region:** `ap-southeast-1 (Singapore)`  
**Main runtime:** AWS Fargate (ECS) + Lambda + RDS (PostgreSQL)

---

## 2. High-level Architecture (Mermaid Diagram)

## 3. Prerequisites
AWS account with sufficient permissions (create VPC, ECS, RDS, Lambda, API Gateway, Route 53, WAF, CloudMap, SageMaker, S3).

Region set to ap-southeast-1.

Domain name configured in Route 53 (e.g. cs464-group9.example.com).

Application container images built and ready to push:

1) login
2) user
3) users-plants
4) photo-upload
5) plant-doctor
6) proxy
7) scheduler
8) reminder

## 4. Networking: VPC, Subnets, Routing
1) Open VPC Console → Create VPC

Name: cs464-main-vpc

IPv4 CIDR: 10.0.0.0/16

Tenancy: default.

Create public subnets (for ALB, NAT if any):

subnet-public-a – AZ ap-southeast-1a, CIDR 10.0.1.0/24

subnet-public-b – AZ ap-southeast-1b, CIDR 10.0.2.0/24

Create private subnets (for ECS tasks, RDS, RDS Proxy, SageMaker access):

subnet-private-a – AZ ap-southeast-1a, CIDR 10.0.11.0/24

subnet-private-b – AZ ap-southeast-1b, CIDR 10.0.12.0/24

2) Create an Internet Gateway:

Name: cs464-igw

Attach to cs464-main-vpc.

(Optional) Create a NAT Gateway in a public subnet (if private services need outbound internet without going through ALB):

Subnet: subnet-public-a

Allocate new Elastic IP.

Configure route tables:

Public route table:

Associate with both public subnets.

Add route 0.0.0.0/0 → Internet Gateway.

Private route table:

Associate with both private subnets.

Add route 0.0.0.0/0 → NAT Gateway (if used).

## 5. Data Layer: RDS & RDS Proxy
1) Open RDS Console → Create database:

Engine: PostgreSQL.

Template: Production or Dev/Test (as needed).

DB instance identifier: cs464-db.

Credentials: set master username & password.

VPC: cs464-main-vpc.

Subnet group: select only private subnets.

Public access: No.

Security group: create sg-rds allowing inbound from ECS tasks and RDS Proxy only.

2) Create Secrets Manager secret for DB credentials:

Name: cs464/rds/main.

Store username and password.

3) Create RDS Proxy:

Target: previously created DB.

VPC: cs464-main-vpc.

Subnets: private subnets.

Authentication: use the DB secret cs464/rds/main.

Security group: sg-rds-proxy (allows outbound to DB; inbound from ECS tasks).

Note down the RDS Proxy endpoint – used as DB_HOST in services.

## 6. Container Registry: ECR Repositories
For each microservice, create an ECR repository:

1) Open ECR Console → Create repository:

cs464-login

cs464-user

cs464-users-plants

cs464-photo-upload

cs464-plant-doctor

cs464-proxy

cs464-scheduler

cs464-reminder

Visibility: Private.

Build and push images for each service using Docker + AWS CLI:

Authenticate: aws ecr get-login-password ... | docker login ...

docker build -t <repo-uri>:latest .

docker push <repo-uri>:latest.

## 7. Compute: ECS Cluster, Task Definitions, Services
### 7.1 ECS Cluster
Open ECS Console → Clusters → Create cluster.

Cluster name: cs464-cluster.

Infrastructure: Fargate.

VPC: cs464-main-vpc.

Subnets: both private subnets.

### 7.2 Task Roles and Execution Roles
In IAM Console, create roles:

ecsTaskExecutionRole with AmazonECSTaskExecutionRolePolicy.

ecsTaskRole with:

Permission to read cs464/rds/main secret.

Permission to register in CloudMap (service discovery).

Permission to access S3 photo bucket (for photo-upload).

Permission to call SageMaker endpoint (for plant-doctor).

### 7.3 Task Definitions (repeat per service)
For each service (login, user, users-plants, photo-upload, plant-doctor, proxy, scheduler, reminder):

ECS → Task definitions → Create new Task Definition:

Launch type: Fargate.

CPU / memory: choose based on service.

Task role: ecsTaskRole.

Execution role: ecsTaskExecutionRole.

Add a container:

Image: ECR repo URI (e.g. xxxx.dkr.ecr.ap-southeast-1.amazonaws.com/cs464-login:latest).

Port mappings: 8080 (or actual app port).

Logging: send to new CloudWatch log group /ecs/<service-name>.

Environment variables (non-secret):

DB_HOST = <RDS Proxy endpoint>

DB_PORT = 5432

DB_NAME = cs464

NODE_ENV = production

SERVICE_NAME = <service-name>

SAGEMAKER_ENDPOINT (for plant-doctor)

PERENUAL_BASE_URL, PERENUAL_API_KEY (catalogue; key may also come from Secrets Manager)

PHOTO_BUCKET_NAME (photo-upload)

Repeat for all services.

### 7.4 ECS Services
For each task definition, create an ECS Service:

Launch type: Fargate.

Cluster: cs464-cluster.

Desired tasks: 1 (or more if needed).

Network:

VPC: cs464-main-vpc.

Subnets: private subnets.

Security group: sg-ecs (allows inbound from ALB security group, outbound to RDS Proxy, Internet via NAT).

Service discovery:

Use CloudMap namespace (e.g. cs464.local) so services can call each other by name.

For HTTP services behind the ALB (login, user, users-plants, plant-catalogue, photo-upload, plant-doctor, proxy):

Attach service to the corresponding ALB target group (see section 8).

For scheduler and reminder services:

They may run on schedule or as long-running tasks.

No ALB target group required if they are internal only.

## 8. Load Balancing: Private ALB & Target Groups
1) Open EC2 Console → Load Balancers → Create:

Type: Application Load Balancer.

Name: cs464-private-alb.

Scheme: Internal (private).

VPC: cs464-main-vpc.

Subnets: public subnets.

Security group: sg-alb (allows inbound from API Gateway or directly from Internet if needed; outbound to ECS).

Create Target Groups (EC2 → Target Groups):

Type: IP.

VPC: cs464-main-vpc.

One target group per HTTP service:

tg-login, tg-user, tg-users-plants, tg-plant-catalogue, tg-photo-upload, tg-plant-doctor, tg-proxy.

Configure Listeners on ALB:

Port 80 or 443 (depending on TLS).

Default action: forward to a main service (e.g. proxy) or return fixed response.

Add path-based rules, e.g.:

/login/* → tg-login

/user/* → tg-user

/plants/* → tg-users-plants

/photo/* → tg-photo-upload

/doctor/* → tg-plant-doctor

/api/* → tg-proxy

For each ECS service, register the service with the appropriate target group when creating the ECS service (section 7.4).

## 9. API Gateway, WAF, Route 53
### 9.1 API Gateway
Open API Gateway → HTTP APIs → Create:

Name: cs464-http-api.

Integration: Private ALB (use VPC Link if required).

Create routes:

ANY /{proxy+} → ALB integration (so all paths are forwarded).

Deploy stage:

Stage name: prod.

Note the invoke URL: https://<id>.execute-api.ap-southeast-1.amazonaws.com/prod.

### 9.2 WAF
Open WAF Console → Create Web ACL:

Name: cs464-waf.

Scope: Regional.

Associate with the API Gateway.

Add managed rule groups (e.g. AWS Common Rule Set).

### 9.3 Route 53
In Route 53 → Hosted zones, choose your domain.

Create a CNAME or A (alias) record:

Name: api.cs464-group9.<your-domain>.

Target: API Gateway custom domain or ALB (depending on routing choice).

## 10. Lambdas, Scheduler & Notifications
### 10.1 Notification Lambda
Open Lambda Console → Create function:

Name: cs464-notification-lambda.

Runtime: Node.js (or Python, depending on implementation).

VPC: attach to cs464-main-vpc and private subnets if it needs DB access; otherwise leave default.

IAM role: lambda-notification-role with permission to call Twilio API (via secrets) and read any required Secrets Manager entries.

Configure environment variables:

TWILIO_ACCOUNT_SID 
TWILIO_AUTH_TOKEN  
TWILIO_FROM

Any other app-specific configs.

### 10.2 Plant Catalogue (Perenual API)
Plant catalogue service (plant-catalogue) calls Perenual API.

Environment variables:

PERENUAL_API_KEY

Outbound HTTP access provided via NAT Gateway or Internet route.

## 11. External Integrations
### 11.1 S3 Photo Bucket (Photo Upload)
Open S3 Console → Create bucket:

Name: cs464-plant-photos-<group>.

Region: ap-southeast-1.

Block public access (recommended); use signed URLs if needed.

Grant ecsTaskRole permission to:

s3:PutObject, s3:GetObject, s3:DeleteObject on this bucket.

### 11.2 SageMaker (Plant Doctor)
Plant doctor service calls a SageMaker inference endpoint.

Environment variable: SAGEMAKER_ENDPOINT_NAME.

IAM permissions on ecsTaskRole to invoke the endpoint.

### 11.3 Twilio
Notification Lambda uses Twilio REST API.

Credentials stored in Secrets Manager or environment variables.

## 12. CloudMap Service Discovery
Open Cloud Map Console → Create namespace:

Type: Private DNS.

Name: cs464.local.

VPC: cs464-main-vpc.

When creating ECS services, enable service discovery:

Namespace: cs464.local.

Service name: match microservice (e.g. login, user, etc.).

This allows inter-service calls like http://login.cs464.local:8080.

## 13. Environment Variables & Secrets Summary
Secrets Manager:

cs464/rds/main – DB username & password.

Common env vars across services:

DB_HOST = RDS Proxy endpoint.

DB_PORT = 5432.

DB_NAME = cs464.

NODE_ENV = production.

Service-specific env vars:

plant-catalogue:

PERENUAL_API_KEY = sk-nk54691464867223a13448

photo-upload:

PHOTO_BUCKET_NAME

plant-doctor:

SAGEMAKER_ENDPOINT_NAME

notification-lambda:

TWILIO_* variables:

TWILIO_ACCOUNT_SID = AC8e1e750e45446a9cfae14b476951fe98
TWILIO_AUTH_TOKEN  = 8f931392c460528187779b9b3edffea2
TWILIO_FROM = +12055351098

## 14. How to Verify Deployment
Confirm ECS cluster has running tasks for all services.

Check ALB target groups – all targets should be healthy.

Hit the API Gateway / domain:

GET /health endpoint should return 200 OK.

Test login / user / plants APIs.

Upload a photo through the app and confirm:

Object appears in the S3 photo bucket.

Plant doctor inference returns a response.

Create a test reminder:

Scheduler generates upcoming reminder.

Reminder service triggers notification Lambda.

Twilio sends SMS/WhatsApp to test number.

## 15. Known Limitations / Notes
All infrastructure is manually created in AWS Console (no Terraform yet).

Scaling policies (auto-scaling) are minimal; ECS services run with fixed task counts.

Error handling and retries for external APIs (Perenual, Twilio, SageMaker) are basic and may need hardening in production.
