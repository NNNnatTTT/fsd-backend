### Proxy Service API

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
