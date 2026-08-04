from fastapi import APIRouter, Depends, UploadFile, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.controllers import attachment_controller
from app.db.database import get_db
from app.models.user_model import User
from app.schemas.attachment_schema import AttachmentResponse

router = APIRouter(prefix="/attachments", tags=["Attachments"])


@router.post("", response_model=AttachmentResponse, status_code=status.HTTP_201_CREATED)
async def upload_attachment(
    file: UploadFile,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload one file and get back the id a brief will reference.

    One file per request on purpose: the wizard uploads each attachment as it is
    picked and shows per-file progress, which a batched endpoint cannot report —
    and one oversized file in a batch would fail the whole set.
    """
    return await attachment_controller.upload_attachment(file, current_user, db)


@router.delete("/{attachment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_attachment(
    attachment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Remove a file from the form before it is submitted. Refuses once the
    attachment belongs to a generation — its extracted text is what revisions
    are grounded in."""
    attachment_controller.remove_attachment(attachment_id, current_user, db)
