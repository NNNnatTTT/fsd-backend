### Photo Service API

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
