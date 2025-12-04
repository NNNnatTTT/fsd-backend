### Reminder Service API

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
