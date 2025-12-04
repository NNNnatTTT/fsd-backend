import os
import json
import uuid
from datetime import timedelta

import boto3
from botocore.exceptions import ClientError
from flask import Flask, request, jsonify, redirect, abort
from werkzeug.utils import secure_filename

# Read config once from Secrets Manager
SECRET_NAME = os.environ.get("SECRET_NAME", "fsd-s3-secret")
SM_REGION = os.environ.get("AWS_REGION") or os.environ.get("AWS_DEFAULT_REGION")  # optional

def read_secret(name: str) -> dict:
    session = boto3.session.Session(region_name=SM_REGION) if SM_REGION else boto3.session.Session()
    sm = session.client("secretsmanager")
    resp = sm.get_secret_value(SecretId=name)
    raw = resp.get("SecretString")
    if not raw:
        raw = (resp.get("SecretBinary") or b"").decode("utf-8")
    return json.loads(raw)

cfg = read_secret(SECRET_NAME)

S3_BUCKET = cfg.get("S3_BUCKET") or ""
if not S3_BUCKET:
    raise RuntimeError("Secret must include S3_BUCKET")

S3_REGION = cfg.get("S3_REGION") or SM_REGION or "ap-southeast-1"
ALLOWED_MIME_PREFIXES = tuple(cfg.get("ALLOWED_MIME_PREFIXES", ["image/"]))
MAX_CONTENT_LENGTH_MB = int(cfg.get("MAX_CONTENT_LENGTH_MB", 10))

# IDEALLY role credentials. keys are present in the secret for local dev boto 3
s3_kwargs = {"region_name": S3_REGION}
if cfg.get("AWS_ACCESS_KEY_ID") and cfg.get("AWS_SECRET_ACCESS_KEY"):
    s3_kwargs["aws_access_key_id"] = cfg["AWS_ACCESS_KEY_ID"]
    s3_kwargs["aws_secret_access_key"] = cfg["AWS_SECRET_ACCESS_KEY"]

s3 = boto3.client("s3", **s3_kwargs)

# Flask app for photo service
app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = MAX_CONTENT_LENGTH_MB * 1024 * 1024

def _key_for(id_: str) -> str:
    return f"photos/{id_}"

def _is_allowed_mime(mimetype: str) -> bool:
    return any(mimetype.startswith(p) for p in ALLOWED_MIME_PREFIXES)

@app.get("/")
def health():
    return {"ok": True, "bucket": S3_BUCKET, "region": S3_REGION}

@app.post("/upload")
def upload():
    if "file" not in request.files:
        return jsonify(error="missing file"), 400
    file = request.files["file"]
    if not file.filename:
        return jsonify(error="empty filename"), 400

    mimetype = file.mimetype or "application/octet-stream"
    if not _is_allowed_mime(mimetype):
        return jsonify(error=f"unsupported content-type: {mimetype}"), 415

    id_ = str(uuid.uuid4())
    key = _key_for(id_)
    original_name = secure_filename(file.filename)

    try:
        s3.upload_fileobj(
            Fileobj=file,
            Bucket=S3_BUCKET,
            Key=key,
            ExtraArgs={
                "ContentType": mimetype,
                "Metadata": {"original-filename": original_name},
                "ACL": "private",
            },
        )
    except ClientError as e:
        app.logger.exception("S3 upload failed")
        return jsonify(error="upload failed", details=str(e)), 502

    expires = int(timedelta(minutes=15).total_seconds())
    try:
        url = s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": S3_BUCKET, "Key": key},
            ExpiresIn=expires,
        )
    except ClientError as e:
        app.logger.exception("presign failed")
        return jsonify(error="presign failed", details=str(e)), 502

    return jsonify(id=id_, url=url, expires_in=expires), 201

@app.get("/photo/<id_>")
def get_photo(id_: str):
    key = _key_for(id_)
    try:
        s3.head_object(Bucket=S3_BUCKET, Key=key)
    except ClientError as e:
        code = e.response.get("ResponseMetadata", {}).get("HTTPStatusCode", 404)
        if code == 404:
            abort(404, description="not found")
        app.logger.exception("head_object failed")
        abort(502, description="storage error")

    expires = int(timedelta(minutes=10).total_seconds())
    try:
        url = s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": S3_BUCKET, "Key": key},
            ExpiresIn=expires,
        )
    except ClientError:
        app.logger.exception("presign failed")
        abort(502, description="presign error")

    return redirect(url, code=302)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=True)
