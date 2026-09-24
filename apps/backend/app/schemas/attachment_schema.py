from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.utils.enums.attachment_enums import AttachmentKind


class AttachmentResponse(BaseModel):
    """What the wizard holds onto after an upload. `id` is what the brief sends
    back; `url` is for showing the file in the form."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    kind: AttachmentKind
    filename: str
    content_type: str
    size_bytes: int
    # None when the object stored fine but S3 couldn't be asked for a link.
    url: Optional[str] = None
    has_text: bool = False
    created_at: datetime
