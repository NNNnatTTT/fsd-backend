# FSD Backend - Microservices API Documentation

This repository contains a microservices-based backend system for a plant care management application. The system is composed of multiple independent services, each handling specific domain functionality.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Services](#services)
  - [1. Login Service](#1-login-service)
  - [2. User Service](#2-user-service)
  - [3. User Plants Service](#4-user-plants-service)
  - [4. Reminder Service](#5-reminder-service)
  - [5. Proxy Service](#6-proxy-service)
  - [6. Photo Service](#7-photo-service)
  - [7. Plant Doctor Service](#8-plant-doctor-service)
  - [8. Plant Catalog Service](#9-plant-catalog-service)
  - [9. Notification Service](#10-notification-service)
  - [10. Scheduler Service](#11-scheduler-service)
- [Authentication](#authentication)
- [Error Handling](#error-handling)
- [Database Schemas](#database-schemas)
- [Deployment pipeline](#Deployment-pipeline)

---

## Architecture Overview

The backend follows a microservices architecture pattern with the following characteristics:
- **Service Independence**: Each service operates independently with its own database/state
- **RESTful APIs**: Most services expose RESTful HTTP endpoints
- **JWT Authentication**: Token-based authentication for protected endpoints
- **Internal Service Communication**: Services communicate via HTTP requests
- **AWS Integration**: Some services integrate with AWS services (S3, Lambda, SageMaker)

---

## Services

### 1. Login Service

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

---

### 2. User Service

**Base URL**: `http://localhost:{PORT}` (configured via `PORT` environment variable)  
**Technology**: Node.js, Express, PostgreSQL  
**Database**: PostgreSQL (schema: `users`)

#### Routes

##### `POST /users` (Internal Only)
Create a new user. **Requires internal authentication** (verifyInternal middleware).

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
- `username`: Minimum 3 characters (trimmed)
- `phoneNumber`: Format `^\+?\d{8,15}$`
- `passwordHash`: Minimum 20 characters (bcrypt hash)
- `role`: Enum `["gardener", "admin"]`

**Response (201 Created):**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "username": "username123",
  "phone_number": "+6512345678",
  "role": "gardener",
  "created_at": "2024-01-01T00:00:00.000Z"
}
```

**Error Responses:**
- `409 Conflict`: User already exists (email, username, or phoneNumber conflict)
- `400 Bad Request`: Validation error
- `500 Internal Server Error`: Database error

##### `GET /users?email={email}` (Internal Only)
Get user by email. **Requires internal authentication**.

**Query Parameters:**
- `email` (required): User email address

**Response (200 OK):**
```json
{
  "id": "uuid",
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
- `400 Bad Request`: Email query required
- `404 Not Found`: User not found
- `500 Internal Server Error`: Database error

##### `GET /users/:id` (Public)
Get user by ID. Publicly accessible (no authentication required).

**Path Parameters:**
- `id` (required): User UUID

**Response (200 OK):**
```json
{
  "id": "uuid",
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
- `404 Not Found`: User not found
- `500 Internal Server Error`: Database error

**Note**: Only returns active users (where `deleted_at IS NULL`).

---

### 3. User Plants Service

**Base URL**: `http://localhost:3003` (default)  
**Technology**: Node.js, Express, PostgreSQL  
**Database**: PostgreSQL (schema: `user_plants`)  
**Authentication**: Required for all endpoints (JWT Bearer token)

#### Routes

##### `POST /userPlant/v1/userPlant/create`
Create a new user plant entry. Supports file upload for plant image.

**Authentication**: Required (JWT Bearer token)

**Request Format**: `multipart/form-data`

**Form Fields:**
- `file` (optional): Image file (handled by multer)
- `name` (required): String, minimum 1 character (trimmed)
- `notes` (required): String
- `s3ID` (optional): String (S3 object ID if image already uploaded)

**Response (201 Created):**
```json
{
  "plantID": "uuid"
}
```

**Error Responses:**
- `400 Bad Request`: Validation error
- `403 Forbidden`: Missing userID or invalid token
- `500 Internal Server Error`: Database error

##### `GET /userPlant/v1/userPlant/:id`
Get a specific user plant by ID.

**Authentication**: Required (JWT Bearer token)

**Path Parameters:**
- `id` (required): UUID of the user plant

**Response (200 OK):**
```json
{
  "plant": {
    "id": "uuid",
    "user_id": "uuid",
    "name": "My Plant",
    "notes": "Plant notes",
    "s3_id": "s3-object-id",
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-01T00:00:00.000Z"
  }
}
```

**Error Responses:**
- `400 Bad Request`: Invalid ID format
- `403 Forbidden`: Missing userID or invalid token
- `500 Internal Server Error`: Database error

##### `GET /userPlant/v1/userPlants`
List all user plants for the authenticated user.

**Authentication**: Required (JWT Bearer token)

**Response (200 OK):**
```json
{
  "plants": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "name": "My Plant",
      "notes": "Plant notes",
      "s3_id": "s3-object-id",
      "created_at": "2024-01-01T00:00:00.000Z",
      "updated_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

**Error Responses:**
- `403 Forbidden`: Missing userID or invalid token
- `500 Internal Server Error`: Database error

##### `GET /userPlant/search`
Search user plants with pagination.

**Authentication**: Required (JWT Bearer token)

**Query Parameters:**
- `searchValue` (required): String, minimum 1 character (trimmed)
- `limit` (optional): Integer, 1-40, default 20
- `offset` (optional): Integer, minimum 0, default 0

**Response (200 OK):**
```json
{
  "plants": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "name": "My Plant",
      "notes": "Plant notes",
      "s3_id": "s3-object-id",
      "created_at": "2024-01-01T00:00:00.000Z",
      "updated_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

**Error Responses:**
- `400 Bad Request`: No search value entered
- `403 Forbidden`: Missing userID or invalid token
- `500 Internal Server Error`: Database error

##### `PUT /userPlant/v1/userPlant/:id`
Update a user plant.

**Authentication**: Required (JWT Bearer token)

**Path Parameters:**
- `id` (required): UUID of the user plant

**Request Body:**
```json
{
  "s3ID": "s3-object-id",
  "name": "Updated Plant Name",
  "notes": "Updated notes"
}
```

**Validation:**
- All fields are optional, but at least one must be provided
- `s3ID`: String (optional)
- `name`: String, minimum 1 character (trimmed, optional)
- `notes`: String (optional)

**Response (201 Created):**
```json
{
  "plant": {
    "id": "uuid",
    "user_id": "uuid",
    "name": "Updated Plant Name",
    "notes": "Updated notes",
    "s3_id": "s3-object-id",
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-01T00:00:00.000Z"
  }
}
```

**Error Responses:**
- `400 Bad Request`: Validation error or no fields to update
- `403 Forbidden`: Missing userID or invalid token
- `500 Internal Server Error`: Database error

##### `DELETE /userPlant/v1/userPlant/:id`
Delete a user plant.

**Authentication**: Required (JWT Bearer token)

**Path Parameters:**
- `id` (required): UUID of the user plant

**Response (201 Created):**
```json
{
  "plantID": "uuid"
}
```

**Error Responses:**
- `400 Bad Request`: Invalid ID format
- `403 Forbidden`: Missing userID or invalid token
- `500 Internal Server Error`: Database error

**Additional Endpoints:**
- `GET /`: API status - returns "API is running"
- `GET /health`: Health check - returns `{"ok": true}`
- `GET /healthz`: Health check - returns "ok"
- `GET /readyz`: Readiness check - verifies database connection
- `GET /allz`: Debug endpoint - returns all user plants from database

---

### 4. Reminder Service

**Base URL**: `http://localhost:3000` (default)  
**Technology**: Node.js, Express, PostgreSQL  
**Database**: PostgreSQL (schema: `reminders`)  
**Authentication**: Required for most endpoints (JWT Bearer token), except `/v1/reminders/due`

#### Routes

##### `POST /reminder/v1/reminder/create`
Create a new reminder.

**Authentication**: Required (JWT Bearer token)

**Request Body:**
```json
{
  "name": "Water Plant",
  "notes": "Use room temperature water",
  "isActive": true,
  "dueAt": "2024-01-01T19:30:00+08:00",
  "dueDay": [1, 2, 3, 4, 5, 6, 7],
  "isProxy": false,
  "proxy": "+6512345678"
}
```

**Validation:**
- `name` (optional): String, default "Reminder" (trimmed)
- `notes` (required): String
- `isActive` (required): Boolean
- `dueAt` (required): Date (ISO 8601 format, coerced)
- `dueDay` (required): Array of numbers, 1-7 (days of week), default [1,2,3,4,5,6,7]
- `isProxy` (required): Boolean
- `proxy` (required): String, phone number format `^\+?[1-9]\d{9,14}$` (spaces/dashes removed)

**Response (201 Created):**
```json
{
  "reminderID": "uuid"
}
```

**Error Responses:**
- `400 Bad Request`: Validation error
- `403 Forbidden`: Missing userID or invalid token
- `500 Internal Server Error`: Database error

##### `GET /reminder/v1/reminder/:id`
Get a specific reminder by ID.

**Authentication**: Required (JWT Bearer token)

**Path Parameters:**
- `id` (required): UUID of the reminder

**Response (201 Created):**
```json
{
  "client": {
    "id": "uuid",
    "user_id": "uuid",
    "name": "Water Plant",
    "notes": "Use room temperature water",
    "is_active": true,
    "due_at": "2024-01-01T19:30:00.000Z",
    "due_day": [1, 2, 3, 4, 5, 6, 7],
    "is_proxy": false,
    "proxy": "+6512345678",
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-01T00:00:00.000Z"
  }
}
```

**Error Responses:**
- `400 Bad Request`: Invalid ID format
- `403 Forbidden`: Missing userID or invalid token
- `404 Not Found`: Reminder not found
- `500 Internal Server Error`: Database error

##### `GET /reminder/v1/reminders`
List all reminders for the authenticated user.

**Authentication**: Required (JWT Bearer token)

**Response (201 Created):**
```json
{
  "clients": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "name": "Water Plant",
      "notes": "Use room temperature water",
      "is_active": true,
      "due_at": "2024-01-01T19:30:00.000Z",
      "due_day": [1, 2, 3, 4, 5, 6, 7],
      "is_proxy": false,
      "proxy": "+6512345678",
      "created_at": "2024-01-01T00:00:00.000Z",
      "updated_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

**Error Responses:**
- `403 Forbidden`: Missing userID or invalid token
- `404 Not Found`: No reminders found
- `500 Internal Server Error`: Database error

##### `GET /reminder/v1/reminders/due` (Scheduler Endpoint)
Get reminders that are due soon. **No authentication required** (intended for scheduler-service).

**Query Parameters:**
- `windowSec` (optional): Number, default 60 seconds. Time window in seconds to look ahead for due reminders.

**Response (200 OK):**
```json
{
  "reminders": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "name": "Water Plant",
      "notes": "Use room temperature water",
      "due_at": "2024-01-01T19:30:00.000Z",
      "is_proxy": false,
      "proxy": "+6512345678"
    }
  ]
}
```

**Error Responses:**
- `500 Internal Server Error`: Database error

##### `PUT /reminder/v1/reminder/:id`
Update a reminder.

**Authentication**: Required (JWT Bearer token)

**Path Parameters:**
- `id` (required): UUID of the reminder

**Request Body:**
```json
{
  "name": "Updated Reminder Name",
  "notes": "Updated notes",
  "isActive": false,
  "dueAt": "2024-01-02T19:30:00+08:00",
  "dueDay": [1, 3, 5],
  "isProxy": true,
  "proxy": "+6598765432"
}
```

**Validation:**
- All fields are optional, but at least one must be provided
- Same validation rules as create endpoint

**Response (201 Created):**
```json
{
  "client": {
    "id": "uuid",
    "user_id": "uuid",
    "name": "Updated Reminder Name",
    "notes": "Updated notes",
    "is_active": false,
    "due_at": "2024-01-02T19:30:00.000Z",
    "due_day": [1, 3, 5],
    "is_proxy": true,
    "proxy": "+6598765432",
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-01T00:00:00.000Z"
  }
}
```

**Error Responses:**
- `400 Bad Request`: Validation error or no fields to update
- `403 Forbidden`: Missing userID or invalid token
- `500 Internal Server Error`: Database error

##### `DELETE /reminder/v1/reminder/:id`
Delete a reminder.

**Authentication**: Required (JWT Bearer token)

**Path Parameters:**
- `id` (required): UUID of the reminder

**Response (201 Created):**
```json
{
  "reminderIDRes": "uuid"
}
```

**Error Responses:**
- `400 Bad Request`: Invalid ID format
- `403 Forbidden`: Missing userID or invalid token
- `500 Internal Server Error`: Database error

**Additional Endpoints:**
- `GET /`: API status - returns "API is running"
- `GET /health`: Health check - returns `{"ok": true}`
- `GET /healthz`: Health check - returns "ok"
- `GET /readyz`: Readiness check - verifies database connection
- `GET /allz`: Debug endpoint - returns all reminders from database

---

### 5. Proxy Service

**Base URL**: `http://localhost:3004` (default)  
**Technology**: Node.js, Express, PostgreSQL  
**Database**: PostgreSQL (schema: `user_plants`)  
**Authentication**: Required for all endpoints (JWT Bearer token)

#### Routes

##### `POST /proxy/v1/proxy/create`
Create a new proxy entry.

**Authentication**: Required (JWT Bearer token)

**Request Body:**
```json
{
  "name": "Proxy Name",
  "startDate": "2024-01-01T00:00:00.000Z",
  "endDate": "2024-01-31T23:59:59.000Z",
  "phoneNumber": "+6512345678"
}
```

**Validation:**
- `name` (required): String, minimum 1 character (trimmed)
- `startDate` (required): Date (coerced)
- `endDate` (required): Date (coerced)
- `phoneNumber` (optional): String, phone number format

**Response (201 Created):**
```json
{
  "proxyID": "uuid"
}
```

**Error Responses:**
- `400 Bad Request`: Validation error
- `403 Forbidden`: Missing userID or invalid token
- `500 Internal Server Error`: Database error

##### `GET /proxy/v1/proxy/:id`
Get a specific proxy by ID.

**Authentication**: Required (JWT Bearer token)

**Path Parameters:**
- `id` (required): UUID of the proxy

**Response (201 Created):**
```json
{
  "proxy": {
    "id": "uuid",
    "user_id": "uuid",
    "name": "Proxy Name",
    "start_date": "2024-01-01T00:00:00.000Z",
    "end_date": "2024-01-31T23:59:59.000Z",
    "phone_number": "+6512345678",
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-01T00:00:00.000Z"
  }
}
```

**Error Responses:**
- `400 Bad Request`: Invalid ID format
- `403 Forbidden`: Missing userID or invalid token
- `500 Internal Server Error`: Database error

##### `GET /proxy/v1/proxys`
List all proxies for the authenticated user.

**Authentication**: Required (JWT Bearer token)

**Response (201 Created):**
```json
{
  "proxys": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "name": "Proxy Name",
      "start_date": "2024-01-01T00:00:00.000Z",
      "end_date": "2024-01-31T23:59:59.000Z",
      "phone_number": "+6512345678",
      "created_at": "2024-01-01T00:00:00.000Z",
      "updated_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

**Error Responses:**
- `403 Forbidden`: Missing userID or invalid token
- `500 Internal Server Error`: Database error

##### `GET /proxy/search`
Search proxies with pagination.

**Authentication**: Required (JWT Bearer token)

**Query Parameters:**
- `searchValue` (required): String, minimum 1 character (trimmed)
- `limit` (optional): Integer, 1-40, default 20
- `offset` (optional): Integer, minimum 0, default 0

**Response (200 OK):**
```json
{
  "proxys": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "name": "Proxy Name",
      "start_date": "2024-01-01T00:00:00.000Z",
      "end_date": "2024-01-31T23:59:59.000Z",
      "phone_number": "+6512345678",
      "created_at": "2024-01-01T00:00:00.000Z",
      "updated_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

**Error Responses:**
- `400 Bad Request`: No search value entered
- `403 Forbidden`: Missing userID or invalid token
- `500 Internal Server Error`: Database error

##### `PUT /proxy/v1/proxy/:id`
Update a proxy.

**Authentication**: Required (JWT Bearer token)

**Path Parameters:**
- `id` (required): UUID of the proxy

**Request Body:**
```json
{
  "name": "Updated Proxy Name",
  "startDate": "2024-02-01T00:00:00.000Z",
  "endDate": "2024-02-28T23:59:59.000Z",
  "phoneNumber": "+6598765432"
}
```

**Validation:**
- All fields are optional, but at least one must be provided
- Same validation rules as create endpoint

**Response (201 Created):**
```json
{
  "proxy": {
    "id": "uuid",
    "user_id": "uuid",
    "name": "Updated Proxy Name",
    "start_date": "2024-02-01T00:00:00.000Z",
    "end_date": "2024-02-28T23:59:59.000Z",
    "phone_number": "+6598765432",
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-01T00:00:00.000Z"
  }
}
```

**Error Responses:**
- `400 Bad Request`: Validation error or no fields to update
- `403 Forbidden`: Missing userID or invalid token
- `500 Internal Server Error`: Database error

##### `DELETE /proxy/v1/proxy/:id`
Delete a proxy.

**Authentication**: Required (JWT Bearer token)

**Path Parameters:**
- `id` (required): UUID of the proxy

**Response (201 Created):**
```json
{
  "proxyID": "uuid"
}
```

**Error Responses:**
- `400 Bad Request`: Invalid ID format
- `403 Forbidden`: Missing userID or invalid token
- `500 Internal Server Error`: Database error

**Additional Endpoints:**
- `GET /`: API status - returns "API is running"
- `GET /health`: Health check - returns `{"ok": true}`
- `GET /healthz`: Health check - returns "ok"
- `GET /readyz`: Readiness check - verifies database connection
- `GET /allz`: Debug endpoint - returns all user plants from database

---

### 6. Photo Service

**Base URL**: `http://localhost:5000` (default)  
**Technology**: Python, Flask  
**Storage**: AWS S3  
**Configuration**: Reads from AWS Secrets Manager

#### Routes

##### `GET /`
Health check endpoint.

**Response (200 OK):**
```json
{
  "ok": true,
  "bucket": "s3-bucket-name",
  "region": "ap-southeast-1"
}
```

##### `POST /upload`
Upload a photo to S3 and receive a presigned URL.

**Request Format**: `multipart/form-data`

**Form Fields:**
- `file` (required): Image file

**Validation:**
- File must have a filename
- MIME type must match allowed prefixes (default: `image/*`)
- Maximum file size: 10MB (configurable via `MAX_CONTENT_LENGTH_MB`)

**Response (201 Created):**
```json
{
  "id": "uuid",
  "url": "https://s3.amazonaws.com/bucket/photos/uuid?X-Amz-Algorithm=...",
  "expires_in": 900
}
```

**Response Fields:**
- `id`: UUID of the uploaded file (S3 key: `photos/{id}`)
- `url`: Presigned S3 URL (valid for 15 minutes)
- `expires_in`: Expiration time in seconds (900 = 15 minutes)

**Error Responses:**
- `400 Bad Request`: Missing file or empty filename
- `415 Unsupported Media Type`: Unsupported content-type
- `502 Bad Gateway`: S3 upload or presign failed

##### `GET /photo/<id>`
Get a presigned URL for a photo (redirects to S3).

**Path Parameters:**
- `id` (required): UUID of the photo

**Response (302 Found):**
Redirects to presigned S3 URL (valid for 10 minutes)

**Error Responses:**
- `404 Not Found`: Photo not found in S3
- `502 Bad Gateway`: Storage error or presign failed

**Configuration:**
- Reads configuration from AWS Secrets Manager (default secret name: `fsd-s3-secret`)
- Required secret fields:
  - `S3_BUCKET`: S3 bucket name
  - `S3_REGION`: AWS region (default: `ap-southeast-1`)
  - `ALLOWED_MIME_PREFIXES`: Array of allowed MIME type prefixes (default: `["image/"]`)
  - `MAX_CONTENT_LENGTH_MB`: Maximum file size in MB (default: 10)
  - `AWS_ACCESS_KEY_ID`: Optional (for local development)
  - `AWS_SECRET_ACCESS_KEY`: Optional (for local development)

---

### 7. Plant Doctor Service

**Base URL**: `http://localhost:8080` (default)  
**Technology**: Python, Flask  
**ML Model**: AWS SageMaker endpoint

#### Routes

##### `GET /`
Health check endpoint.

**Response (200 OK):**
```json
{
  "message": "🌿 Plant Doctor API is running!"
}
```

##### `POST /predict` or `POST /plant_buddy/predict`
Predict plant disease from an uploaded image.

**Request Format**: `multipart/form-data`

**Form Fields:**
- `file` (required): Image file

**Processing:**
- Image is resized to 180x180 pixels
- Converted to numpy array and normalized
- Sent to SageMaker endpoint for inference

**Response (200 OK):**
```json
{
  "predicted_class": "healthy",
  "confidence": 95.23
}
```

**Possible Classes:**
- `complex`
- `frog_eye_leaf_spot`
- `healthy`
- `multiple_diseases`
- `powdery_mildew`
- `rust`
- `scab`

**Response Fields:**
- `predicted_class`: String, one of the classes above
- `confidence`: Float, confidence percentage (0-100, rounded to 2 decimal places)

**Error Responses:**
- `400 Bad Request`: No file uploaded
- `500 Internal Server Error`: SageMaker invocation error

**Configuration:**
- `AWS_REGION`: AWS region for SageMaker
- `SAGEMAKER_ENDPOINT`: Name of the SageMaker endpoint

---

### 8. Plant Catalog Service

**Base URL**: API Gateway endpoint (AWS Lambda)  
**Technology**: Node.js, AWS Lambda  
**External API**: Perenual API (https://perenual.com/api)

#### Routes

All routes are proxied to the Perenual API with the API key automatically added.

##### `GET /plants/v2/species-list`
Get a list of plant species.

**Query Parameters:**
- All Perenual API query parameters are supported (e.g., `q`, `page`, `filters`, etc.)
- API key is automatically added

**Response (200 OK):**
Returns the Perenual API response (JSON format)

**Error Responses:**
- `500 Internal Server Error`: Internal error

##### `GET /plants/v2/species/details/{id}`
Get detailed information about a specific plant species.

**Path Parameters:**
- `id` (required): Plant species ID

**Response (200 OK):**
Returns the Perenual API response (JSON format)

**Error Responses:**
- `400 Bad Request`: Missing id
- `500 Internal Server Error`: Internal error

##### `GET /plants/pest-disease-list`
Get a list of pests and diseases.

**Query Parameters:**
- All Perenual API query parameters are supported
- API key is automatically added

**Response (200 OK):**
Returns the Perenual API response (JSON format)

**Error Responses:**
- `500 Internal Server Error`: Internal error

##### `GET /plants/species-care-guide-list`
Get care guide information for plant species.

**Query Parameters:**
- All Perenual API query parameters are supported
- API key is automatically added

**Response (200 OK):**
Returns the Perenual API response (JSON format)

**Error Responses:**
- `500 Internal Server Error`: Internal error

##### `GET /plants/hardiness-map`
Get hardiness map information (returns HTML).

**Query Parameters:**
- All Perenual API query parameters are supported
- API key is automatically added

**Response (200 OK):**
Returns HTML content from Perenual API

**Error Responses:**
- `500 Internal Server Error`: Internal error

**Configuration:**
- `PERENUAL_BASE`: Base URL for Perenual API (default: `https://perenual.com/api`)
- `PERENUAL_VERSION`: API version (default: `v2`)
- `PERENUAL_API_KEY`: Perenual API key (required)

---

### 9. Notification Service

**Base URL**: AWS Lambda function  
**Technology**: Node.js, AWS Lambda, Twilio  
**Purpose**: Sends SMS/WhatsApp notifications via Twilio

#### Function Handler

The service is invoked as an AWS Lambda function (not a REST API). It expects an event payload with the following structure:

**Event Payload:**
```json
{
  "messageId": "rmdr_123",
  "channel": "sms",
  "to": "+6591234567",
  "plantName": "Chili Padi",
  "action": "water",
  "dueAt": "2025-11-25T19:30:00+08:00",
  "tz": "Asia/Singapore",
  "notes": "Use room-temp water"
}
```

**Required Fields:**
- `messageId`: String, unique message identifier
- `channel`: String, `"sms"` or `"whatsapp"`
- `to`: String, phone number in E.164 format
- `plantName`: String, name of the plant
- `action`: String, action to perform (e.g., "water")
- `dueAt`: String, ISO 8601 datetime string

**Optional Fields:**
- `tz`: String, timezone (default: `"Asia/Singapore"`)
- `notes`: String, additional notes

**Response (Success):**
```json
{
  "ok": true,
  "messageId": "rmdr_123",
  "sid": "SM1234567890abcdef",
  "to": "+6591234567",
  "sentAt": "2024-01-01T00:00:00.000Z"
}
```

**Response (Error):**
```json
{
  "ok": false,
  "messageId": "rmdr_123",
  "error": "Error message"
}
```

**Message Format:**
The service formats messages as:
```
🌿 PlantPal Reminder 🌿
It's time to {action} your {plantName}!
🗓️ {formatted_date_time}
💬 Note: {notes} (if provided)
```

**Configuration:**
- `TWILIO_ACCOUNT_SID`: Twilio account SID
- `TWILIO_AUTH_TOKEN`: Twilio auth token
- `TWILIO_FROM`: Twilio phone number or WhatsApp number

**Phone Number Normalization:**
- WhatsApp numbers are prefixed with `whatsapp:` if not already present
- SMS numbers are used as-is

---

### 10. Scheduler Service

**Base URL**: `http://localhost:4000` (default)  
**Technology**: Node.js, TypeScript, Express  
**Purpose**: Background service that polls for due reminders and triggers notifications

#### Functionality

The scheduler service runs as a background cron job that:
1. Polls the reminder service for reminders due within a configurable time window
2. Resolves target phone numbers (user phone or proxy phone)
3. Sends notifications via AWS Lambda (notification service)
4. Processes reminders in parallel with error handling

#### Routes

##### `GET /`
Health check endpoint.

**Response (200 OK):**
```json
{
  "status": "ok"
}
```

#### Scheduler Configuration

**Polling Interval:**
- Configurable via `POLL_INTERVAL_MS` environment variable
- Default: Calculated from environment
- Cron expression is automatically generated:
  - For intervals < 60 seconds: Uses seconds-based cron (`*/X * * * * *`)
  - For intervals >= 60 seconds: Uses minutes-based cron (`*/X * * * *`)
- Minimum interval: 5 seconds

**Due Window:**
- Configurable via `DUE_WINDOW_SEC` environment variable
- Default: From environment configuration
- Defines how far ahead to look for due reminders

**Configuration:**
- `POLL_INTERVAL_MS`: Polling interval in milliseconds
- `DUE_WINDOW_SEC`: Time window in seconds to look ahead for due reminders
- `REMINDER_SERVICE_BASEURL`: Base URL of the reminder service
- `USER_SERVICE_BASEURL`: Base URL of the user service
- `AUTH_BEARER`: Bearer token for authenticating with other services
- `AWS_REGION`: AWS region (default: `ap-southeast-1`)
- `NOTIF_FN`: AWS Lambda function name for notifications (default: `sendReminder`)

**Processing Flow:**
1. Service starts and runs initial poll
2. Cron job triggers at configured interval
3. Fetches due reminders from reminder service
4. For each reminder:
   - Resolves phone number (user phone or proxy)
   - Formats phone number to E.164 format
   - Invokes notification Lambda function
5. Logs success/failure for each reminder
6. Continues processing even if individual reminders fail

**Logging:**
- Detailed console logging for:
  - Polling events
  - Reminder processing
  - Phone number resolution
  - Lambda invocations
  - Errors and failures

---

## Authentication

### JWT Token Format

Most services use JWT (JSON Web Token) for authentication. Tokens are obtained from the login service.

**Token Structure:**
```json
{
  "id": "user-uuid",
  "email": "user@example.com",
  "role": "gardener",
  "iat": 1234567890,
  "exp": 1234571490
}
```

**Token Expiration:** 1 hour

### Using Authentication

Include the JWT token in the `Authorization` header:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Internal Service Authentication

Some endpoints (e.g., user-service create/get by email) require internal authentication using the `verifyInternal` middleware. This is typically used for service-to-service communication.

---

## Error Handling

### Standard Error Responses

Most services follow a consistent error response format:

**400 Bad Request:**
```json
{
  "error": "ValidationError",
  "details": "Error message"
}
```

**403 Forbidden:**
```json
{
  "error": "Forbidden",
  "message": "Missing userID"
}
```

**404 Not Found:**
```json
{
  "error": "NotFound",
  "message": "Resource not found"
}
```

**409 Conflict:**
```json
{
  "error": "Conflict",
  "details": "Resource already exists"
}
```

**500 Internal Server Error:**
```json
{
  "error": "InternalServerError",
  "details": "Error message"
}
```

### Service-Specific Error Formats

Some services may return slightly different error formats. Refer to individual service documentation above for specific error response structures.

---

## Database Schemas

### User Service (PostgreSQL)
- **Schema**: `users`
- **Table**: `user_list`
  - `id` (UUID, primary key)
  - `email` (string, unique)
  - `username` (string, unique)
  - `phone_number` (string)
  - `password_hash` (string)
  - `role` (enum: `gardener`, `admin`)
  - `created_at` (timestamp)
  - `deleted_at` (timestamp, nullable, soft delete)

### User Plants Service (PostgreSQL)
- **Schema**: `user_plants`
- **Table**: `user_plant_list`
  - `id` (UUID, primary key)
  - `user_id` (UUID, foreign key)
  - `name` (string)
  - `notes` (string)
  - `s3_id` (string, nullable)
  - `created_at` (timestamp)
  - `updated_at` (timestamp)

### Reminder Service (PostgreSQL)
- **Schema**: `reminders`
- **Table**: `reminder_list`
  - `id` (UUID, primary key)
  - `user_id` (UUID, foreign key)
  - `name` (string)
  - `notes` (string, nullable)
  - `is_active` (boolean)
  - `due_at` (timestamp)
  - `due_day` (integer array, 1-7)
  - `is_proxy` (boolean)
  - `proxy` (string, nullable)
  - `created_at` (timestamp)
  - `updated_at` (timestamp)

### Proxy Service (PostgreSQL)
- **Schema**: `user_plants` (shared with user-plants-service)
- **Table**: Proxy-related tables (exact schema depends on implementation)

---

## Environment Variables

### Common Variables
- `PORT`: Service port number
- `NODE_ENV`: Environment (`development`, `production`)
- `JWT_SECRET`: Secret key for JWT token signing

### Service-Specific Variables

**Login Service:**
- `USER_SERVICE_URL`: URL of user service
- `JWT_SECRET`: JWT signing secret

**User Service:**
- Database connection variables (varies by setup)

**Photo Service:**
- `SECRET_NAME`: AWS Secrets Manager secret name (default: `fsd-s3-secret`)
- `AWS_REGION`: AWS region

**Plant Doctor Service:**
- `AWS_REGION`: AWS region
- `SAGEMAKER_ENDPOINT`: SageMaker endpoint name

**Plant Catalog Service:**
- `PERENUAL_BASE`: Perenual API base URL
- `PERENUAL_VERSION`: API version
- `PERENUAL_API_KEY`: Perenual API key

**Notification Service:**
- `TWILIO_ACCOUNT_SID`: Twilio account SID
- `TWILIO_AUTH_TOKEN`: Twilio auth token
- `TWILIO_FROM`: Twilio phone number

**Scheduler Service:**
- `POLL_INTERVAL_MS`: Polling interval in milliseconds
- `DUE_WINDOW_SEC`: Due window in seconds
- `REMINDER_SERVICE_BASEURL`: Reminder service URL
- `USER_SERVICE_BASEURL`: User service URL
- `AUTH_BEARER`: Bearer token for service authentication
- `AWS_REGION`: AWS region
- `NOTIF_FN`: Lambda function name

---

## Service Dependencies

Pipelines are consolidated from different repos and have been disabled "if:false" for submission.
The yml files are configured to run as if in the specific service, but have been consolidated in 1 workflow folder for easy viewing overall.

```
┌─────────────────┐
│  Login Service  │───► User Service
└─────────────────┘

┌─────────────────┐
│    Scheduler    │───► Reminder Service
│    Composite    │───► User Service
│     service     │───► Notification Service (Lambda)
└─────────────────┘

┌─────────────────┐
│  Photo Service  │───► AWS S3
└─────────────────┘

┌─────────────────┐
│Plant Doctor Svc │───► AWS SageMaker
└─────────────────┘

┌─────────────────┐
│Plant Catalog Svc│───► Perenual API
└─────────────────┘
```

---

## Deployment pipeline

---

## Notes

- All UUIDs are in standard UUID v4 format
- Timestamps are in ISO 8601 format
- Phone numbers should follow E.164 format when possible
- Most services implement soft deletes (using `deleted_at` timestamps)
- Services use PostgreSQL connection pooling for database access
- Error handling includes detailed logging for debugging
- Health check endpoints are available on most services for monitoring

