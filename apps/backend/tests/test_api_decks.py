"""Decks, the public feed, saves and cards — end to end on the test database."""

from datetime import datetime, timezone
from decimal import Decimal

import pytest

from app.models.card_model import Card
from app.models.deck_model import Deck
from app.utils.enums.deck_enums import AudienceType, DeckCategory, GenerationStatus
from app.utils.enums.speaking_style import SpeakingStyle


@pytest.fixture
def make_deck(db):
    def make(user, cards=2, **overrides):
        values = dict(
            user_id=user.id,
            title="Quarterly update",
            description="What we shipped this quarter",
            script="## [HOOK]\nWe shipped. It went well. Next we plan. Then we act.",
            color="#F4D35E",
            duration_mins=3,
            audience=AudienceType.GENERAL,
            card_count=cards,
            generation_status=GenerationStatus.COMPLETED,
            cards_generation_status=GenerationStatus.COMPLETED,
        )
        values.update(overrides)
        deck = Deck(**values)
        db.add(deck)
        db.flush()
        for position in range(1, cards + 1):
            db.add(
                Card(
                    deck_id=deck.id,
                    position=position,
                    title=f"Card {position}",
                    description="Say the thing",
                    keywords=["thing"],
                    color="#FFE8B6",
                    impact=Decimal("0.50"),
                    delivery=SpeakingStyle.CONFIDENT,
                )
            )
        db.flush()
        return deck

    return make


def publish_payload(**overrides):
    return {
        "description": "A quick quarterly update for the team.",
        "tags": ["Work", "update"],
        "category": "business",
        **overrides,
    }


class TestMyDecks:
    def test_list_only_mine_with_cards_newest_first(self, client, me, make_deck, make_user):
        empty = make_deck(me, cards=0)
        mine = make_deck(me)
        make_deck(make_user())  # someone else's
        ids = [d["id"] for d in client.get("/api/v1/decks").json()]
        assert ids == [mine.id]
        assert empty.id not in ids

    def test_get_update_and_favourite(self, client, me, make_deck, fake_redis):
        deck = make_deck(me)
        assert client.get(f"/api/v1/decks/{deck.id}").json()["title"] == "Quarterly update"
        assert client.get("/api/v1/decks/999999").status_code == 404

        unchanged = client.patch(f"/api/v1/decks/{deck.id}", json={})
        assert unchanged.status_code == 200
        updated = client.patch(
            f"/api/v1/decks/{deck.id}",
            json={"title": "Q3 update", "script": "New script", "isFavourite": True},
        ).json()
        assert updated["title"] == "Q3 update"
        assert updated["is_favorite"] is True
        # A completed deck's cached status is refreshed with the edit.
        assert f"deck:{deck.id}:status" in fake_redis.store

    def test_script_edits_wait_for_generation(self, client, me, make_deck):
        deck = make_deck(me, generation_status=GenerationStatus.PROCESSING)
        response = client.patch(f"/api/v1/decks/{deck.id}", json={"script": "x"})
        assert response.status_code == 409
        # A title edit is fine even mid-generation, and nothing is cached for
        # a deck that isn't finished.
        assert client.patch(f"/api/v1/decks/{deck.id}", json={"title": "ok"}).status_code == 200

    def test_revise(self, client, me, make_deck, celery):
        deck = make_deck(me)
        response = client.post(f"/api/v1/decks/{deck.id}/revise", json={"instruction": "Make it shorter please"})
        assert response.status_code == 202, response.text
        assert "revise" in celery.names()[0]

        busy = make_deck(me, generation_status=GenerationStatus.PENDING)
        assert client.post(f"/api/v1/decks/{busy.id}/revise", json={"instruction": "Make it shorter please"}).status_code == 409
        blank = make_deck(me, script=None)
        assert client.post(f"/api/v1/decks/{blank.id}/revise", json={"instruction": "Make it shorter please"}).status_code == 400

    def test_cancel(self, client, me, make_deck, celery):
        idle = make_deck(me)
        assert client.post(f"/api/v1/decks/{idle.id}/cancel").json()["generation_status"] == "completed"
        running = make_deck(me, generation_status=GenerationStatus.PROCESSING, celery_task_id="t-1")
        body = client.post(f"/api/v1/decks/{running.id}/cancel").json()
        assert body["generation_status"] == "cancelled"
        assert celery.revoked == ["t-1"]

    def test_delete_is_soft_and_revokes_jobs(self, client, me, make_deck, celery, db):
        deck = make_deck(me, celery_task_id="a", cards_celery_task_id="b")
        assert client.delete(f"/api/v1/decks/{deck.id}").status_code == 204
        db.refresh(deck)
        assert deck.is_deleted and deck.deleted_at is not None
        assert celery.revoked == ["a", "b"]
        assert client.get(f"/api/v1/decks/{deck.id}").status_code == 404

    def test_status_from_cache_then_database(self, client, me, make_deck, fake_redis):
        deck = make_deck(me)
        assert client.get(f"/api/v1/decks/{deck.id}/status").json()["status"] == "completed"
        fake_redis.store[f"deck:{deck.id}:status"] = '{"status": "processing"}'
        assert client.get(f"/api/v1/decks/{deck.id}/status").json() == {"status": "processing"}

        failed = make_deck(me, generation_status=GenerationStatus.FAILED, generation_error="nope")
        assert client.get(f"/api/v1/decks/{failed.id}/status").json() == {"status": "failed", "error": "nope"}
        pending = make_deck(me, generation_status=GenerationStatus.PENDING)
        assert client.get(f"/api/v1/decks/{pending.id}/status").json() == {"status": "pending"}
        assert client.get("/api/v1/decks/999999/status").status_code == 404


class TestPublishing:
    def test_publish_unpublish(self, client, me, make_deck):
        deck = make_deck(me)
        published = client.post(f"/api/v1/decks/{deck.id}/publish", json=publish_payload()).json()
        assert published["is_public"] is True
        assert published["tags"] == ["work", "update"]
        first_published = published["published_at"]
        # Republishing keeps the original date.
        again = client.post(f"/api/v1/decks/{deck.id}/publish", json=publish_payload()).json()
        assert again["published_at"] == first_published
        assert client.post(f"/api/v1/decks/{deck.id}/unpublish").json()["is_public"] is False

    def test_cannot_publish_an_unfinished_deck(self, client, me, make_deck):
        deck = make_deck(me, generation_status=GenerationStatus.PROCESSING)
        assert client.post(f"/api/v1/decks/{deck.id}/publish", json=publish_payload()).status_code == 409


class TestPublicFeed:
    @pytest.fixture
    def feed(self, me, make_deck, make_user):
        other = make_user(nickname="Sam")
        decks = []
        for i in range(3):
            decks.append(
                make_deck(
                    other,
                    title=f"Pitch {i}",
                    is_public=True,
                    tags=["sales"] if i else ["interview"],
                    category=DeckCategory.SALES if i else DeckCategory.INTERVIEW,
                    practice_count=i,
                    published_at=datetime(2026, 9, 1 + i, tzinfo=timezone.utc),
                )
            )
        make_deck(other, title="Hidden")  # not public
        return decks

    def test_pages_by_recency(self, client, feed):
        first = client.get("/api/v1/decks/public?limit=2").json()
        assert [d["title"] for d in first["items"]] == ["Pitch 2", "Pitch 1"]
        assert first["hasMore"] is True
        second = client.get(f"/api/v1/decks/public?limit=2&cursor={first['nextCursor']}").json()
        assert [d["title"] for d in second["items"]] == ["Pitch 0"]
        assert second["hasMore"] is False and second["nextCursor"] is None

    def test_filters_search_and_sort(self, client, feed):
        assert len(client.get("/api/v1/decks/public?category=interview").json()["items"]) == 1
        assert len(client.get("/api/v1/decks/public?tag=Sales").json()["items"]) == 2
        assert len(client.get("/api/v1/decks/public?q=pitch%201").json()["items"]) == 1
        popular = client.get("/api/v1/decks/public?sort=popular&limit=1").json()
        assert popular["items"][0]["title"] == "Pitch 2"
        page2 = client.get(f"/api/v1/decks/public?sort=popular&limit=1&cursor={popular['nextCursor']}").json()
        assert page2["items"][0]["title"] == "Pitch 1"

    def test_bad_cursor(self, client, feed):
        assert client.get("/api/v1/decks/public?cursor=garbage!!").status_code == 400

    def test_detail_save_practice(self, client, feed, token_for):
        deck = feed[0]
        detail = client.get(f"/api/v1/decks/public/{deck.id}").json()
        assert detail["isSaved"] is False
        assert client.post(f"/api/v1/decks/public/{deck.id}/save").status_code == 204
        # Saving twice is fine.
        assert client.post(f"/api/v1/decks/public/{deck.id}/save").status_code == 204
        assert client.get(f"/api/v1/decks/public/{deck.id}").json()["isSaved"] is True
        assert [d["id"] for d in client.get("/api/v1/decks/saved").json()] == [deck.id]
        assert client.delete(f"/api/v1/decks/public/{deck.id}/save").status_code == 204
        assert client.get("/api/v1/decks/saved").json() == []

        practice = client.post(f"/api/v1/decks/public/{deck.id}/practice").json()
        assert practice["practiceCount"] == 1
        assert client.post("/api/v1/decks/public/999999/practice").status_code == 404
        assert client.get("/api/v1/decks/public/999999").status_code == 404

    def test_detail_is_readable_signed_out_or_with_a_bad_token(self, client, feed):
        deck = feed[0]
        client.headers.pop("Authorization")
        assert client.get(f"/api/v1/decks/public/{deck.id}").json()["isSaved"] is False
        client.headers["Authorization"] = "Bearer broken"
        assert client.get(f"/api/v1/decks/public/{deck.id}").status_code == 200
        client.headers["Authorization"] = "Basic abc"
        assert client.get(f"/api/v1/decks/public/{deck.id}").status_code == 200

    def test_saving_a_missing_deck(self, client):
        assert client.post("/api/v1/decks/public/999999/save").status_code == 404


class TestCards:
    def test_list_get_update_with_version_check(self, client, me, make_deck):
        deck = make_deck(me)
        cards = client.get(f"/api/v1/decks/{deck.id}/cards").json()
        assert [c["position"] for c in cards] == [1, 2]
        card = client.get(f"/api/v1/decks/{deck.id}/cards/{cards[0]['id']}").json()
        assert card["title"] == "Card 1"
        assert client.get(f"/api/v1/decks/{deck.id}/cards/999999").status_code == 404

        updated = client.patch(
            f"/api/v1/decks/{deck.id}/cards/{card['id']}",
            json={"expected_version": card["version"], "title": "Hook", "impact": 0.9},
        )
        assert updated.status_code == 200, updated.text
        assert updated.json()["title"] == "Hook"
        stale = client.patch(
            f"/api/v1/decks/{deck.id}/cards/{card['id']}",
            json={"expected_version": card["version"], "title": "Again"},
        )
        assert stale.status_code == 409

    def test_cards_of_someone_elses_deck(self, client, make_user, make_deck):
        deck = make_deck(make_user())
        assert client.get(f"/api/v1/decks/{deck.id}/cards").status_code == 404

    def test_generate_cancel_status(self, client, me, make_deck, celery, fake_redis):
        deck = make_deck(me)
        started = client.post(f"/api/v1/decks/{deck.id}/cards/generate")
        assert started.status_code == 202, started.text
        assert "cards" in celery.names()[0]
        # Asking again while it's running doesn't queue a second job.
        client.post(f"/api/v1/decks/{deck.id}/cards/generate")
        status = client.get(f"/api/v1/decks/{deck.id}/cards/status").json()
        assert status["status"] in ("pending", "processing")
        cancelled = client.post(f"/api/v1/decks/{deck.id}/cards/cancel")
        assert cancelled.status_code == 200
        assert client.post(f"/api/v1/decks/{deck.id}/cards/cancel").status_code == 200

    def test_generate_needs_a_script(self, client, me, make_deck):
        deck = make_deck(me, script=None, generation_status=GenerationStatus.PENDING)
        assert client.post(f"/api/v1/decks/{deck.id}/cards/generate").status_code in (400, 409)

    def test_status_reads_the_cache_first(self, client, me, make_deck, fake_redis):
        deck = make_deck(me)
        fake_redis.store[f"deck:{deck.id}:cards:status"] = '{"status": "processing"}'
        assert client.get(f"/api/v1/decks/{deck.id}/cards/status").json()["status"] == "processing"
        failed = make_deck(me, cards_generation_status=GenerationStatus.FAILED, cards_generation_error="x")
        assert client.get(f"/api/v1/decks/{failed.id}/cards/status").json()["status"] == "failed"
