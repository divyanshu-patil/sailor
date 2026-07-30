from minio import Minio
from app.config.settings import settings

client = Minio(
    f"localhost:{settings.MINIO_PORT}",
    access_key=settings.MINIO_ROOT_USER,
    secret_key=settings.MINIO_ROOT_PASSWORD,    
    secure=False,  # True only if you're using HTTPS (production, behind a proxy/cert)
)

def ensure_buckets():
    for bucket in ["audio-files", "image-files"]:
        if not client.bucket_exists(bucket):
            client.make_bucket(bucket)