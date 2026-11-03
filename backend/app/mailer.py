"""Outgoing email over SMTP (Gmail with an app password works). Unconfigured, mail is logged instead of sent."""
from __future__ import annotations

import logging
import smtplib
import ssl
from email.message import EmailMessage

from .config import settings

log = logging.getLogger("kerosop.mail")


def send(to: list[str], subject: str, body: str, reply_to: str | None = None) -> bool:
    if not to:
        return False
    if not settings.smtp_host:
        log.warning("SMTP not configured; would have sent %r to %s:\n%s", subject, ", ".join(to), body)
        return False
    msg = EmailMessage()
    msg["From"] = settings.smtp_from or settings.smtp_user
    msg["To"] = ", ".join(to)
    msg["Subject"] = subject
    if reply_to:
        msg["Reply-To"] = reply_to
    msg.set_content(body)
    try:
        if settings.smtp_port == 465:
            with smtplib.SMTP_SSL(settings.smtp_host, 465, context=ssl.create_default_context(), timeout=20) as s:
                s.login(settings.smtp_user, settings.smtp_password)
                s.send_message(msg)
        else:
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20) as s:
                s.starttls(context=ssl.create_default_context())
                s.login(settings.smtp_user, settings.smtp_password)
                s.send_message(msg)
        return True
    except (smtplib.SMTPException, OSError):
        log.exception("Could not send %r to %s", subject, ", ".join(to))
        return False


def demo_request(r: dict) -> bool:
    """Tells the KeroSOP team that someone booked a demo."""
    langs = ", ".join(r.get("languages") or []) or "not given"
    body = f"""New demo request on KeroSOP.

Name:         {r['name']}
Email:        {r['email']}
Job title:    {r['jobTitle']}
Company:      {r['company']} ({r['companySize']} people)
Teams in:     {r['region']}
Languages:    {langs}

What they want to check first:
{r.get('useCase') or '(left blank)'}

Reply to this email to reach {r['name']} directly.
"""
    return send(settings.admin_emails, f"Demo request: {r['company']} ({r['name']})", body, reply_to=r["email"])
