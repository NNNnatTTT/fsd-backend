# sendReminder Lambda

Invoked by an orchestrator (Step Functions). Sends SMS/WhatsApp via Twilio and returns `{ ok: true|false, ... }`. Optionally writes audit rows to DynamoDB.

## Deploy
sam build && sam deploy --guided

## Invoke sample
sam local invoke SendReminderFunction -e events/sample.json

### Notification Service API

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