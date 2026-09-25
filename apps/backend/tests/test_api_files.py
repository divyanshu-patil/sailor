"""Attachments and deck audio — uploads, links, deletes — plus the storage
service beneath them. S3 is a MagicMock (the `s3` fixture), so every path runs
without a bucket, including the ones where S3 fails."""

import io
from datetime import timedelta
from unittest.mock import MagicMock

import pytest
from botocore.exceptions import ClientError

from app.models.attachment_model import Attachment
from app.models.deck_model import Deck
from app.services import storage_service
from app.utils.enums.attachment_enums import AttachmentKind
from app.utils.enums.deck_enums import AudienceType, GenerationStatus

S3_ERROR = ClientError({"Error": {"Code": "500", "Message": "down"}}, "op")
PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 64


def upload(client, name, data, content_type):
    return client.post(
        "/api/v1/attachments",
        files={"file": (name, io.BytesIO(data), content_type)},
    )


class TestAttachments:
    def test_image_upload_and_delete(self, client, s3, db):
        response = upload(client, "photo.PNG", PNG, "image/png")
        assert response.status_code == 201, response.text
        body = response.json()
        assert body["kind"] == "image" and body["has_text"] is False
        assert body["url"] == "https://signed.example/url"
        key = s3.put_object.call_args.kwargs["Key"]
        assert key.startswith("uploads/") and key.endswith(".png")

        assert client.delete(f"/api/v1/attachments/{body['id']}").status_code == 204
        s3.delete_object.assert_called_once()
        assert db.query(Attachment).count() == 0
        assert client.delete(f"/api/v1/attachments/{body['id']}").status_code == 404

    def test_text_document_is_extracted(self, client, s3):
        body = upload(client, "notes.txt", b"Talk about habits.", "text/plain; charset=utf-8").json()
        assert body["kind"] == "document" and body["has_text"] is True

    def test_refusals(self, client, s3, monkeypatch):
        assert upload(client, "a.gif", b"GIF89a", "image/gif").status_code == 415
        assert upload(client, "a.png", b"", "image/png").status_code == 413
        monkeypatch.setattr(storage_service, "MAX_IMAGE_BYTES", 10)
        assert upload(client, "a.png", PNG, "image/png").status_code == 413

    def test_total_cap_across_unsubmitted_files(self, client, s3, monkeypatch):
        from app.controllers import attachment_controller

        monkeypatch.setattr(attachment_controller, "MAX_TOTAL_BYTES_PER_GENERATION", 100)
        assert upload(client, "a.png", PNG, "image/png").status_code == 201
        assert upload(client, "b.png", PNG, "image/png").status_code == 413

    def test_unreadable_document(self, client, s3):
        assert upload(client, "a.pdf", b"not really a pdf", "application/pdf").status_code == 422

    def test_storage_failure(self, client, s3):
        s3.put_object.side_effect = S3_ERROR
        assert upload(client, "a.png", PNG, "image/png").status_code == 503

    def test_a_failed_insert_removes_the_stored_object(self, client, s3, db, me, monkeypatch):
        def broken_commit():
            raise RuntimeError("db down")

        monkeypatch.setattr(db, "commit", broken_commit)
        s3.delete_object.side_effect = S3_ERROR
        with pytest.raises(RuntimeError):
            upload(client, "a.png", PNG, "image/png")
        s3.delete_object.assert_called_once()

    def test_a_link_that_cant_be_signed_is_left_out(self, client, s3):
        s3.generate_presigned_url.side_effect = S3_ERROR
        assert upload(client, "a.png", PNG, "image/png").json()["url"] is None

    def test_claimed_files_cant_be_deleted_and_storage_errors_are_tolerated(self, client, s3, me, db):
        from app.models.script_model import ScriptGeneration

        generation = ScriptGeneration(
            user_id=me.id, description="d" * 20, duration_mins=1, card_count=1,
            audience=AudienceType.GENERAL, fingerprint="f", status=GenerationStatus.COMPLETED,
        )
        db.add(generation)
        db.flush()
        claimed = Attachment(user_id=me.id, kind=AttachmentKind.IMAGE, filename="a", content_type="image/png",
                             size_bytes=1, object_key="k1", generation_id=generation.id)
        loose = Attachment(user_id=me.id, kind=AttachmentKind.IMAGE, filename="b", content_type="image/png",
                           size_bytes=1, object_key="k2")
        db.add_all([claimed, loose])
        db.flush()
        assert client.delete(f"/api/v1/attachments/{claimed.id}").status_code == 409
        s3.delete_object.side_effect = S3_ERROR
        assert client.delete(f"/api/v1/attachments/{loose.id}").status_code == 204

    def test_a_brief_can_only_claim_its_own_unclaimed_files(self, client, s3):
        own = upload(client, "a.png", PNG, "image/png").json()
        brief = {
            "description": "A short talk about why small habits beat big goals.",
            "durationMinutes": 3,
            "cardCount": 3,
            "audience": "general",
        }
        ok = client.post("/api/v1/scripts", json={**brief, "attachmentIds": [own["id"]]})
        assert ok.status_code == 201, ok.text
        again = client.post("/api/v1/scripts", json={**brief, "attachmentIds": [own["id"]]})
        assert again.status_code == 400


@pytest.fixture
def deck(me, db):
    row = Deck(user_id=me.id, color="#fff", duration_mins=1, audience=AudienceType.GENERAL,
               card_count=1, generation_status=GenerationStatus.COMPLETED)
    db.add(row)
    db.flush()
    return row


class TestAudio:
    def test_record_play_remove(self, client, s3, deck, db):
        uploaded = client.post(
            f"/api/v1/decks/{deck.id}/audio",
            files={"file": ("r.m4a", io.BytesIO(b"audio"), "audio/m4a")},
        )
        assert uploaded.json() == {"deck_id": deck.id, "has_audio": True}
        assert client.get(f"/api/v1/decks/{deck.id}/audio-url").json()["audio_url"].startswith("https://")
        assert client.delete(f"/api/v1/decks/{deck.id}/audio").json() == {"deck_id": deck.id, "has_audio": False}
        # Removing again, with nothing recorded, is fine.
        assert client.delete(f"/api/v1/decks/{deck.id}/audio").status_code == 200
        assert client.get(f"/api/v1/decks/{deck.id}/audio-url").status_code == 404

    def test_refusals_and_failures(self, client, s3, deck, db):
        def post(data, content_type):
            return client.post(
                f"/api/v1/decks/{deck.id}/audio",
                files={"file": ("r", io.BytesIO(data), content_type)},
            )

        assert post(b"x", "text/plain").status_code == 400
        assert post(b"", "audio/m4a").status_code == 400
        s3.put_object.side_effect = S3_ERROR
        assert post(b"x", "audio/m4a").status_code == 502

        deck.audio_key = "decks/1/audio"
        db.flush()
        s3.generate_presigned_url.side_effect = S3_ERROR
        assert client.get(f"/api/v1/decks/{deck.id}/audio-url").status_code == 502
        s3.delete_object.side_effect = S3_ERROR
        assert client.delete(f"/api/v1/decks/{deck.id}/audio").status_code == 502
        assert client.get("/api/v1/decks/999999/audio-url").status_code == 404


class TestStorageService:
    def test_kinds_and_limits(self):
        assert storage_service.kind_for_content_type("IMAGE/PNG; q=1") == AttachmentKind.IMAGE
        assert storage_service.kind_for_content_type("application/pdf") == AttachmentKind.DOCUMENT
        with pytest.raises(ValueError):
            storage_service.kind_for_content_type(None)
        assert storage_service.max_bytes_for(AttachmentKind.DOCUMENT) == storage_service.MAX_DOCUMENT_BYTES

    def test_reading_an_image_back(self, s3):
        body = MagicMock()
        body.__enter__.return_value.read.return_value = b"img"
        s3.get_object.return_value = {"Body": body, "ContentType": "image/png"}
        image = storage_service.read_attachment_image("k")
        assert image.data == b"img" and image.media_type == "image/png"

        body.__enter__.return_value.read.return_value = b"img"
        s3.get_object.return_value = {"Body": body}
        assert storage_service.read_attachment_image("k").media_type == "application/octet-stream"

        body.__enter__.return_value.read.return_value = b""
        with pytest.raises(storage_service.AttachmentStorageError):
            storage_service.read_attachment_image("k")
        s3.get_object.side_effect = S3_ERROR
        with pytest.raises(storage_service.AttachmentStorageError):
            storage_service.read_attachment_image("k")

    def test_link_and_delete_failures(self, s3):
        s3.generate_presigned_url.side_effect = S3_ERROR
        with pytest.raises(storage_service.AttachmentStorageError):
            storage_service.get_attachment_url("k", timedelta(minutes=5))
        with pytest.raises(storage_service.AudioStorageError):
            storage_service.get_deck_audio_url("k")
        s3.delete_object.side_effect = S3_ERROR
        with pytest.raises(storage_service.AttachmentStorageError):
            storage_service.delete_attachment("k")
        with pytest.raises(storage_service.AudioStorageError):
            storage_service.delete_deck_audio("k")
