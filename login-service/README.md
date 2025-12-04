# PlantPal Login-Service

The **Login-Service** is one of the core microservices in the *PlantPal* ecosystem.  
It handles **user authentication** and **registration orchestration**, issuing secure JWT tokens and coordinating with the **User-Service** to manage user data.

---

## Overview

| Key Feature | Description |
|--------------|-------------|
| **Role** | Orchestrates authentication and registration flows |
| **Pattern** | Implements the **Orchestration** microservice communication pattern |
| **Dependency** | Calls the `user-service` via HTTP for user validation and creation |
| **Security** | Uses `bcrypt` for password hashing and `JWT` for token-based authentication |
| **DevOps** | Fully containerized with CI/CD pipelines (GitLab), retries, and health monitoring |
| **Self-Directed Research** | Includes retry mechanisms, input validation (Zod), and Axios-based resilience for fault tolerance |

---

## Architecture and Communication Pattern

Frontend → Login-Service → User-Service → Database
│
└──> (Future) Notification-Service via SQS (async)

- **Login-Service ↔ User-Service** — synchronous **HTTP orchestration** (via Axios)
- **Optional SQS integration** (planned) — asynchronous **choreography** for non-critical notifications

This architecture cleanly separates **data ownership** and **authentication logic**, ensuring loose coupling and high cohesion:
- `user-service` owns user data and CRUD operations.
- `login-service` handles validation, hashing, and token management.

---

## Technical Implementation

### Core Libraries
| Library | Purpose |
|----------|----------|
| **Express** | Web framework for RESTful APIs |
| **Axios** | HTTP client for inter-service orchestration |
| **Axios-Retry** | Adds fault tolerance and resilience to inter-service calls |
| **Bcrypt** | Secure one-way password hashing |
| **JWT** | Stateless token-based authentication |
| **Zod** | Input validation and schema enforcement |
| **Helmet** | HTTP security headers (DevSecOps measure) |

### Key Endpoints
| Method | Endpoint | Description |
|---------|-----------|-------------|
| `POST` | `/auth/login` | Authenticates user by delegating validation to `user-service` |
| `POST` | `/auth/register` | Registers new users by delegating creation to `user-service` |
| `GET` | `/health` | Returns service health status (used in ECS monitoring) |

---

## Security Practices

| Practice | Implementation |
|-----------|----------------|
| **Input Validation** | All inputs validated via Zod schemas before processing |
| **Password Security** | Bcrypt hashing with 10 salt rounds |
| **Tokenization** | JWT tokens signed using environment-stored secrets |
| **Configuration Management** | `.env` variables used for secrets and URLs |
| **Network Resilience** | Axios timeouts and retries prevent cascading failures |
| **Security Scans** | Integrated into CI/CD using `npm audit` or DerScanner (optional) |
| **Helmet Middleware** | Adds standard HTTP hardening headers |

---

## DevOps and CI/CD Integration

Each microservice (including this one) is:
- Packaged into a Docker container (`Dockerfile`).
- Built, tested, and deployed automatically using **GitLab CI/CD** pipelines.
- Configured to deploy to both **local Docker Compose** and **AWS ECS** environments.

Pipeline stages include:
1. **Build** — Docker image build and push to GitLab Container Registry  
2. **Test** — Unit tests for JWT and service functions  
3. **Deploy** — ECS deployment trigger (using AWS CLI commands)

---

## Local Development (Docker Compose)

To run with `user-service`:

```bash
docker compose up --build
```

login-service: http://localhost:3000

user-service: http://localhost:3001

Both services communicate internally on the plantpal-net bridge network.

---

### Login Service API

**Base URL**: `http://localhost:{PORT}` (configured via `PORT` environment variable)  
**Technology**: Node.js, Express  
**Database**: Communicates with User Service

#### Routes

##### `POST /auth/login`
Authenticate a user and receive a JWT token.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Validation:**
- `email`: Valid email format (trimmed)
- `password`: Required, minimum 1 character

**Response (200 OK):**
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "gardener",
    "phoneNumber": "+6512345678"
  }
}
```

**Error Responses:**
- `401 Unauthorized`: Invalid email or password
- `429 Too Many Requests`: Account locked after 5 failed attempts (locked for 5 minutes)
- `500 Internal Server Error`: Authentication service error

**Security Features:**
- Account lockout after 5 consecutive failed login attempts
- Lockout duration: 5 minutes
- Password hashing verification using bcrypt
- JWT token expiration: 1 hour

##### `POST /auth/register`
Register a new user account.

**Request Body:**
```json
{
  "email": "newuser@example.com",
  "username": "newuser123",
  "phoneNumber": "+6512345678",
  "password": "SecurePassword123!",
  "role": "gardener"
}
```

**Validation:**
- `email`: Valid email format (trimmed)
- `username`: Minimum 3 characters, alphanumeric and underscores only (`^[A-Za-z0-9_]+$`)
- `phoneNumber`: E.164 format (`^\+?[0-9]{8,15}$`)
- `password`: 
  - Minimum 8 characters
  - Must contain uppercase letter
  - Must contain lowercase letter
  - Must contain number
  - Must contain special character
- `role`: Enum `["gardener", "admin"]`

**Response (201 Created):**
```json
{
  "message": "Registration successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses:**
- `409 Conflict`: User already exists
- `400 Bad Request`: Validation error
- `500 Internal Server Error`: Registration failed

**Additional Endpoints:**
- `GET /`: Service health check
- `GET /health`: Health status with uptime
- `GET /readiness`: Readiness check (verifies user-service dependency)
- `GET /metrics`: Prometheus metrics endpoint
- `GET /docs`: Swagger UI documentation (serves `openapi.yaml`)
