import enum


class AttachmentKind(str, enum.Enum):
    """What the worker does with a file, not what it is.

    An image goes to the model as a vision input; a document is reduced to text
    at upload time and travels in the prompt. That split is the only distinction
    the pipeline cares about, so it's the only one stored — the precise format
    lives in `content_type`.
    """

    IMAGE = "image"
    DOCUMENT = "document"
