"""
Identity: Firebase Authentication is the OpenID Connect provider. The API
verifies the Firebase ID token (signature, audience, issuer, expiry) on
every request; email accounts must have a verified address.
"""
from dataclasses import dataclass
from uuid import UUID

import google.auth.transport.requests
from fastapi import Header, HTTPException
from google.oauth2 import id_token
from sqlalchemy import text

from .config import settings
from .db import system

_request = google.auth.transport.requests.Request()


@dataclass
class Identity:
    user_id: UUID
    firebase_uid: str
    email: str
    name: str
    is_admin: bool


def _verify(token: str) -> dict:
    if settings.allow_test_tokens and token.startswith("test:"):
        _, uid, email = token.split(":", 2)
        return {"uid": uid, "email": email, "email_verified": True, "name": email.split("@")[0], "firebase": {"sign_in_provider": "password"}}
    try:
        claims = id_token.verify_firebase_token(token, _request, audience=settings.firebase_project_id)
    except Exception as exc:  # signature, expiry, audience…
        raise HTTPException(401, "Your session has expired. Log in again.") from exc
    if not claims:
        raise HTTPException(401, "Invalid session.")
    claims["uid"] = claims.get("user_id") or claims.get("sub")
    return claims


def identify(authorization: str = Header(default="")) -> Identity:
    if not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Log in to continue.")
    claims = _verify(authorization[7:].strip())
    email = (claims.get("email") or "").lower()
    provider = (claims.get("firebase") or {}).get("sign_in_provider")
    if provider == "password" and not claims.get("email_verified"):
        raise HTTPException(403, "Confirm your email address first.")
    name = claims.get("name") or email.split("@")[0] or "User"
    with system() as conn:
        row = conn.execute(
            text(
                """INSERT INTO users (firebase_uid, email, name) VALUES (:uid, :email, :name)
                   ON CONFLICT (firebase_uid) DO UPDATE SET email = EXCLUDED.email, last_seen_at = now()
                   RETURNING id, name"""
            ),
            {"uid": claims["uid"], "email": email, "name": name},
        ).one()
    is_admin = bool(email) and email in settings.admin_emails and bool(claims.get("email_verified"))
    return Identity(user_id=row.id, firebase_uid=claims["uid"], email=email, name=row.name, is_admin=is_admin)
