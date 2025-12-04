### Scheduler Service API

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
