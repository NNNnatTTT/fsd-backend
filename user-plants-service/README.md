### User Plants Service API

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
