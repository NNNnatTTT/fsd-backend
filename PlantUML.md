@startuml
!theme plain
skinparam linetype ortho
skinparam packageStyle rectangle
skinparam defaultTextAlignment center
skinparam roundcorner 10
skinparam shadowing true

' ============================================
' DIAGRAM: PlantPal Microservices Architecture
' ============================================
' This diagram illustrates the complete AWS-based architecture
' for the PlantPal application, showing the flow from users
' through edge services to microservices and data layers.
' ============================================

left to right direction

' === External Users ===
actor "Users\n(Web / Mobile)" as User #LightBlue

' === AWS VPC Container ===
rectangle "AWS Cloud / VPC" #LightYellow {

  ' === Edge / Ingress Layer ===
  rectangle "Edge Services" #LightGreen {
    node "Route 53\n(DNS)" as R53
    node "WAF\n(Web Application Firewall)" as WAF
    node "API Gateway\n(REST API)" as APIGW
    node "Application Load Balancer\n(ALB)" as ALB
  }

  ' === Application Services Layer ===
  rectangle "Private Subnets\n(ECS Fargate)" as Priv #LightCoral {
    ' Core Services
    node "Login Service" as Login
    node "User Service" as UserSvc
    
    ' Plant Management Services
    node "Plant Catalog Service" as Catalog
    node "Photo Upload Service" as Photo
    node "Plant Doctor Service" as Doctor
    node "User Plants Service" as Plants
    
    ' Reminder & Notification Services
    node "Reminder Service" as Rem
    node "Scheduler Service" as Sched
    node "Proxy Service" as Proxy
  }

  ' === Background Services ===
  rectangle "Background Services" as Background #LightSteelBlue {
    node "Notification Lambda\n(SMS via Twilio)" as NotifLambda
  }

  ' === Data & ML Layer ===
  rectangle "Data & ML Layer" as DATA #LightGray {
    database "Primary RDS\n(PostgreSQL)" as RDS #LightGreen
    node "SageMaker Endpoint\n(Plant Disease Detection)" as Sage #Orange
  }

  ' === Service Discovery ===
  node "AWS CloudMap\n(Service Discovery)" as CloudMap #LightCyan
}

' === External Services ===
cloud "External Services" #LightPink {
  cloud "Perenual API\n(Plant Database)" as Perenual
  cloud "S3 Bucket\n(Photo Storage)" as S3
  cloud "Twilio\n(SMS Gateway)" as Twilio
}

' ============================================
' CONNECTIONS: Request Flow
' ============================================

' === User Request Flow ===
User --> R53
R53 --> WAF
WAF --> APIGW
APIGW --> ALB

' === ALB to Application Services ===
ALB --> Login
ALB --> UserSvc
ALB --> Catalog
ALB --> Photo
ALB --> Doctor
ALB --> Plants
ALB --> Proxy

' === Service Orchestration ===
Login --> UserSvc

' === Services to Data Layer ===
UserSvc --> RDS
Catalog --> RDS
Photo --> RDS
Doctor --> RDS
Plants --> RDS
Rem --> RDS
Proxy --> RDS

' === ML Processing ===
Doctor --> Sage

' === Background Processing Flow ===
Sched --> Rem
Rem --> NotifLambda
NotifLambda --> Twilio

' === External Service Integrations ===
Catalog --> Perenual
Photo --> S3

' === Service Discovery ===
CloudMap ..> Priv
CloudMap ..> Background

' === Hidden Layout Connections ===
Priv -[hidden]-> DATA
Background -[hidden]-> DATA

@enduml

---

## Diagram Explanation

This PlantUML diagram illustrates the **complete AWS-based microservices architecture** for the PlantPal application. The diagram shows how user requests flow through the system, how services interact with each other, and how data is stored and processed.

### Architecture Overview

The architecture follows a **layered microservices pattern** deployed on AWS, with clear separation between edge services, application services, data layer, and external integrations.

---

### 1. User Access Layer

**Users (Web / Mobile)**
- External users accessing the PlantPal application through web browsers or mobile applications
- All user traffic enters through AWS edge services

---

### 2. Edge Services (Ingress Layer)

This layer handles incoming traffic and provides security, routing, and load balancing:

**Route 53 (DNS)**
- AWS managed DNS service
- Resolves domain names to IP addresses
- First point of entry for all user requests

**WAF (Web Application Firewall)**
- Protects against common web exploits and attacks
- Filters malicious traffic before it reaches the application
- Provides DDoS protection

**API Gateway**
- RESTful API endpoint management
- Handles API versioning, throttling, and request/response transformation
- Acts as a single entry point for all API requests

**Application Load Balancer (ALB)**
- Distributes incoming traffic across multiple service instances
- Provides health checks and automatic failover
- Routes requests to appropriate microservices based on path/rules

---

### 3. Application Services Layer (Private Subnets)

All application services run in **ECS Fargate** containers within private subnets for security. Services are organized by functionality:

#### Core Services
- **Login Service**: Handles user authentication and JWT token generation (orchestrates with User Service)
- **User Service**: Manages user profiles and user data (owns user database)

#### Plant Management Services
- **Plant Catalog Service**: Provides plant information and catalog data
- **Photo Upload Service**: Handles plant photo uploads and storage
- **Plant Doctor Service**: Provides plant disease detection using ML
- **User Plants Service**: Manages users' personal plant collections

#### Reminder & Notification Services
- **Reminder Service**: Manages plant care reminders and schedules
- **Scheduler Service**: Background service that polls for due reminders
- **Proxy Service**: Manages proxy phone numbers for reminders

---

### 4. Background Services

**Notification Lambda**
- Serverless function that sends SMS notifications via Twilio
- Triggered by the Reminder Service when reminders are due
- Handles SMS delivery and error handling

---

### 5. Data & ML Layer

**Primary RDS (PostgreSQL)**
- Centralized relational database
- Stores all application data:
  - User accounts and authentication data
  - Plant catalog information
  - User plants and care history
  - Reminders and schedules
  - Photo metadata
  - Disease diagnosis history
- All microservices connect to this database (shared database pattern)

**SageMaker Endpoint**
- AWS managed ML inference endpoint
- Used by Plant Doctor Service for plant disease detection
- Processes uploaded plant images and returns disease predictions
- Runs pre-trained ML models for image classification

---

### 6. Service Discovery

**AWS CloudMap**
- Provides service discovery for all Fargate services
- Allows services to find and communicate with each other using service names
- Eliminates the need for hardcoded IP addresses or endpoints

---

### 7. External Services

**Perenual API**
- Third-party plant database API
- Used by Plant Catalog Service to fetch plant information
- Provides comprehensive plant data and care instructions

**S3 Bucket (Photo Storage)**
- AWS Simple Storage Service
- Stores uploaded plant photos
- Provides scalable, durable object storage
- Photos are referenced in the database but stored in S3

**Twilio**
- Third-party SMS gateway service
- Used by Notification Lambda to send SMS reminders
- Handles SMS delivery to user phone numbers

---

### Request Flow Patterns

#### User Request Flow (1-4)
1. User makes request → **Route 53** resolves domain
2. **WAF** filters and secures traffic
3. **API Gateway** receives and routes API request
4. **ALB** distributes to appropriate microservice

#### Authentication Flow
- **Login Service** orchestrates with **User Service** for user validation and creation
- **User Service** owns and manages all user data in **RDS**
- **Login Service** does not directly access the database

#### Data Access Pattern
- Most application services connect directly to **RDS** for data persistence
- **Login Service** is an exception - it orchestrates with **User Service** instead
- Services use connection pooling and read/write separation where applicable

#### ML Processing Flow
- **Plant Doctor Service** receives image upload
- Sends image to **SageMaker Endpoint** for inference
- Receives disease prediction results
- Stores diagnosis in **RDS** database

#### Background Processing Flow
- **Scheduler Service** polls **Reminder Service** for due reminders
- **Reminder Service** triggers **Notification Lambda**
- **Notification Lambda** sends SMS via **Twilio**

---

### Security Architecture

- **Private Subnets**: All application services run in private subnets (no direct internet access)
- **WAF Protection**: Edge-level security filtering
- **VPC Isolation**: Services isolated within AWS VPC
- **IAM Roles**: Services use IAM roles for AWS resource access
- **Security Groups**: Network-level access control

---

### Scalability Features

- **ECS Fargate**: Auto-scaling based on CPU/memory metrics
- **ALB**: Distributes load across multiple service instances
- **RDS**: Can scale vertically and horizontally (read replicas)
- **Lambda**: Automatically scales with request volume
- **S3**: Unlimited storage capacity

---

### Key Design Decisions

1. **Microservices Architecture**: Each service has a single responsibility
2. **Shared Database**: All services use the same RDS instance (simpler for this use case)
3. **ECS Fargate**: Serverless containers (no EC2 management)
4. **API Gateway + ALB**: Two-tier routing for flexibility
5. **CloudMap**: Service discovery for dynamic service locations
6. **Lambda for Notifications**: Serverless for event-driven SMS delivery

---

### Deployment Considerations

- All services are containerized (Docker)
- Services are deployed to ECS Fargate via CI/CD pipelines
- Database migrations handled separately
- Environment-specific configurations via environment variables
- Health checks configured for all services
- Logging via CloudWatch

---

### Monitoring & Observability

- **CloudWatch**: Logs and metrics for all services
- **ALB Access Logs**: Request logging and analysis
- **RDS Monitoring**: Database performance metrics
- **Lambda Metrics**: Function execution metrics
- **SageMaker Monitoring**: ML endpoint performance

---

This architecture provides a **scalable, secure, and maintainable** foundation for the PlantPal application, with clear separation of concerns and well-defined communication patterns between services.