import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Annotated
from app.config.settings import settings

security = HTTPBearer()


class ClerkUser:
    """
    Represents the authenticated Clerk user for this request.
    Populated from verified JWT claims — not from the database.
    """
    def __init__(self, clerk_user_id: str, email: str | None, claims: dict):
        self.clerk_user_id = clerk_user_id  # the `sub` claim — Clerk's user ID
        self.email = email                  # may be None for OAuth-only accounts
        self.claims = claims                # full decoded JWT payload


def get_current_clerk_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
) -> ClerkUser:
    """
    FastAPI dependency. Verifies the Bearer JWT from the Authorization header.
    Raises 401 if the token is missing, expired, or has an invalid signature.

    Usage in a route:
        @router.get("/something")
        def my_route(clerk_user: ClerkUser = Depends(get_current_clerk_user)):
            ...
    """
    token = credentials.credentials

    # Replace literal \n with real newlines in case the PEM was stored as a
    # single-line string in the .env file
    public_key = settings.CLERK_JWT_PUBLIC_KEY.replace("\\n", "\n")

    try:
        claims = jwt.decode(
            token,
            key=public_key,
            algorithms=["RS256"],
            options={"require": ["exp", "sub"]},
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.PyJWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Extract email from token claims (as per format specified in Clerk docs)
    email = claims.get("email") or None

    return ClerkUser(
        clerk_user_id=claims["sub"],
        email=email,
        claims=claims,
    )