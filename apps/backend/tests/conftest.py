"""
Test harness.

Runs before any app module is imported, so it can decide what the app is
configured with:

* DATABASE_URL points at a throwaway Postgres — started here from the local
  `initdb`/`pg_ctl` if TEST_DATABASE_URL isn't given — and never at whatever
  .env names. A test run must not be able to touch a real database.
* Every credential the app could use to reach the outside world (Clerk, S3,
  Supabase, the AI providers, RevenueCat) is replaced with an inert stand-in, so
  a test that forgets a mock fails instead of calling a real service.

Tests that need the database take the `db` fixture; without Postgres available
they're skipped rather than failed.
"""

from __future__ import annotations

import atexit
import os
import shutil
import socket
import subprocess
import tempfile
from pathlib import Path

import pytest


def _free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def _start_postgres() -> str | None:
    initdb, pg_ctl = shutil.which("initdb"), shutil.which("pg_ctl")
    if not initdb or not pg_ctl:
        return None
    root = Path(tempfile.mkdtemp(prefix="sailors-test-pg-"))
    data = root / "data"
    try:
        subprocess.run(
            [initdb, "-D", str(data), "-U", "postgres", "--auth=trust", "-E", "UTF8"],
            check=True,
            capture_output=True,
        )
        port = _free_port()
        subprocess.run(
            [
                pg_ctl,
                "-D",
                str(data),
                "-o",
                f"-p {port} -k {root} -c listen_addresses=127.0.0.1",
                "-l",
                str(root / "postgres.log"),
                "-w",
                "start",
            ],
            check=True,
            capture_output=True,
        )
    except (OSError, subprocess.CalledProcessError):
        shutil.rmtree(root, ignore_errors=True)
        return None

    def stop() -> None:
        subprocess.run([pg_ctl, "-D", str(data), "-m", "immediate", "stop"], capture_output=True)
        shutil.rmtree(root, ignore_errors=True)

    atexit.register(stop)
    return f"postgresql+psycopg://postgres@127.0.0.1:{port}/postgres"


TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL") or _start_postgres()

os.environ.update(
    {
        # An unroutable fallback: with no test database, anything that tries to
        # connect fails fast instead of reaching a real one.
        "DATABASE_URL": TEST_DATABASE_URL or "postgresql+psycopg://nobody@127.0.0.1:9/none",
        "CLERK_SECRET_KEY": "sk_test_dummy",
        "CLERK_JWT_PUBLIC_KEY": "dummy",
        "CLERK_WEBHOOK_SIGNING_SECRET": "whsec_ZHVtbXlkdW1teWR1bW15ZHVtbXk=",
        "SUPABASE_URL": "http://supabase.invalid",
        "SUPABASE_SERVICE_ROLE_KEY": "dummy",
        "AWS_REGION": "us-east-1",
        "AWS_S3_BUCKET": "sailors-test-bucket",
        "AWS_ACCESS_KEY_ID": "testing",
        "AWS_SECRET_ACCESS_KEY": "testing",
        "REDIS_URL": "redis://127.0.0.1:9/0",
        "CELERY_BROKER_URL": "memory://",
        "CELERY_RESULT_BACKEND": "cache+memory://",
        "OPENROUTER_API_KEY": "",
        "OLLAMA_API_KEY": "",
        "ANTHROPIC_API_KEY": "",
        "OPENAI_API_KEY": "",
        "GEMINI_API_KEY": "",
        "GROQ_API_KEY": "",
        "REVENUECAT_API_KEY": "",
        "DAILY_PRACTICE_ADMIN_SECRET": "admin-secret",
    }
)


@pytest.fixture(scope="session")
def engine():
    if not TEST_DATABASE_URL:
        pytest.skip("no Postgres available for database tests")
    import importlib
    import pkgutil

    import app.models
    from app.db.base import Base

    # app.models doesn't import every model module itself (main.py imports
    # preferences separately), so register each one explicitly.
    for module in pkgutil.iter_modules(app.models.__path__):
        importlib.import_module(f"app.models.{module.name}")
    from app.db.database import engine as app_engine

    Base.metadata.create_all(app_engine)
    yield app_engine
    Base.metadata.drop_all(app_engine)


@pytest.fixture
def db(engine):
    """A session whose commits are savepoints inside one outer transaction,
    rolled back after the test — so every test starts from an empty database
    while the code under test still commits normally."""
    from sqlalchemy.orm import Session

    connection = engine.connect()
    outer = connection.begin()
    session = Session(bind=connection, join_transaction_mode="create_savepoint", expire_on_commit=False)
    try:
        yield session
    finally:
        session.close()
        outer.rollback()
        connection.close()


@pytest.fixture
def make_user(db):
    """Insert a user row. Keyword overrides for any column."""
    from app.models.user_model import User

    counter = {"n": 0}

    def make(**overrides):
        counter["n"] += 1
        n = counter["n"]
        values = {
            "clerk_user_id": f"user_{n}",
            "email": f"user{n}@example.com",
        }
        values.update(overrides)
        user = User(**values)
        db.add(user)
        db.flush()
        return user

    return make


# --- API tests ------------------------------------------------------------------


@pytest.fixture(scope="session")
def rsa_keys():
    """A throwaway RS256 key pair standing in for Clerk's."""
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import rsa

    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private_pem = key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    )
    public_pem = key.public_key().public_bytes(
        serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo
    )
    return private_pem, public_pem.decode()


@pytest.fixture
def token_for(rsa_keys, monkeypatch):
    """Mint a Clerk-shaped JWT the app will accept."""
    import time

    import jwt

    from app.config.settings import settings

    monkeypatch.setattr(settings, "CLERK_JWT_PUBLIC_KEY", rsa_keys[1])

    def make(sub="user_api", email="api@example.com", ttl=3600, **claims):
        payload = {"sub": sub, "exp": int(time.time()) + ttl, **claims}
        if email is not None:
            payload["email"] = email
        return jwt.encode(payload, rsa_keys[0], algorithm="RS256")

    return make


class _Recorder:
    """Stands in for Celery: records what would have been queued."""

    def __init__(self):
        self.calls: list[tuple[str, tuple, dict]] = []
        self.revoked: list[str] = []

    def apply_async(self, task, args=None, kwargs=None, task_id=None, **options):
        from types import SimpleNamespace

        self.calls.append((task.name, tuple(args or ()), dict(kwargs or {})))
        return SimpleNamespace(id=task_id or f"task-{len(self.calls)}")

    def names(self):
        return [name for name, _, _ in self.calls]


@pytest.fixture
def celery(monkeypatch):
    from celery.app.task import Task

    from app.core.celery_app import celery_app

    recorder = _Recorder()
    monkeypatch.setattr(
        Task,
        "apply_async",
        lambda self, args=None, kwargs=None, task_id=None, **options: recorder.apply_async(
            self, args, kwargs, task_id, **options
        ),
    )
    monkeypatch.setattr(
        celery_app.control, "revoke", lambda task_id, **_: recorder.revoked.append(task_id)
    )
    return recorder


class FakeRedis:
    """The two calls the realtime status helpers make."""

    def __init__(self):
        self.store: dict[str, str] = {}

    def set(self, key, value, ex=None):
        self.store[key] = value

    def get(self, key):
        return self.store.get(key)

    def delete(self, *keys):
        for key in keys:
            self.store.pop(key, None)


@pytest.fixture
def fake_redis(monkeypatch):
    from app.services.realtime import deck_events

    fake = FakeRedis()
    monkeypatch.setattr(deck_events, "_redis_client", fake)
    return fake


@pytest.fixture
def s3(monkeypatch):
    """A MagicMock in place of the boto3 client every storage call goes through."""
    from unittest.mock import MagicMock

    from app.services import storage_service

    client = MagicMock()
    client.generate_presigned_url.return_value = "https://signed.example/url"
    monkeypatch.setattr(storage_service, "client", client)
    return client


@pytest.fixture
def client(db, token_for, celery, fake_redis):
    """The real app, on the test database, signed in as `user_api`."""
    from fastapi.testclient import TestClient

    import main
    from app.db.database import get_db

    main.app.dependency_overrides[get_db] = lambda: db
    test_client = TestClient(main.app)
    test_client.headers["Authorization"] = f"Bearer {token_for()}"
    try:
        yield test_client
    finally:
        main.app.dependency_overrides.clear()


@pytest.fixture
def me(client, db):
    """The signed-in user's row (created by the first authenticated request)."""
    from app.models.user_model import User

    client.get("/api/v1/users/profile")
    return db.query(User).filter(User.clerk_user_id == "user_api").one()
