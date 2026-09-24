import boto3
from botocore.config import Config

from app.config.settings import settings

# One bucket, two key prefixes: attachments live under `uploads/`, deck
# recordings under `decks/`. The keys never collide, so they share a bucket.
BUCKET = settings.AWS_S3_BUCKET

# SigV4 with the regional endpoint: presigned URLs must be signed for the
# bucket's own region, or S3 answers them with a redirect/403.
client = boto3.client(
    "s3",
    region_name=settings.AWS_REGION,
    aws_access_key_id=settings.AWS_ACCESS_KEY_ID or None,
    aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY or None,
    config=Config(signature_version="s3v4", s3={"addressing_style": "virtual"}),
)


def ensure_bucket():
    """Fail fast at startup if the bucket is missing or the keys can't reach it.
    The bucket is provisioned in AWS, not created here."""
    client.head_bucket(Bucket=BUCKET)
