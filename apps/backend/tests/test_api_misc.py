"""Webhooks, the admin trigger, daily practice through the API, and the
auth edges the other suites don't reach."""

import json
from datetime import date, datetime, timedelta, timezone

import pytest
from svix.webhooks import Webhook

from app.config.settings import settings
from app.models.daily_model import DailyContent
from app.models.user_model import User


@pytest.fixture
def webhook_db(db, monkeypatch):
    from app.controllers import webhook_controller

    monkeypatch.setattr(webhook_controller, "SessionLocal", lambda: db)
    monkeypatch.setattr(db, "close", lambda: None)
    return db


def send(client, event_type, data, secret=None):
    body = json.dumps({"type": event_type, "data": data})
    msg_id = "msg_1"
    timestamp = datetime.now(timezone.utc)
    signature = Webhook(secret or settings.CLERK_WEBHOOK_SIGNING_SECRET).sign(msg_id, timestamp, body)
    return client.post(
        "/webhooks/clerk",
        content=body,
        headers={
            "svix-id": msg_id,
            "svix-timestamp": str(int(timestamp.timestamp())),
            "svix-signature": signature,
            "content-type": "application/json",
        },
    )


class TestClerkWebhook:
    user = {
        "id": "user_wh",
        "primary_email_address_id": "e1",
        "email_addresses": [
            {"id": "e0", "email_address": "old@example.com"},
            {"id": "e1", "email_address": "primary@example.com"},
        ],
    }

    def test_created_updated_deleted(self, client, webhook_db):
        assert send(client, "user.created", self.user).json() == {"status": "ok"}
        row = webhook_db.query(User).filter_by(clerk_user_id="user_wh").one()
        assert row.email == "primary@example.com"
        # A replay of the same event is a no-op.
        send(client, "user.created", self.user)
        assert webhook_db.query(User).filter_by(clerk_user_id="user_wh").count() == 1

        updated = {**self.user, "email_addresses": [{"id": "e1", "email_address": "new@example.com"}]}
        send(client, "user.updated", updated)
        webhook_db.refresh(row)
        assert row.email == "new@example.com"
        # An update without a primary email changes nothing.
        send(client, "user.updated", {"id": "user_wh", "email_addresses": []})

        send(client, "user.deleted", {"id": "user_wh"})
        assert webhook_db.query(User).filter_by(clerk_user_id="user_wh").count() == 0

    def test_created_without_an_email_and_unknown_events(self, client, webhook_db):
        send(client, "user.created", {"id": "user_bare"})
        assert webhook_db.query(User).filter_by(clerk_user_id="user_bare").one().email == ""
        assert send(client, "session.created", {"id": "s"}).status_code == 200

    def test_a_race_with_the_auth_fallback_is_tolerated(self, client, webhook_db, monkeypatch):
        from sqlalchemy.exc import IntegrityError

        original = webhook_db.commit

        def racing_commit():
            monkeypatch.setattr(webhook_db, "commit", original)
            raise IntegrityError("insert", {}, Exception("duplicate"))

        monkeypatch.setattr(webhook_db, "commit", racing_commit)
        assert send(client, "user.created", {"id": "user_race"}).status_code == 200

    def test_bad_signature(self, client, webhook_db):
        other = "whsec_" + "b3RoZXJzZWNyZXRvdGhlcnNlY3JldA=="
        assert send(client, "user.created", self.user, secret=other).status_code == 400


class TestAdmin:
    url = "/api/v1/admin/daily-content/regenerate"

    def test_regenerate_with_the_secret(self, client, celery):
        response = client.post(self.url, headers={"X-Admin-Secret": "admin-secret"}, params={"days": 3})
        assert response.status_code == 200, response.text
        assert any("refill" in name for name in celery.names())

    def test_wrong_secret_and_unconfigured(self, client, celery, monkeypatch):
        assert client.post(self.url, headers={"X-Admin-Secret": "nope"}).status_code == 401
        monkeypatch.setattr(settings, "DAILY_PRACTICE_ADMIN_SECRET", "")
        assert client.post(self.url, headers={"X-Admin-Secret": "x"}).status_code == 404


class TestDailyPractice:
    @pytest.fixture
    def content(self, db):
        today = date(2026, 9, 25)
        for day in (today, today + timedelta(days=1)):
            for index in range(2):
                db.add(
                    DailyContent(
                        date=day,
                        framework="PREP" if index == 0 else "UNKNOWN",
                        title="" if index else "Point first",
                        mood="calm",
                        situation="interview",
                        body="Say the point first. Then the reason.",
                        tip="Keep it short.",
                        variation_index=index,
                    )
                )
        db.flush()
        return today

    def test_today_and_tomorrow(self, client, content):
        body = client.get(f"/api/v1/daily-practice/today?local_date={content}").json()
        assert body["today"]["date"] == content.isoformat()
        assert body["tomorrow"] is not None

    def test_not_ready(self, client):
        assert client.get("/api/v1/daily-practice/today?local_date=2030-01-01").status_code == 503

    def test_streak_complete_and_restore(self, client):
        day = "2026-09-25"
        assert client.get(f"/api/v1/daily-practice/streak?local_date={day}").json()["currentStreak"] == 0
        done = client.post("/api/v1/daily-practice/complete", json={"localDate": day}).json()
        assert done["currentStreak"] == 1 and done["completedToday"] is True
        assert client.post("/api/v1/daily-practice/restore", json={"localDate": day}).status_code == 400


class TestAuthEdges:
    def test_admin_only_routes_refuse_a_regular_user(self, client, me):
        from app.auth.dependencies import require_admin

        with pytest.raises(Exception) as caught:
            require_admin(current_user=me)
        assert getattr(caught.value, "status_code", None) == 403
        me.role = "admin"
        assert require_admin(current_user=me) is me

    def test_first_login_races_the_webhook(self, db, monkeypatch):
        from sqlalchemy.exc import IntegrityError

        from app.auth.dependencies import resolve_user_from_claims

        original = db.commit
        winner = User(clerk_user_id="user_racer", email="r@example.com")

        def lose_the_race():
            # The webhook got there first: its row is committed, ours is not.
            monkeypatch.setattr(db, "commit", original)
            for pending in list(db.new):
                db.expunge(pending)
            db.add(winner)
            original()
            raise IntegrityError("insert", {}, Exception("duplicate"))

        monkeypatch.setattr(db, "commit", lose_the_race)
        assert resolve_user_from_claims({"sub": "user_racer"}, db).id == winner.id

    def test_race_where_the_row_then_vanishes(self, db, monkeypatch):
        from fastapi import HTTPException
        from sqlalchemy.exc import IntegrityError

        from app.auth.dependencies import resolve_user_from_claims

        def always_conflict():
            raise IntegrityError("insert", {}, Exception("duplicate"))

        monkeypatch.setattr(db, "commit", always_conflict)
        with pytest.raises(HTTPException) as caught:
            resolve_user_from_claims({"sub": "user_ghost"}, db)
        assert caught.value.status_code == 500
