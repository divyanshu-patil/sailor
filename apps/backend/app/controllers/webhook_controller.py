import logging

from sqlalchemy.exc import IntegrityError

from app.db.database import SessionLocal
from app.models.user_model import User

logger = logging.getLogger("uvicorn")


def _extract_primary_email(data: dict) -> str | None:
    return next(
        (
            e["email_address"]
            for e in data.get("email_addresses", [])
            if e["id"] == data.get("primary_email_address_id")
        ),
        None,
    )


def handle_user_created(data: dict) -> None:
    clerk_user_id = data["id"]
    email = _extract_primary_email(data) or ""

    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.clerk_user_id == clerk_user_id).one_or_none()
        if existing:
            logger.info(f"[webhook] user.created → {clerk_user_id} already exists, skipping")
            return

        db.add(User(clerk_user_id=clerk_user_id, email=email, role="user"))
        try:
            db.commit()
            logger.info(f"[webhook] user.created → {clerk_user_id} ({email})")
        except IntegrityError:
            db.rollback()
            logger.warning(f"[webhook] user.created race for {clerk_user_id}, already inserted elsewhere")
    finally:
        db.close()


def handle_user_updated(data: dict) -> None:
    clerk_user_id = data["id"]
    email = _extract_primary_email(data)

    db = SessionLocal()
    try:
        if email:
            db.query(User).filter(User.clerk_user_id == clerk_user_id).update({"email": email})
            db.commit()
        logger.info(f"[webhook] user.updated → {clerk_user_id}")
    finally:
        db.close()


def handle_user_deleted(data: dict) -> None:
    clerk_user_id = data["id"]
    db = SessionLocal()
    try:
        db.query(User).filter(User.clerk_user_id == clerk_user_id).delete()
        db.commit()
        logger.info(f"[webhook] user.deleted → {clerk_user_id}")
    finally:
        db.close()
