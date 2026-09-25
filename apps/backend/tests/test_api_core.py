"""The account-level API, end to end: auth, profile, preferences, onboarding,
appearance and the health checks — through the real app, on a real database,
with a JWT signed by a throwaway key standing in for Clerk's."""

import pytest

from app.models.user_model import User


def test_health_checks(client):
    assert client.get("/health").json()["status"] == "ok"
    assert client.get("/api/v1/users/health").status_code == 200
    assert client.get("/api/v1/decks/health").status_code == 200
    assert client.get("/api/v1/scripts/health").status_code == 200


class TestAuth:
    def test_missing_token_is_rejected(self, client):
        client.headers.pop("Authorization")
        assert client.get("/api/v1/users/profile").status_code in (401, 403)

    def test_expired_token(self, client, token_for):
        client.headers["Authorization"] = f"Bearer {token_for(ttl=-3600)}"
        response = client.get("/api/v1/users/profile")
        assert response.status_code == 401
        assert "expired" in response.json()["detail"]

    def test_garbage_token(self, client):
        client.headers["Authorization"] = "Bearer not-a-jwt"
        response = client.get("/api/v1/users/profile")
        assert response.status_code == 401
        assert response.json()["detail"].startswith("Invalid token")

    def test_first_request_creates_the_user_row(self, client, db):
        client.get("/api/v1/users/profile")
        user = db.query(User).filter(User.clerk_user_id == "user_api").one()
        assert user.email == "api@example.com"
        # A second request finds it rather than creating another.
        client.get("/api/v1/users/profile")
        assert db.query(User).filter(User.clerk_user_id == "user_api").count() == 1

    @pytest.mark.xfail(
        strict=True,
        reason=(
            "BUG: a Clerk token with no email claim (OAuth-only accounts, as "
            "auth/clerk.py anticipates) stores email='' and GET /users/profile "
            "then fails response validation (EmailStr) with a 500."
        ),
    )
    def test_token_without_email(self, client, token_for, db):
        client.headers["Authorization"] = f"Bearer {token_for(sub='user_noemail', email=None)}"
        assert client.get("/api/v1/users/profile").status_code == 200
        assert db.query(User).filter(User.clerk_user_id == "user_noemail").one().email == ""


class TestProfile:
    def test_get_and_update(self, client):
        profile = client.get("/api/v1/users/profile").json()
        assert profile["clerk_user_id"] == "user_api"

        updated = client.patch(
            "/api/v1/users/profile",
            json={
                "nickname": "Div",
                "experience_level": "advanced",
                "profession": "tech",
                "onboarding_completed": True,
                "profile_setup_completed": True,
            },
        )
        assert updated.status_code == 200
        body = updated.json()
        assert body["nickname"] == "Div"
        assert body["profession"] == "tech"

    def test_nickname_is_validated_cleared_and_flags_are_one_way(self, client):
        response = client.patch("/api/v1/users/profile", json={"nickname": "!!"})
        assert response.status_code == 422
        client.patch("/api/v1/users/profile", json={"nickname": "Div", "onboarding_completed": True})
        cleared = client.patch(
            "/api/v1/users/profile",
            json={"nickname": None, "onboarding_completed": False},
        ).json()
        assert cleared["nickname"] is None
        # A completion flag only ever moves toward done.
        assert cleared["onboarding_completed"] is True

    def test_too_long_fields_are_rejected(self, client):
        assert client.patch("/api/v1/users/profile", json={"nickname": "x" * 8}).status_code == 422


class TestPreferences:
    def test_create_read_update(self, client):
        assert client.get("/api/v1/users/preferences").status_code in (200, 404)
        created = client.post(
            "/api/v1/users/preferences",
            json={
                "appearance": "rust",
                "emotion_haptics_enabled": True,
                "practice_reminders_enabled": True,
                "practice_reminder_time": "18:00",
                "default_mood": "confident",
            },
        )
        assert created.status_code in (200, 201), created.text
        updated = client.patch("/api/v1/users/preferences", json={"default_mood": "calm"})
        assert updated.status_code == 200, updated.text
        assert client.get("/api/v1/users/preferences").status_code == 200


class TestOnboarding:
    def test_not_started_until_written(self, client):
        body = client.get("/api/v1/users/onboarding").json()
        assert body["status"] == "not_started"

    def test_upsert_is_idempotent_and_completion_is_one_way(self, client):
        payload = {
            "flow_version": "2026-09",
            "status": "in_progress",
            "current_step_id": "gender",
            "completed_steps": ["profile_identity"],
            "data": {"nickname": "Div"},
        }
        first = client.put("/api/v1/users/onboarding", json=payload)
        second = client.put("/api/v1/users/onboarding", json=payload)
        assert first.status_code == second.status_code == 200
        assert second.json()["current_step_id"] == "gender"

        done = client.put(
            "/api/v1/users/onboarding",
            json={**payload, "status": "completed", "current_step_id": None, "completed_at": "2026-09-25T00:00:00Z"},
        )
        assert done.json()["status"] == "completed"
        back = client.put("/api/v1/users/onboarding", json=payload)
        assert back.json()["status"] == "completed"
        assert client.get("/api/v1/users/onboarding").json()["status"] == "completed"

    def test_finishing_the_flow_marks_the_account(self, client):
        # The pre-sign-up flow reaches the server only as a completed record;
        # the flag the app routes on has to follow it.
        payload = {
            "flow_version": "2026-09",
            "status": "completed",
            "current_step_id": None,
            "completed_steps": ["profile_identity"],
            "data": {},
        }
        assert client.get("/api/v1/users/profile").json()["onboarding_completed"] is False
        client.put("/api/v1/users/onboarding", json=payload)
        assert client.get("/api/v1/users/profile").json()["onboarding_completed"] is True
        # A stale in-progress replay keeps both the record and the flag done.
        client.put("/api/v1/users/onboarding", json={**payload, "status": "in_progress"})
        assert client.get("/api/v1/users/profile").json()["onboarding_completed"] is True

    def test_profile_reports_the_flag_not_the_record(self, client, me, db):
        from app.models.onboarding_model import OnboardingProgress

        db.add(
            OnboardingProgress(
                user_id=me.id,
                flow_version="2026-09",
                status="completed",
                current_step_id=None,
                completed_steps=[],
                data={},
            )
        )
        db.commit()
        # A finished record doesn't override a false flag: the account goes
        # through onboarding again.
        assert client.get("/api/v1/users/profile").json()["onboarding_completed"] is False
        db.refresh(me)
        assert me.onboarding_completed is False

    def test_rejects_an_unknown_status(self, client):
        response = client.put(
            "/api/v1/users/onboarding",
            json={"flow_version": "x", "status": "sideways"},
        )
        assert response.status_code == 422


def test_appearance_options(client):
    options = client.get("/api/v1/appearance/options").json()
    assert options and {"id", "name", "hex"} <= set(options[0])
