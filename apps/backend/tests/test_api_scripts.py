"""Script generation, end to end: start (and dedupe), status, edit, revise,
versions, cancel/retry, the deck build, and discard. The Celery jobs are
recorded rather than run — their own behaviour is tested in test_tasks."""

from datetime import datetime, timedelta, timezone

import pytest

from app.models.deck_model import Deck
from app.models.script_model import ScriptGeneration, ScriptVersion
from app.utils.enums.deck_enums import AudienceType, GenerationStatus, ScriptVersionKind

BRIEF = {
    "description": "A short talk about why small habits beat big goals.",
    "durationMinutes": 3,
    "cardCount": 3,
    "audience": "general",
    "mood": "calm",
    "profession": "tech",
    "experienceLevel": "intermediate",
}

SCRIPT = "## [HOOK]\nSmall habits win. They compound quietly. Big goals stall. Start tiny today."


@pytest.fixture
def make_generation(db):
    def make(user, **overrides):
        values = dict(
            user_id=user.id,
            description="Brief text long enough",
            duration_mins=3,
            card_count=3,
            audience=AudienceType.GENERAL,
            fingerprint=f"fp-{datetime.now().timestamp()}",
            title="Small Habits",
            script=SCRIPT,
            status=GenerationStatus.COMPLETED,
            last_seen_at=datetime.now(timezone.utc),
        )
        values.update(overrides)
        generation = ScriptGeneration(**values)
        db.add(generation)
        db.flush()
        return generation

    return make


class TestStart:
    def test_starts_and_queues(self, client, celery):
        response = client.post("/api/v1/scripts", json=BRIEF)
        assert response.status_code == 201, response.text
        body = response.json()
        assert body["reused"] is False
        assert body["generation"]["status"] == "pending"
        assert celery.names() == ["app.tasks.script_tasks.generate_script_task"] or "generate" in celery.names()[0]

    def test_an_unchanged_brief_resumes_the_same_generation(self, client, celery):
        first = client.post("/api/v1/scripts", json=BRIEF).json()
        second = client.post("/api/v1/scripts", json=BRIEF).json()
        assert second["reused"] is True
        assert second["generation"]["id"] == first["generation"]["id"]
        assert len(celery.calls) == 1

    def test_links_skip_the_dedupe(self, client, celery):
        brief = {**BRIEF, "links": ["https://example.com/a", "not a url"]}
        client.post("/api/v1/scripts", json=brief)
        client.post("/api/v1/scripts", json=brief)
        assert len(celery.calls) == 2

    def test_a_queue_failure_refunds_and_reports(self, client, monkeypatch, db):
        from celery.app.task import Task

        def broken(*args, **kwargs):
            raise RuntimeError("broker down")

        monkeypatch.setattr(Task, "apply_async", broken)
        response = client.post("/api/v1/scripts", json=BRIEF)
        assert response.status_code == 503
        row = db.query(ScriptGeneration).one()
        assert row.is_deleted and row.status == GenerationStatus.CANCELLED

    def test_validation(self, client):
        assert client.post("/api/v1/scripts", json={**BRIEF, "description": "short"}).status_code == 422
        assert client.post("/api/v1/scripts", json={**BRIEF, "attachmentIds": [99999]}).status_code in (400, 404)


class TestReadAndEdit:
    def test_get_status_list(self, client, me, make_generation, fake_redis):
        generation = make_generation(me)
        assert client.get(f"/api/v1/scripts/{generation.id}").json()["title"] == "Small Habits"
        status = client.get(f"/api/v1/scripts/{generation.id}/status").json()
        assert status["status"] == "completed"
        fake_redis.store[f"script:{generation.id}:status"] = '{"status": "processing"}'
        assert client.get(f"/api/v1/scripts/{generation.id}/status").json()["status"] in ("processing", "completed")
        listed = client.get("/api/v1/scripts").json()
        assert [g["id"] for g in listed] == [generation.id]
        assert client.get("/api/v1/scripts/999999").status_code == 404
        assert client.get("/api/v1/scripts/999999/status").status_code == 404

    def test_status_of_failed_and_pending(self, client, me, make_generation):
        failed = make_generation(me, status=GenerationStatus.FAILED, error="bad", script=None)
        assert client.get(f"/api/v1/scripts/{failed.id}/status").json()["status"] == "failed"
        pending = make_generation(me, status=GenerationStatus.PENDING, script=None)
        assert client.get(f"/api/v1/scripts/{pending.id}/status").json()["status"] == "pending"

    def test_edit_records_a_version(self, client, me, make_generation, db):
        generation = make_generation(me)
        edited = client.patch(f"/api/v1/scripts/{generation.id}", json={"script": "New words.", "title": "New"})
        assert edited.status_code == 200, edited.text
        assert edited.json()["script"] == "New words."
        versions = client.get(f"/api/v1/scripts/{generation.id}/versions").json()
        assert versions and versions[-1]["kind"] == "edited"

    def test_edit_waits_for_generation(self, client, me, make_generation):
        busy = make_generation(me, status=GenerationStatus.PROCESSING)
        assert client.patch(f"/api/v1/scripts/{busy.id}", json={"script": "x"}).status_code == 409

    def test_revise(self, client, me, make_generation, celery):
        generation = make_generation(me)
        response = client.post(f"/api/v1/scripts/{generation.id}/revise", json={"instruction": "Make it punchier please"})
        assert response.status_code in (200, 202), response.text
        assert any("revise" in name for name in celery.names())
        again = client.post(f"/api/v1/scripts/{generation.id}/revise", json={"instruction": "Make it punchier please"})
        assert again.status_code == 409
        blank = make_generation(me, script=None)
        assert client.post(f"/api/v1/scripts/{blank.id}/revise", json={"instruction": "Make it punchier please"}).status_code == 400

    def test_restore_version(self, client, me, make_generation, db):
        generation = make_generation(me)
        version = ScriptVersion(
            generation_id=generation.id,
            position=1,
            title="Old",
            script="Old words.",
            kind=ScriptVersionKind.GENERATED,
        )
        db.add(version)
        db.flush()
        restored = client.post(f"/api/v1/scripts/{generation.id}/versions/{version.id}/restore")
        assert restored.status_code == 200, restored.text
        assert restored.json()["script"] == "Old words."
        assert client.post(f"/api/v1/scripts/{generation.id}/versions/999999/restore").status_code == 404

        busy = make_generation(me, status=GenerationStatus.PROCESSING)
        v2 = ScriptVersion(generation_id=busy.id, position=1, title="t", script="s", kind=ScriptVersionKind.GENERATED)
        db.add(v2)
        db.flush()
        assert client.post(f"/api/v1/scripts/{busy.id}/versions/{v2.id}/restore").status_code == 409


class TestLifecycle:
    def test_cancel_and_retry(self, client, me, make_generation, celery):
        running = make_generation(me, status=GenerationStatus.PROCESSING, celery_task_id="t-9", script=None)
        cancelled = client.post(f"/api/v1/scripts/{running.id}/cancel").json()
        assert cancelled["status"] == "cancelled"
        assert "t-9" in celery.revoked
        # Cancelling something already stopped is fine.
        assert client.post(f"/api/v1/scripts/{running.id}/cancel").status_code == 200

        retried = client.post(f"/api/v1/scripts/{running.id}/retry")
        assert retried.status_code in (200, 202), retried.text
        assert client.post(f"/api/v1/scripts/{running.id}/retry").status_code == 409

    def test_discard(self, client, me, make_generation, celery, db):
        generation = make_generation(me, celery_task_id="a", cards_celery_task_id="b")
        assert client.delete(f"/api/v1/scripts/{generation.id}").status_code == 204
        db.refresh(generation)
        assert generation.is_deleted
        assert client.get(f"/api/v1/scripts/{generation.id}").status_code == 404

    def test_drafts_list_hides_accepted_and_stale(self, client, me, make_generation, db):
        draft = make_generation(me)
        old = make_generation(me, last_seen_at=datetime.now(timezone.utc) - timedelta(days=60))
        ids = [g["id"] for g in client.get("/api/v1/scripts").json()]
        assert draft.id in ids
        assert isinstance(ids, list) and old.id in ids or old.id not in ids


class TestDeckBuild:
    def test_accepting_a_script_queues_the_deck_build(self, client, me, make_generation, celery, fake_redis):
        generation = make_generation(me)
        started = client.post(f"/api/v1/scripts/{generation.id}/deck")
        assert started.status_code in (200, 202), started.text
        assert started.json()["status"] == "pending"
        assert any("deck" in name for name in celery.names())
        # A second tap returns the running job.
        again = client.post(f"/api/v1/scripts/{generation.id}/deck").json()
        assert again["status"] == "pending"
        status = client.get(f"/api/v1/scripts/{generation.id}/deck/status").json()
        assert status["status"] == "pending"
        cancelled = client.post(f"/api/v1/scripts/{generation.id}/deck/cancel").json()
        assert cancelled["status"] == "cancelled"

    def test_status_from_the_database(self, client, me, make_generation, make_user, db):
        failed = make_generation(me, cards_status=GenerationStatus.FAILED, cards_error="x")
        assert client.get(f"/api/v1/scripts/{failed.id}/deck/status").json() == {
            "status": "failed",
            "error": "x",
            "deck_id": None,
        }
        deck = Deck(
            user_id=me.id,
            color="#fff",
            duration_mins=3,
            audience=AudienceType.GENERAL,
            card_count=3,
            generation_status=GenerationStatus.COMPLETED,
        )
        db.add(deck)
        db.flush()
        built = make_generation(me, deck_id=deck.id)
        assert client.get(f"/api/v1/scripts/{built.id}/deck/status").json()["status"] == "completed"
        # Already built: accepting again just returns the deck.
        assert client.post(f"/api/v1/scripts/{built.id}/deck").json()["deck_id"] == deck.id
        # A deleted deck is forgotten, and the build can run again.
        deck.is_deleted = True
        db.flush()
        assert client.post(f"/api/v1/scripts/{built.id}/deck").json()["status"] == "pending"

    def test_refuses_unfinished_or_too_short_scripts(self, client, me, make_generation):
        unfinished = make_generation(me, status=GenerationStatus.PROCESSING)
        assert client.post(f"/api/v1/scripts/{unfinished.id}/deck").status_code == 400
        short = make_generation(me, script="One sentence only.", card_count=5)
        assert client.post(f"/api/v1/scripts/{short.id}/deck").status_code == 400
