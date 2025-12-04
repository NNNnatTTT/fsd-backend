### User Service API

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