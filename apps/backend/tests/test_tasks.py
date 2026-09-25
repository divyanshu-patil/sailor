"""The Celery jobs, run in-process against the test database with the AI calls
replaced. Called directly (the way a worker calls them, minus the broker) for
the normal paths, and through `.apply()` for Celery's own retry signal."""

from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
from celery.exceptions import Retry

from app.models.attachment_model import Attachment
from app.models.card_model import Card
from app.models.deck_model import Deck
from app.models.script_model import ScriptGeneration, ScriptVersion
from app.services.ai.card_generator import CardGenerationError
from app.services.ai.script_generator import ScriptGenerationError
from app.tasks import card_tasks, deck_tasks, script_tasks
from app.utils.enums.deck_enums import AudienceType, GenerationStatus
from app.utils.enums.speaking_style import SpeakingStyle

SCRIPT = "## [HOOK]\nSmall habits win. They compound quietly. Big goals stall. Start tiny today."
CARDS = [
    {"title": "Hook", "description": "Open", "keywords": ["win"], "impact": 0.9, "delivery": "energetic"},
    {"title": "Close", "description": "End", "keywords": [], "impact": 0.2, "delivery": "calm"},
]


@pytest.fixture
def user(make_user, db):
    user = make_user()
    db.commit()
    return user


@pytest.fixture
def generation(task_db, user):
    def make(**overrides):
        values = dict(
            user_id=user.id,
            description="Brief text long enough",
            duration_mins=3,
            card_count=2,
            audience=AudienceType.GENERAL,
            fingerprint="fp",
            title="Small Habits",
            script=SCRIPT,
            status=GenerationStatus.PENDING,
            last_seen_at=datetime.now(timezone.utc),
            mood="calm",
            profession="tech",
            experience_level="beginner",
        )
        values.update(overrides)
        row = ScriptGeneration(**values)
        task_db.add(row)
        task_db.commit()
        return row

    return make


@pytest.fixture
def deck(task_db, user):
    def make(**overrides):
        values = dict(
            user_id=user.id,
            title="Deck",
            script=SCRIPT,
            color="#fff",
            duration_mins=3,
            audience=AudienceType.GENERAL,
            card_count=2,
            generation_status=GenerationStatus.COMPLETED,
        )
        values.update(overrides)
        row = Deck(**values)
        task_db.add(row)
        task_db.commit()
        return row

    return make


def retry_signal(task, monkeypatch):
    """Make `self.retry(...)` hand back Celery's Retry signal, as it does inside
    a worker, instead of retrying inline or re-raising the cause."""
    monkeypatch.setattr(task, "retry", lambda **_: Retry())


def fail(exc):
    def raise_it(*args, **kwargs):
        raise exc

    return raise_it


class TestGenerateScript:
    def test_writes_the_script_and_a_version(self, generation, fake_redis, monkeypatch, task_db):
        row = generation()
        monkeypatch.setattr(script_tasks, "generate_script", lambda **_: ("Title", SCRIPT))
        script_tasks.generate_script_task(row.id)
        task_db.refresh(row)
        assert row.status == GenerationStatus.COMPLETED
        assert row.title == "Title"
        assert task_db.query(ScriptVersion).filter_by(generation_id=row.id).count() == 1

    def test_missing_and_cancelled_are_skipped(self, generation, monkeypatch, fake_redis):
        monkeypatch.setattr(script_tasks, "generate_script", fail(AssertionError("must not run")))
        script_tasks.generate_script_task(999999)
        row = generation(status=GenerationStatus.CANCELLED)
        script_tasks.generate_script_task(row.id)
        assert row.status == GenerationStatus.CANCELLED

    def test_a_model_failure_marks_it_failed(self, generation, monkeypatch, fake_redis, task_db):
        row = generation()
        monkeypatch.setattr(script_tasks, "generate_script", fail(ScriptGenerationError("model down")))
        script_tasks.generate_script_task(row.id)
        task_db.refresh(row)
        assert row.status == GenerationStatus.FAILED
        assert "model down" in row.error

    def test_retry_is_celerys_signal_not_a_failure(self, generation, monkeypatch, fake_redis, task_db):
        row = generation()
        monkeypatch.setattr(script_tasks, "generate_script", fail(ScriptGenerationError("flaky")))
        retry_signal(script_tasks.generate_script_task, monkeypatch)
        with pytest.raises(Retry):
            script_tasks.generate_script_task(row.id)
        assert '"retrying"' in fake_redis.store[f"script:{row.id}:status"]

    def test_a_crash_after_cancel_leaves_it_cancelled(self, generation, monkeypatch, fake_redis, task_db):
        row = generation()

        def cancel_then_crash(**_):
            task_db.query(ScriptGeneration).filter_by(id=row.id).update({"status": GenerationStatus.CANCELLED})
            task_db.commit()
            raise RuntimeError("boom")

        monkeypatch.setattr(script_tasks, "generate_script", cancel_then_crash)
        script_tasks.generate_script_task(row.id)
        task_db.refresh(row)
        assert row.status == GenerationStatus.CANCELLED


class TestReviseScript:
    def test_revises_and_records_the_instruction(self, generation, monkeypatch, fake_redis, task_db):
        row = generation(status=GenerationStatus.PENDING)
        monkeypatch.setattr(script_tasks, "revise_script", lambda **_: "Revised words.")
        script_tasks.revise_script_task(row.id, "shorter")
        task_db.refresh(row)
        assert row.script == "Revised words."
        version = task_db.query(ScriptVersion).filter_by(generation_id=row.id).one()
        assert version.instruction == "shorter"

    def test_missing_and_cancelled(self, generation, monkeypatch, fake_redis):
        monkeypatch.setattr(script_tasks, "revise_script", fail(AssertionError("must not run")))
        script_tasks.revise_script_task(999999, "x")
        row = generation(status=GenerationStatus.CANCELLED)
        script_tasks.revise_script_task(row.id, "x")

    def test_failure_restores_the_original(self, generation, monkeypatch, fake_redis, task_db):
        row = generation()
        monkeypatch.setattr(script_tasks, "revise_script", fail(ScriptGenerationError("nope")))
        script_tasks.revise_script_task(row.id, "x")
        task_db.refresh(row)
        assert row.script == SCRIPT
        assert row.status == GenerationStatus.COMPLETED or row.status == GenerationStatus.FAILED

    def test_retry_signal(self, generation, monkeypatch, fake_redis):
        row = generation()
        monkeypatch.setattr(script_tasks, "revise_script", fail(ScriptGenerationError("flaky")))
        retry_signal(script_tasks.revise_script_task, monkeypatch)
        with pytest.raises(Retry):
            script_tasks.revise_script_task(row.id, "x")

    def test_crash_after_cancel(self, generation, monkeypatch, fake_redis, task_db):
        row = generation()

        def cancel_then_crash(**_):
            task_db.query(ScriptGeneration).filter_by(id=row.id).update({"status": GenerationStatus.CANCELLED})
            task_db.commit()
            raise RuntimeError("boom")

        monkeypatch.setattr(script_tasks, "revise_script", cancel_then_crash)
        script_tasks.revise_script_task(row.id, "x")
        task_db.refresh(row)
        assert row.status == GenerationStatus.CANCELLED


class TestBuildDeck:
    def test_builds_the_deck_with_its_cards(self, generation, monkeypatch, fake_redis, task_db):
        row = generation(status=GenerationStatus.COMPLETED, cards_status=GenerationStatus.PENDING)
        monkeypatch.setattr(script_tasks, "generate_cards", lambda **_: CARDS)
        script_tasks.build_deck_from_generation(row.id)
        task_db.refresh(row)
        assert row.deck_id is not None
        deck = task_db.get(Deck, row.deck_id)
        assert deck.card_count == 2
        assert {c.color for c in deck.cards} and all(c.color != "#CCCCCC" for c in deck.cards)

    def test_already_built_missing_or_cancelled(self, generation, monkeypatch, fake_redis, deck):
        monkeypatch.setattr(script_tasks, "generate_cards", fail(AssertionError("must not run")))
        script_tasks.build_deck_from_generation(999999)
        built = generation(status=GenerationStatus.COMPLETED, deck_id=deck().id)
        script_tasks.build_deck_from_generation(built.id)
        cancelled = generation(status=GenerationStatus.COMPLETED, cards_status=GenerationStatus.CANCELLED)
        script_tasks.build_deck_from_generation(cancelled.id)

    def test_card_failure(self, generation, monkeypatch, fake_redis, task_db):
        row = generation(status=GenerationStatus.COMPLETED)
        monkeypatch.setattr(script_tasks, "generate_cards", fail(CardGenerationError("bad json")))
        script_tasks.build_deck_from_generation(row.id)
        task_db.refresh(row)
        assert row.cards_status == GenerationStatus.FAILED

    def test_retry_signal(self, generation, monkeypatch, fake_redis):
        row = generation(status=GenerationStatus.COMPLETED)
        monkeypatch.setattr(script_tasks, "generate_cards", fail(CardGenerationError("flaky")))
        retry_signal(script_tasks.build_deck_from_generation, monkeypatch)
        with pytest.raises(Retry):
            script_tasks.build_deck_from_generation(row.id)

    def test_failure_after_cancel_stays_cancelled(self, generation, monkeypatch, fake_redis, task_db):
        row = generation(status=GenerationStatus.COMPLETED)

        def cancel_then_crash(**_):
            task_db.query(ScriptGeneration).filter_by(id=row.id).update({"cards_status": GenerationStatus.CANCELLED})
            task_db.commit()
            raise RuntimeError("boom")

        monkeypatch.setattr(script_tasks, "generate_cards", cancel_then_crash)
        script_tasks.build_deck_from_generation(row.id)
        task_db.refresh(row)
        assert row.cards_status == GenerationStatus.CANCELLED


class TestSweeps:
    def test_stale_generations_are_cancelled(self, generation, fake_redis, celery, task_db):
        fake_redis.store["script:activity"] = "1"
        stale = generation(
            status=GenerationStatus.PROCESSING,
            celery_task_id="t",
            last_seen_at=datetime.now(timezone.utc) - timedelta(hours=2),
        )
        fresh = generation(status=GenerationStatus.PROCESSING)
        assert script_tasks.sweep_stale_generations() == 1
        task_db.refresh(stale)
        task_db.refresh(fresh)
        assert stale.status == GenerationStatus.CANCELLED
        assert fresh.status == GenerationStatus.PROCESSING
        assert celery.revoked == ["t"]

    def test_stale_sweep_skips_an_idle_instance(self, fake_redis):
        assert script_tasks.sweep_stale_generations() == 0

    def test_orphan_attachments(self, task_db, user, s3, monkeypatch):
        from app.services import storage_service

        old = datetime.now(timezone.utc) - timedelta(days=2)
        rows = [
            Attachment(user_id=user.id, kind="image", filename=f"f{i}.png", content_type="image/png",
                       size_bytes=1, object_key=f"k{i}", created_at=old)
            for i in range(2)
        ]
        task_db.add_all(rows)
        task_db.commit()
        calls = []

        def delete(key):
            calls.append(key)
            if key == "k1":
                raise storage_service.AttachmentStorageError("locked")

        monkeypatch.setattr(storage_service, "delete_attachment", delete)
        assert script_tasks.sweep_orphan_attachments() == 2
        assert calls == ["k0", "k1"]
        assert task_db.query(Attachment).count() == 1
        assert script_tasks.sweep_orphan_attachments() == 1


class TestCardTask:
    def test_regenerates_cards(self, deck, monkeypatch, fake_redis, task_db):
        row = deck()
        task_db.add(Card(deck_id=row.id, position=1, title="old", description="old", keywords=[],
                         color="#fff", impact=Decimal("0.5"), delivery=SpeakingStyle.CONFIDENT))
        task_db.commit()
        monkeypatch.setattr(card_tasks, "generate_cards", lambda **_: CARDS)
        card_tasks.generate_deck_cards(row.id, 2)
        task_db.refresh(row)
        assert row.cards_generation_status == GenerationStatus.COMPLETED
        assert [c.title for c in sorted(row.cards, key=lambda c: c.position)] == ["Hook", "Close"]

    def test_missing_failure_and_retry(self, deck, monkeypatch, fake_redis, task_db):
        card_tasks.generate_deck_cards(999999, 2)
        row = deck()
        monkeypatch.setattr(card_tasks, "generate_cards", fail(CardGenerationError("bad")))
        card_tasks.generate_deck_cards(row.id, 2)
        task_db.refresh(row)
        assert row.cards_generation_status == GenerationStatus.FAILED
        retry_signal(card_tasks.generate_deck_cards, monkeypatch)
        with pytest.raises(Retry):
            card_tasks.generate_deck_cards(row.id, 2)

    def test_failure_on_a_deck_that_vanished(self, deck, monkeypatch, fake_redis, task_db):
        row = deck()

        def vanish(**_):
            task_db.query(Deck).filter_by(id=row.id).delete()
            task_db.commit()
            raise RuntimeError("gone")

        monkeypatch.setattr(card_tasks, "generate_cards", vanish)
        card_tasks.generate_deck_cards(row.id, 2)


class TestDeckRevisionTask:
    def test_revises(self, deck, monkeypatch, fake_redis, task_db):
        row = deck()
        monkeypatch.setattr(deck_tasks, "revise_script", lambda **_: "Better.")
        deck_tasks.revise_deck_script(row.id, "shorter")
        task_db.refresh(row)
        assert row.script == "Better."

    def test_missing_cancelled_failure_retry(self, deck, monkeypatch, fake_redis, task_db):
        deck_tasks.revise_deck_script(999999, "x")
        cancelled = deck(generation_status=GenerationStatus.CANCELLED)
        deck_tasks.revise_deck_script(cancelled.id, "x")
        row = deck()
        monkeypatch.setattr(deck_tasks, "revise_script", fail(ScriptGenerationError("no")))
        deck_tasks.revise_deck_script(row.id, "x")
        task_db.refresh(row)
        assert row.generation_status == GenerationStatus.FAILED
        assert row.script == SCRIPT
        retry_signal(deck_tasks.revise_deck_script, monkeypatch)
        with pytest.raises(Retry):
            deck_tasks.revise_deck_script(row.id, "x")

    def test_crash_after_cancel_or_delete(self, deck, monkeypatch, fake_redis, task_db):
        row = deck()

        def cancel_then_crash(**_):
            task_db.query(Deck).filter_by(id=row.id).update({"generation_status": GenerationStatus.CANCELLED})
            task_db.commit()
            raise RuntimeError("boom")

        monkeypatch.setattr(deck_tasks, "revise_script", cancel_then_crash)
        deck_tasks.revise_deck_script(row.id, "x")
        task_db.refresh(row)
        assert row.generation_status == GenerationStatus.CANCELLED

        gone = deck()

        def delete_then_crash(**_):
            task_db.query(Deck).filter_by(id=gone.id).delete()
            task_db.commit()
            raise RuntimeError("gone")

        monkeypatch.setattr(deck_tasks, "revise_script", delete_then_crash)
        deck_tasks.revise_deck_script(gone.id, "x")
