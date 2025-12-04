# Plant Doctor Service 🌿

A Flask-based microservice that provides plant disease diagnosis using a TensorFlow model hosted on AWS SageMaker. The service accepts plant leaf images and returns predictions for various disease conditions.

## Overview

The Plant Doctor Service is a REST API that leverages AWS SageMaker to perform real-time inference on plant images. It classifies plant leaves into one of seven categories: healthy, complex, or one of five disease types (frog_eye_leaf_spot, multiple_diseases, powdery_mildew, rust, or scab).

## Routes

### `GET /`
**Health check endpoint**

Returns a simple status message to verify the service is running.

**Response:**
```json
{
  "message": "🌿 Plant Doctor API is running!"
}
```

### `POST /predict` or `POST /plant_buddy/predict`
**Main prediction endpoint**

Accepts a plant leaf image and returns disease classification predictions.

**Request:**
- **Method:** `POST`
- **Content-Type:** `multipart/form-data`
- **Body:** Form data with a file field named `file` containing the image

**Example using curl:**
```bash
curl -X POST http://localhost:8080/predict \
  -F "file=@path/to/plant_image.jpg"
```

**Example using Python:**
```python
import requests

with open('plant_image.jpg', 'rb') as f:
    response = requests.post(
        'http://localhost:8080/predict',
        files={'file': f}
    )
    print(response.json())
```

**Response (Success):**
```json
{
  "predicted_class": "healthy",
  "confidence": 95.23
}
```

**Response (Error - No file):**
```json
{
  "error": "No file uploaded"
}
```
Status: `400 Bad Request`

**Response (Error - SageMaker failure):**
```json
{
  "error": "Error message from SageMaker"
}
```
Status: `500 Internal Server Error`

**Supported Image Formats:**
- JPEG/JPG
- PNG
- Any format supported by PIL/Pillow

**Image Processing:**
- Images are automatically resized to 180x180 pixels
- RGB color mode is used
- Images are normalized (divided by 255) as part of the model preprocessing

## SageMaker Integration

The service calls an AWS SageMaker endpoint for inference. The integration works as follows:

1. **Image Preprocessing:** The uploaded image is loaded, resized to 180x180 pixels, and converted to a numpy array
2. **Request Formatting:** The image array is wrapped in a JSON payload with the structure:
   ```json
   {
     "instances": [[[pixel_values...]]]
   }
   ```
3. **SageMaker Invocation:** The service uses the `boto3` SageMaker Runtime client to invoke the endpoint:
   ```python
   runtime.invoke_endpoint(
       EndpointName=ENDPOINT_NAME,
       ContentType="application/json",
       Body=payload
   )
   ```
4. **Response Processing:** The SageMaker response contains predictions (probability scores for each class). The service:
   - Extracts the prediction array
   - Finds the class with the highest probability
   - Maps the index to the corresponding label
   - Returns the predicted class name and confidence percentage

**Model Classes:**
The model predicts one of seven classes:
- `complex` - Multiple or complex disease patterns
- `frog_eye_leaf_spot` - Frog eye leaf spot disease
- `healthy` - Healthy plant leaf
- `multiple_diseases` - Multiple diseases present
- `powdery_mildew` - Powdery mildew infection
- `rust` - Rust disease
- `scab` - Scab disease

## Environment Variables

The service requires the following environment variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `AWS_REGION` | AWS region where SageMaker endpoint is hosted | `ap-southeast-1` |
| `SAGEMAKER_ENDPOINT` | Name of the SageMaker endpoint | `plant-doctor-endpoint` |

These can be set via:
- A `.env` file (for local development)
- Environment variables in your deployment platform (ECS, EKS, etc.)
- AWS Systems Manager Parameter Store
- AWS Secrets Manager

## Local Development

1. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Create a `.env` file:**
   ```env
   AWS_REGION=ap-southeast-1
   SAGEMAKER_ENDPOINT=plant-doctor-endpoint
   ```

3. **Run the Flask app:**
   ```bash
   python app.py
   ```

   The service will start on `http://0.0.0.0:8080`

4. **Test the endpoint:**
   ```bash
   curl -X POST http://localhost:8080/predict \
     -F "file=@test_image.jpg"
   ```

## Model Training & Retraining

### Initial Training Setup

The model training code is included in this repository:
- `train.py` - Training script that runs inside SageMaker containers
- `inference.py` - Inference code for loading and serving the model
- `sagemaker_retrain.py` - Script to trigger SageMaker training and deployment jobs

### Retraining History

**GitLab CI/CD Attempt (Initial Approach)**

Initially, we attempted to set up automated retraining using GitLab CI/CD. The configuration was added to `.gitlab-ci.yml` with a `retrain_model` job that would:

1. Trigger on pushes to the `main` branch
2. Run `sagemaker_retrain.py` to start a SageMaker training job
3. Deploy the newly trained model to the existing endpoint

However, this approach did not work out due to several challenges:
- **Complexity of CI/CD Integration:** Integrating SageMaker training jobs with GitLab runners proved difficult, especially with the long-running nature of training jobs
- **Resource Management:** Managing AWS credentials, IAM roles, and resource cleanup within GitLab CI/CD pipelines was cumbersome
- **Cost Considerations:** Automatic retraining on every push could lead to unexpected costs
- **Manual Control:** We needed more control over when retraining should occur rather than on every code push

The retraining job in `.gitlab-ci.yml` was set to `when: manual` to prevent automatic execution, but the overall approach was eventually abandoned in favor of more controlled retraining workflows.

**Current Approach**

Retraining is now handled through:
- Manual execution of `sagemaker_retrain.py` when needed
- GitHub Actions workflows (see `RETRAINING.md` for details)
- Optional S3-triggered retraining when new training data is uploaded

## Docker Deployment

A `Dockerfile` is included for containerized deployment. Build and run:

```bash
docker build -t plant-doctor-service .
docker run -p 8080:8080 \
  -e AWS_REGION=ap-southeast-1 \
  -e SAGEMAKER_ENDPOINT=plant-doctor-endpoint \
  plant-doctor-service
```

## Dependencies

- **flask** - Web framework for the REST API
- **boto3** - AWS SDK for Python (SageMaker Runtime client)
- **numpy** - Numerical operations for image processing
- **pillow** - Image processing and manipulation
- **python-dotenv** - Environment variable management

## Architecture

```
Client Request
    ↓
Flask App (app.py)
    ↓
Image Preprocessing (resize, normalize)
    ↓
AWS SageMaker Endpoint (inference.py)
    ↓
Model Prediction
    ↓
Response (predicted_class, confidence)
```

## Error Handling

The service includes basic error handling:
- Validates that a file is uploaded before processing
- Catches and returns SageMaker invocation errors
- Returns appropriate HTTP status codes (400 for client errors, 500 for server errors)

## Future Improvements

- Add request validation and image format checking
- Implement request logging and monitoring
- Add support for batch predictions
- Include model version information in responses
- Add health checks for SageMaker endpoint availability
- Implement caching for frequently requested images
- Add rate limiting and authentication

