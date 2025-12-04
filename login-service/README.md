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
| **Monitoring** | Prometheus metrics integration for observability and performance tracking |

---

## Architecture and Communication Pattern

```
Frontend → Login-Service → User-Service → Database
│
└──> (Future) Notification-Service via SQS (async)
```

- **Login-Service ↔ User-Service** — synchronous **HTTP orchestration** (via Axios)
- **Optional SQS integration** (planned) — asynchronous **choreography** for non-critical notifications

This architecture cleanly separates **data ownership** and **authentication logic**, ensuring loose coupling and high cohesion:
- `user-service` owns user data and CRUD operations.
- `login-service` handles validation, hashing, and token management.

### Request Flow

1. **Login Flow:**
   - Client sends credentials → Login-Service validates input (Zod)
   - Login-Service checks account lockout status
   - Login-Service calls User-Service to fetch user by email
   - Login-Service verifies password hash using bcrypt
   - Login-Service generates JWT token and returns to client

2. **Registration Flow:**
   - Client sends registration data → Login-Service validates input (Zod)
   - Login-Service checks if user exists via User-Service
   - Login-Service hashes password using bcrypt
   - Login-Service calls User-Service to create new user
   - Login-Service generates JWT token and returns to client

---

## Project Structure

```
login-service/
├── src/
│   ├── controllers/
│   │   └── authController.js      # Request handlers for login/register
│   ├── services/
│   │   ├── authService.js         # Core authentication logic (bcrypt, JWT, lockout)
│   │   └── userService.js         # HTTP client for User-Service orchestration
│   ├── routes/
│   │   └── authRoutes.js          # Express route definitions
│   ├── middlewares/
│   │   ├── errorHandler.js        # Global error handling middleware
│   │   ├── rateLimiter.js         # Rate limiting configuration (commented out)
│   │   └── validateRequest.js     # Zod schema validation middleware
│   ├── validations/
│   │   └── loginSchemas.js        # Zod schemas for request validation
│   ├── metrics.js                 # Prometheus metrics definitions
│   └── index.js                   # Express app setup and server initialization
├── tests/
│   └── login.test.js              # Unit tests for JWT generation
├── Dockerfile                     # Multi-stage Docker build configuration
├── openapi.yaml                   # OpenAPI 3.0 specification for API documentation
├── package.json                   # Dependencies and scripts
└── README.md                      # This file
```

---

## Technical Implementation

### Core Libraries
| Library | Purpose | Version |
|----------|----------|---------|
| **Express** | Web framework for RESTful APIs | ^5.1.0 |
| **Axios** | HTTP client for inter-service orchestration | ^1.13.2 |
| **Axios-Retry** | Adds fault tolerance and resilience to inter-service calls | ^4.5.0 |
| **Bcrypt** | Secure one-way password hashing | ^6.0.0 |
| **JWT** | Stateless token-based authentication | ^9.0.2 |
| **Zod** | Input validation and schema enforcement | ^4.1.12 |
| **Helmet** | HTTP security headers (DevSecOps measure) | ^8.1.0 |
| **CORS** | Cross-Origin Resource Sharing middleware | ^2.8.5 |
| **Prom-Client** | Prometheus metrics collection | ^15.1.3 |
| **Swagger UI Express** | Interactive API documentation | ^5.0.1 |
| **Express-Rate-Limit** | Rate limiting middleware | ^8.2.1 |

### Environment Variables

The service requires the following environment variables:

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `PORT` | Port number for the service to listen on | Yes | - |
| `JWT_SECRET` | Secret key for signing JWT tokens | Yes | - |
| `USER_SERVICE_URL` | Base URL of the User-Service for orchestration | Yes | - |
| `INTERNAL_API_SECRET` | Secret key for internal service-to-service authentication | No | "my-super-secret-key" |

**Example `.env` file:**
```env
PORT=3000
JWT_SECRET=your-super-secret-jwt-key-here
USER_SERVICE_URL=http://user-service:3001
INTERNAL_API_SECRET=internal-service-secret-key
```

### Resilience and Fault Tolerance

The service implements several resilience patterns:

1. **Axios Retry Configuration:**
   - Automatic retry with exponential backoff (3 retries)
   - Configurable timeout (2 seconds for User-Service calls)
   - Handles network failures and transient errors

2. **Account Lockout Mechanism:**
   - In-memory tracking of failed login attempts
   - Automatic lockout after 5 consecutive failed attempts
   - 5-minute lockout duration
   - Auto-unlock after lockout period expires
   - **Note:** Lockout state is stored in memory and resets on service restart

3. **Error Handling:**
   - Global error handler middleware catches unhandled errors
   - Structured error responses with appropriate HTTP status codes
   - Detailed error logging for debugging

4. **Health Checks:**
   - `/health` endpoint for basic health status
   - `/readiness` endpoint checks User-Service dependency
   - Used by container orchestration (ECS/Kubernetes) for liveness/readiness probes

5. **Rate Limiting:**
   - Rate limiter middleware is available but currently commented out in routes
   - Configuration supports IP-based rate limiting (200 requests per 15 minutes)
   - Can be enabled by uncommenting `loginRateLimiter` in `authRoutes.js`

### Inter-Service Communication

The service communicates with User-Service using HTTP orchestration:

1. **Authentication Header:**
   - All requests to User-Service include `x-internal-secret` header
   - Value configured via `INTERNAL_API_SECRET` environment variable
   - Prevents unauthorized access to internal endpoints

2. **Request Timeout:**
   - 2-second timeout for all User-Service calls
   - Prevents hanging requests from blocking the service

3. **Retry Logic:**
   - Automatic retry on failure (up to 3 attempts)
   - Exponential backoff between retries
   - Only retries on network errors, not on 4xx/5xx responses

4. **Error Propagation:**
   - 404 responses from User-Service are handled gracefully (user not found)
   - Other errors are logged and propagated to the client

### Key Endpoints
| Method | Endpoint | Description |
|---------|-----------|-------------|
| `POST` | `/auth/login` | Authenticates user by delegating validation to `user-service` |
| `POST` | `/auth/register` | Registers new users by delegating creation to `user-service` |
| `GET` | `/health` | Returns service health status (used in ECS monitoring) |

---

## Security Practices

| Practice | Implementation | Details |
|-----------|----------------|---------|
| **Input Validation** | All inputs validated via Zod schemas before processing | Prevents injection attacks, malformed data, and type errors |
| **Password Security** | Bcrypt hashing with 10 salt rounds | One-way hashing ensures passwords are never stored in plain text |
| **Tokenization** | JWT tokens signed using environment-stored secrets | Tokens expire after 1 hour, contain user ID, email, and role |
| **Configuration Management** | `.env` variables used for secrets and URLs | Secrets never hardcoded, loaded at runtime |
| **Network Resilience** | Axios timeouts and retries prevent cascading failures | 2-second timeout, 3 retries with exponential backoff |
| **Security Scans** | Integrated into CI/CD using `npm audit` or DerScanner (optional) | Automated vulnerability scanning in pipeline |
| **Helmet Middleware** | Adds standard HTTP hardening headers | XSS protection, content security policy, etc. |
| **Internal Service Auth** | `x-internal-secret` header for service-to-service calls | Prevents unauthorized internal API access |
| **Account Lockout** | 5 failed attempts → 5-minute lockout | Prevents brute-force attacks |
| **CORS** | Cross-Origin Resource Sharing enabled | Configurable for production environments |

### Password Requirements

Registration passwords must meet the following criteria:
- Minimum 8 characters
- At least one uppercase letter (A-Z)
- At least one lowercase letter (a-z)
- At least one number (0-9)
- At least one special character

### JWT Token Structure

Tokens contain the following claims:
```json
{
  "id": "user-uuid",
  "email": "user@example.com",
  "role": "gardener",
  "iat": 1234567890,
  "exp": 1234571490
}
```

Token expiration: **1 hour** from issuance.

---

## Monitoring and Metrics

The service exposes Prometheus-compatible metrics at the `/metrics` endpoint for observability and monitoring.

### Available Metrics

1. **HTTP Request Metrics:**
   - `login_service_http_request_duration_seconds` - Histogram of request latencies by route, method, and status
   - `login_service_http_requests_total` - Counter of total HTTP requests by route, method, and status

2. **Authentication Metrics:**
   - `login_service_login_success_total` - Counter of successful login attempts
   - `login_service_login_failure_total` - Counter of failed login attempts
   - `login_service_register_success_total` - Counter of successful registrations
   - `login_service_register_failure_total` - Counter of failed registrations

3. **Node.js Default Metrics:**
   - CPU usage, memory consumption, event loop lag, and other Node.js runtime metrics
   - All prefixed with `login_service_`

### Metrics Endpoint

**GET `/metrics`**
- Returns Prometheus-formatted metrics
- Content-Type: `text/plain; version=0.0.4; charset=utf-8`
- Can be scraped by Prometheus or other monitoring tools

### Example Metrics Output

```
# HELP login_service_http_requests_total Count of total HTTP requests
# TYPE login_service_http_requests_total counter
login_service_http_requests_total{route="/auth/login",method="POST",status="200"} 150

# HELP login_service_login_success_total Number of successful login requests
# TYPE login_service_login_success_total counter
login_service_login_success_total 120
```

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

### Docker Configuration

The service uses a multi-stage Docker build:
- **Stage 1 (Builder):** Installs production dependencies
- **Stage 2 (Runtime):** Minimal Alpine-based image with only runtime files
- **Health Check:** Built-in health check endpoint (`/health`) for container orchestration

### Container Health Check

The Dockerfile includes a health check that runs every 30 seconds:
```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1
```

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

##### `GET /`
Simple health check endpoint.

**Response (200 OK):**
```
Login Service Running
```

##### `GET /health`
Returns detailed health status of the service.

**Response (200 OK):**
```json
{
  "status": "healthy",
  "service": "login-service",
  "uptime": 1023.45,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

##### `GET /readiness`
Readiness probe that checks if the service and its dependencies are ready to serve traffic. Verifies connectivity to User-Service.

**Response (200 OK):**
```json
{
  "status": "ready",
  "dependencies": "user-service: healthy"
}
```

**Response (503 Service Unavailable):**
```json
{
  "status": "unready",
  "dependencies": "user-service: unreachable"
}
```

##### `GET /metrics`
Exposes Prometheus-compatible metrics for monitoring and observability.

**Response (200 OK):**
```
# Prometheus metrics in text format
login_service_http_requests_total{route="/auth/login",method="POST",status="200"} 150
...
```

##### `GET /docs`
Interactive Swagger UI documentation generated from `openapi.yaml`. Provides a web interface to explore and test the API endpoints.

---

## Testing

### Running Tests

```bash
npm test
```

### Test Coverage

Currently includes:
- JWT token generation and verification tests
- Basic authentication flow validation

**Test File:** `tests/login.test.js`

### Example Test

```javascript
describe("JWT generation", function () {
  it("should generate a valid token", function () {
    const token = jwt.sign({ email: "test@plantpal.com" }, "secret", { expiresIn: "1h" });
    const decoded = jwt.verify(token, "secret");
    assert.equal(decoded.email, "test@plantpal.com");
  });
});
```

---

## Development

### Prerequisites

- Node.js 20+ (Alpine Linux compatible)
- npm or yarn package manager
- Docker (for containerized development)

### Local Development Setup

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Configure Environment:**
   Create a `.env` file with required environment variables (see [Environment Variables](#environment-variables) section).

3. **Run in Development Mode:**
   ```bash
   npm run dev
   ```
   Uses `nodemon` for automatic restart on file changes.

4. **Run in Production Mode:**
   ```bash
   npm start
   ```

### Development Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `start` | `node src/index.js` | Start the service in production mode |
| `dev` | `nodemon src/index.js` | Start the service in development mode with auto-reload |
| `test` | `node ./tests/login.test.js` | Run test suite |

### API Documentation

Interactive API documentation is available at:
- **Swagger UI:** `http://localhost:3000/docs`
- **OpenAPI Spec:** `openapi.yaml` (OpenAPI 3.0.3 format)

The Swagger UI provides:
- Interactive endpoint testing
- Request/response schema documentation
- Example requests and responses
- Authentication flow documentation

---

## Error Handling

The service implements comprehensive error handling:

### Error Response Format

All errors follow a consistent format:
```json
{
  "message": "Error description",
  "code": 400
}
```

### Error Types

| Status Code | Scenario | Example Message |
|-------------|----------|-----------------|
| `400` | Validation error | "Invalid email format" |
| `401` | Authentication failure | "Invalid email or password" |
| `409` | Resource conflict | "User already exists" |
| `429` | Rate limit / Lockout | "Account temporarily locked. Try again in 300s." |
| `500` | Internal server error | "Internal server error" |
| `503` | Service unavailable | "user-service: unreachable" |

### Error Handling Flow

1. **Validation Errors:** Caught by `validateRequest` middleware, returns 400
2. **Authentication Errors:** Handled in `authService`, returns 401 or 429
3. **Service Errors:** Caught by `errorHandler` middleware, returns 500
4. **Network Errors:** Handled by Axios retry logic, falls back to 500 if all retries fail

---

## Troubleshooting

### Common Issues

1. **Service won't start:**
   - Check that `PORT` environment variable is set
   - Verify all required environment variables are present
   - Check for port conflicts

2. **Cannot connect to User-Service:**
   - Verify `USER_SERVICE_URL` is correct
   - Check network connectivity between services
   - Verify `INTERNAL_API_SECRET` matches User-Service configuration

3. **JWT token validation fails:**
   - Ensure `JWT_SECRET` is set and matches other services
   - Check token expiration (tokens expire after 1 hour)

4. **Account locked:**
   - Wait 5 minutes for automatic unlock
   - Or restart the service to clear in-memory lockout maps

### Logging

The service logs important events to stdout:
- Login attempts (success/failure)
- Account lockouts
- Service errors
- User-Service communication errors

Right now, we only exposed the /metrics endpoint. In future could use Prometheus + Grafana for better data visualisation.
