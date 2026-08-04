from minio import Minio
from app.config.settings import settings

BUCKETS = ["attachments", "deck-audio"]

# Two clients, one MinIO.
#
# `client` talks to MinIO over whatever address this process can reach it on —
# localhost in dev, a service name in compose. `public_client` exists only to
# *sign* URLs, and signs them against the address a phone can reach. They have
# to be separate instances because the host is baked into the signature: sign
# with the internal client and the app gets a working signature for
# `localhost:9000`, which resolves to the phone itself. Requests never leave the
# device and every download fails.
#
# MINIO_PUBLIC_ENDPOINT unset means "same address" — correct for the simulator,
# wrong for a real device on the LAN.
client = Minio(
    f"localhost:{settings.MINIO_PORT}",
    access_key=settings.MINIO_ROOT_USER,
    secret_key=settings.MINIO_ROOT_PASSWORD,
    secure=False,  # True only if you're using HTTPS (production, behind a proxy/cert)
)

public_client = (
    Minio(
        settings.MINIO_PUBLIC_ENDPOINT,
        access_key=settings.MINIO_ROOT_USER,
        secret_key=settings.MINIO_ROOT_PASSWORD,
        secure=settings.MINIO_PUBLIC_SECURE,
    )
    if settings.MINIO_PUBLIC_ENDPOINT
    else client
)


def ensure_buckets():
    for bucket in BUCKETS:
        if not client.bucket_exists(bucket):
            client.make_bucket(bucket)
