# PlantPal User-Service

The **User-Service** is a core microservice in the *PlantPal* ecosystem that owns and manages all user data. It provides a data layer for user information, handling CRUD operations on user records stored in PostgreSQL. The service implements strict access control, with internal endpoints protected for service-to-service communication and public endpoints for frontend access.

---

## Overview

| Key Feature | Description |
|--------------|-------------|
| **Role** | Data service that owns and manages user data |
| **Pattern** | Implements the **Data Ownership** microservice pattern |
| **Database** | PostgreSQL with connection pooling and SSL support |
| **Security** | Internal API authentication, input validation, soft deletes |
| **DevOps** | Fully containerized with AWS Secrets Manager integration |
| **Access Control** | Internal endpoints (login-service only) and public endpoints (frontend) |

---

## Architecture and Communication Pattern

```
Login-Service → User-Service → PostgreSQL Database
Frontend → User-Service → PostgreSQL Database
```

- **User-Service ↔ Login-Service** — synchronous **HTTP orchestration** (Login-Service calls User-Service)
- **User-Service ↔ Frontend** — direct access for public user profile endpoints
- **User-Service ↔ PostgreSQL** — direct database connection with connection pooling

This architecture ensures:
- **Single Source of Truth:** User-Service is the only service that directly accesses user data
- **Data Ownership:** All user CRUD operations go through User-Service
- **Loose Coupling:** Other services interact via well-defined HTTP APIs

### Request Flow

1. **User Creation (Internal):**
   - Login-Service sends user data → User-Service validates input (Zod)
   - User-Service checks for conflicts (email, username, phoneNumber)
   - User-Service creates user in database within a transaction
   - User-Service returns created user data

2. **User Lookup by Email (Internal):**
   - Login-Service requests user by email → User-Service queries database
   - User-Service returns user data (including password_hash for authentication)

3. **User Lookup by ID (Public):**
   - Frontend requests user by ID → User-Service queries database
   - User-Service returns public user profile (excludes sensitive data)

---

## Project Structure

```
user-service/
├── src/
│   ├── controllers/
│   │   └── userControllers.js      # Request handlers for user operations
│   ├── services/
│   │   └── userServices.js         # Database operations and business logic
│   ├── routes/
│   │   └── userRoutes.js           # Express route definitions with middleware
│   ├── middlewares/
│   │   ├── errorHandler.js        # Global error handling middleware
│   │   ├── validateRequest.js     # Zod schema validation middleware
│   │   └── verifyInternal.js      # Internal API authentication middleware
│   ├── validations/
│   │   └── userSchemas.js         # Zod schemas for request validation
│   ├── cert/
│   │   └── global-bundle.pem      # AWS RDS SSL certificate
│   ├── db.js                      # PostgreSQL connection pool with AWS Secrets Manager
│   └── index.js                   # Express app setup and server initialization
├── tests/
│   ├── user.test.js               # Basic service tests
│   ├── userService.test.js        # Service layer tests
│   └── userController.test.js     # Controller layer tests
├── Dockerfile                     # Multi-stage Docker build configuration
├── docker-compose.yml             # Local development setup with PostgreSQL
├── jest.config.js                 # Jest test configuration
├── package.json                   # Dependencies and scripts
└── README.md                      # This file
```

---

## Technical Implementation

### Core Libraries
| Library | Purpose | Version |
|----------|----------|---------|
| **Express** | Web framework for RESTful APIs | ^5.1.0 |
| **PostgreSQL (pg)** | PostgreSQL client with connection pooling | ^8.16.3 |
| **AWS SDK Secrets Manager** | Secure credential management | ^3.929.0 |
| **Zod** | Input validation and schema enforcement | ^4.1.12 |
| **CORS** | Cross-Origin Resource Sharing middleware | ^2.8.5 |
| **Jest** | Testing framework | ^30.2.0 |
| **Supertest** | HTTP assertion library for testing | ^7.1.4 |

### Database Schema

The service uses PostgreSQL with the following schema structure:

**Schema:** `users`
**Table:** `user_list`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key, auto-generated |
| `email` | VARCHAR | Unique email address |
| `username` | VARCHAR | Unique username |
| `phone_number` | VARCHAR | Unique phone number (E.164 format) |
| `password_hash` | VARCHAR | Bcrypt hashed password |
| `role` | ENUM | User role: `gardener` or `admin` |
| `created_at` | TIMESTAMP | Account creation timestamp |
| `deleted_at` | TIMESTAMP | Soft delete timestamp (NULL for active users) |

**Key Constraints:**
- Unique constraints on `email`, `username`, and `phone_number` (among active users)
- Soft delete pattern: `deleted_at IS NULL` indicates active user

### Environment Variables

The service requires the following environment variables:

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `PORT` | Port number for the service to listen on | Yes | - |
| `INTERNAL_API_SECRET` | Secret key for internal service-to-service authentication | Yes | - |
| `DB_SECRET` | AWS Secrets Manager secret name containing DB credentials | Yes | - |
| `DB_NAME` | PostgreSQL database name | Yes | - |

**AWS Secrets Manager Secret Structure:**
The secret stored in AWS Secrets Manager should contain:
```json
{
  "host": "your-rds-endpoint.amazonaws.com",
  "port": 5432,
  "username": "db_user",
  "password": "db_password"
}
```

**Example `.env` file (for local development):**
```env
PORT=3001
INTERNAL_API_SECRET=my-super-secret-key
DB_SECRET=plantpal-db-secret
DB_NAME=plantpal
```

**Note:** For local development with Docker Compose, you can use a direct `DATABASE_URL` instead of AWS Secrets Manager.

### Database Connection

The service implements a sophisticated database connection setup:

1. **AWS Secrets Manager Integration:**
   - Retrieves database credentials from AWS Secrets Manager at startup
   - Supports secure credential rotation without code changes
   - Region: `ap-southeast-1` (configurable)

2. **Connection Pooling:**
   - Uses `pg.Pool` for efficient connection management
   - Maximum 10 concurrent connections
   - 30-second idle timeout
   - Automatic connection retry and error handling

3. **SSL/TLS Configuration:**
   - SSL enabled for secure database connections (required for AWS RDS)
   - Uses AWS RDS global bundle certificate (`global-bundle.pem`)
   - Certificate validation enabled (`rejectUnauthorized: true`)

4. **Transaction Support:**
   - User creation uses database transactions
   - Ensures atomicity for conflict checks and inserts
   - Automatic rollback on errors

### Soft Delete Pattern

The service implements soft deletes rather than hard deletes:

- **Active Users:** `deleted_at IS NULL`
- **Deleted Users:** `deleted_at` contains timestamp of deletion
- **Benefits:**
  - Data preservation for audit trails
  - Ability to restore deleted accounts
  - Historical data analysis
- **Query Behavior:** All queries automatically filter out soft-deleted users

---

## Security Practices

| Practice | Implementation | Details |
|-----------|----------------|---------|
| **Input Validation** | All inputs validated via Zod schemas before processing | Prevents injection attacks, malformed data, and type errors |
| **Internal API Protection** | `x-internal-secret` header required for internal endpoints | Prevents unauthorized access to sensitive operations |
| **SQL Injection Prevention** | Parameterized queries with `$1, $2, ...` placeholders | All database queries use prepared statements |
| **Credential Management** | AWS Secrets Manager for database credentials | Secrets never hardcoded, supports rotation |
| **SSL/TLS** | Encrypted database connections | Required for production AWS RDS connections |
| **Soft Deletes** | Logical deletion with `deleted_at` timestamp | Prevents accidental data loss, maintains audit trail |
| **Connection Pooling** | Limited concurrent connections | Prevents resource exhaustion and DoS attacks |
| **CORS** | Cross-Origin Resource Sharing enabled | Configurable for production environments |

### Access Control

The service implements two levels of access control:

1. **Internal Endpoints** (Protected by `verifyInternal` middleware):
   - `POST /users` - Create user
   - `GET /users?email={email}` - Get user by email
   - Requires `x-internal-secret` header matching `INTERNAL_API_SECRET`
   - Only accessible by other services (e.g., login-service)

2. **Public Endpoints** (No authentication required):
   - `GET /users/:id` - Get user by ID
   - Accessible by frontend applications
   - Returns only active users (excludes soft-deleted)

---

## API Endpoints

### Internal Endpoints

#### `POST /users`
Create a new user. **Requires internal authentication** (verifyInternal middleware).

**Headers:**
```
x-internal-secret: {INTERNAL_API_SECRET}
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "username": "username123",
  "phoneNumber": "+6512345678",
  "passwordHash": "bcrypt_hashed_password_string_min_20_chars",
  "role": "gardener"
}
```

**Validation:**
- `email`: Valid email format
- `username`: Minimum 3 characters (trimmed), alphanumeric and underscores
- `phoneNumber`: Format `^\+?\d{8,15}$` (E.164 format)
- `passwordHash`: Minimum 20 characters (bcrypt hash validation)
- `role`: Enum `["gardener", "admin"]`

**Response (201 Created):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "username": "username123",
  "phone_number": "+6512345678",
  "password_hash": "bcrypt_hash",
  "role": "gardener",
  "created_at": "2024-01-01T00:00:00.000Z",
  "deleted_at": null
}
```

**Error Responses:**
- `400 Bad Request`: Validation error
- `403 Forbidden`: Missing or invalid `x-internal-secret` header
- `409 Conflict`: User already exists (email, username, or phoneNumber conflict)
- `500 Internal Server Error`: Database error

**Transaction Behavior:**
- Checks for conflicts within a database transaction
- Rolls back on any error
- Handles both application-level and database-level unique constraint violations

#### `GET /users?email={email}`
Get user by email. **Requires internal authentication**.

**Headers:**
```
x-internal-secret: {INTERNAL_API_SECRET}
```

**Query Parameters:**
- `email` (required): User email address

**Response (200 OK):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "username": "username123",
  "phone_number": "+6512345678",
  "password_hash": "bcrypt_hash",
  "role": "gardener",
  "created_at": "2024-01-01T00:00:00.000Z",
  "deleted_at": null
}
```

**Error Responses:**
- `400 Bad Request`: Email query parameter required
- `403 Forbidden`: Missing or invalid `x-internal-secret` header
- `404 Not Found`: User not found (or soft-deleted)
- `500 Internal Server Error`: Database error

**Note:** Returns `password_hash` for authentication purposes. Only accessible by internal services.

### Public Endpoints

#### `GET /users/:id`
Get user by ID. Publicly accessible (no authentication required).

**Path Parameters:**
- `id` (required): User UUID

**Response (200 OK):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "username": "username123",
  "phone_number": "+6512345678",
  "role": "gardener",
  "created_at": "2024-01-01T00:00:00.000Z",
  "deleted_at": null
}
```

**Error Responses:**
- `400 Bad Request`: ID parameter required
- `404 Not Found`: User not found (or soft-deleted)
- `500 Internal Server Error`: Database error

**Note:** 
- Only returns active users (where `deleted_at IS NULL`)
- Does not return `password_hash` (excluded from response)
- Suitable for public user profile display

### System Endpoints

#### `GET /`
Simple health check endpoint.

**Response (200 OK):**
```
User Service Running
```

---

## Error Handling

The service implements comprehensive error handling:

### Error Response Format

All errors follow a consistent format:
```json
{
  "message": "Error description"
}
```

### Error Types

| Status Code | Scenario | Example Message |
|-------------|----------|-----------------|
| `400` | Validation error or missing parameter | "Email query required" |
| `403` | Invalid or missing internal secret | "Forbidden" |
| `404` | Resource not found | "User not found" |
| `409` | Resource conflict | "User already exists" |
| `500` | Internal server error | "Database error" |

### Error Handling Flow

1. **Validation Errors:** Caught by `validateRequest` middleware, returns 400
2. **Authentication Errors:** Caught by `verifyInternal` middleware, returns 403
3. **Database Errors:** Handled in service layer, returns appropriate status codes
4. **Unhandled Errors:** Caught by `errorHandler` middleware, returns 500

### Database Error Handling

- **Unique Constraint Violations:** Detected at both application and database levels
- **Transaction Rollback:** Automatic rollback on any error within transactions
- **Connection Errors:** Logged and propagated as 500 errors
- **Query Errors:** Detailed logging for debugging while returning generic messages to clients

---

## Testing

### Running Tests

```bash
npm test
```

### Test Configuration

- **Framework:** Jest with ESM support
- **Environment:** Node.js test environment
- **Coverage:** Enabled with `--coverage` flag
- **Test Files:**
  - `tests/user.test.js` - Basic service tests
  - `tests/userService.test.js` - Service layer tests
  - `tests/userController.test.js` - Controller layer tests

### Test Structure

Tests are organized by layer:
- **Unit Tests:** Test individual functions and services
- **Integration Tests:** Test controller and route handlers
- **Database Tests:** Test database operations (may require test database)

### Example Test

```javascript
describe("User service basic test", () => {
  test("should always pass", () => {
    expect(1 + 1).toBe(2);
  });
});
```

---

## Development

### Prerequisites

- Node.js 20+ (Alpine Linux compatible)
- npm or yarn package manager
- Docker and Docker Compose (for containerized development)
- PostgreSQL 16+ (or use Docker Compose)
- AWS Account (for production Secrets Manager access)

### Local Development Setup

1. **Using Docker Compose (Recommended):**
   ```bash
   docker compose up --build
   ```
   This starts:
   - User-Service on port 3001
   - PostgreSQL on port 5433 (mapped from container port 5432)

2. **Manual Setup:**
   ```bash
   # Install dependencies
   npm install
   
   # Set up environment variables
   cp .env.example .env
   # Edit .env with your configuration
   
   # Start PostgreSQL (if not using Docker)
   # Then start the service
   npm start
   ```

### Development Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `test` | `cross-env NODE_ENV=test node --experimental-vm-modules node_modules/jest/bin/jest.js --colors --coverage --runInBand` | Run test suite with coverage |

### Database Setup

For local development, you can use Docker Compose which includes a PostgreSQL instance:

```yaml
postgres:
  image: postgres:16-alpine
  environment:
    POSTGRES_USER: postgres
    POSTGRES_PASSWORD: postgres
    POSTGRES_DB: plantpal
  ports:
    - "5433:5432"
```

**Database Schema:**
The service expects a PostgreSQL database with:
- Schema: `users`
- Table: `user_list`
- See [Database Schema](#database-schema) section for table structure

**Note:** For production, use AWS RDS with Secrets Manager integration.

---

## DevOps and CI/CD Integration

The service is designed for cloud deployment:

- **Containerization:** Multi-stage Docker build for optimized image size
- **CI/CD:** GitLab CI/CD pipeline integration (see `.gitlab-ci.yml`)
- **AWS Integration:** Secrets Manager for secure credential management
- **Database:** AWS RDS PostgreSQL with SSL/TLS

### Docker Configuration

The service uses a multi-stage Docker build:
- **Stage 1 (Builder):** Installs production dependencies
- **Stage 2 (Runtime):** Minimal Alpine-based image with only runtime files

### AWS Secrets Manager Setup

1. **Create Secret in AWS Secrets Manager:**
   ```json
   {
     "host": "your-rds-endpoint.amazonaws.com",
     "port": 5432,
     "username": "db_user",
     "password": "db_password"
   }
   ```

2. **Set Environment Variables:**
   - `DB_SECRET`: Name of the secret in Secrets Manager
   - `DB_NAME`: Database name
   - Ensure IAM role has `secretsmanager:GetSecretValue` permission

3. **SSL Certificate:**
   - Certificate file (`global-bundle.pem`) must be included in Docker image
   - Located in `src/cert/` directory

---

## Troubleshooting

### Common Issues

1. **Service won't start:**
   - Check that `PORT` environment variable is set
   - Verify AWS Secrets Manager access (for production)
   - Check database connectivity

2. **Cannot connect to database:**
   - Verify `DB_SECRET` and `DB_NAME` are set correctly
   - Check AWS Secrets Manager permissions
   - Verify SSL certificate is present (`src/cert/global-bundle.pem`)
   - For local development, ensure PostgreSQL is running

3. **Internal API authentication fails:**
   - Verify `INTERNAL_API_SECRET` matches login-service configuration
   - Check that `x-internal-secret` header is being sent

4. **Unique constraint violations:**
   - Service checks for conflicts before insert
   - Database-level constraints provide additional protection
   - Both application and database checks must pass

5. **Connection pool exhaustion:**
   - Default max connections: 10
   - Increase pool size if needed (modify `db.js`)
   - Check for connection leaks (connections not being released)

### Logging

The service logs important events to stdout:
- Database connection initialization
- User operations (create, read)
- Error details (for debugging)
- AWS Secrets Manager access

For production, consider integrating with a centralized logging solution (e.g., CloudWatch, ELK stack).

### Database Connection Issues

**Symptoms:**
- Service fails to start
- "Connection refused" errors
- Timeout errors

**Solutions:**
1. Verify database is running and accessible
2. Check network connectivity (security groups, VPC configuration)
3. Verify SSL certificate is correct and up-to-date
4. Check AWS Secrets Manager secret format
5. Verify database credentials are correct

---

## Architecture Decisions

### Why Raw SQL Instead of ORM?

The service uses raw SQL queries with `pg` instead of an ORM (Prisma code is commented out):

- **Performance:** Direct SQL control for optimized queries
- **Simplicity:** No ORM overhead for straightforward CRUD operations
- **Flexibility:** Easy to write complex queries and transactions
- **Transparency:** Clear understanding of database operations

### Why Soft Deletes?

- **Data Preservation:** Maintains audit trail and historical data
- **Recovery:** Ability to restore accidentally deleted accounts
- **Analytics:** Historical user data for business intelligence
- **Compliance:** May be required for regulatory compliance

### Why AWS Secrets Manager?

- **Security:** Credentials never stored in code or environment variables
- **Rotation:** Supports automatic credential rotation
- **Centralized:** Single source of truth for database credentials
- **Audit:** AWS CloudTrail logs all secret access

---

## Future Enhancements

Potential improvements for the service:

1. **Health Check Endpoint:** Add `/health` endpoint for container orchestration
2. **Metrics:** Add Prometheus metrics for monitoring
3. **Caching:** Implement Redis caching for frequently accessed users
4. **Pagination:** Add pagination for user listing endpoints
5. **Search:** Add user search functionality
6. **Update Endpoint:** Add user profile update endpoint
7. **Audit Logging:** Enhanced logging for compliance and debugging

---

## Related Services

- **Login-Service:** Orchestrates authentication and calls User-Service for user validation
- **Other Services:** May query User-Service for user profile information

---
