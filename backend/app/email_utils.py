import os
import json
import smtplib
import logging
import urllib.request
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

logger = logging.getLogger(__name__)

RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY", "")
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", "noreply@prodemundial.com")
RESEND_FROM = os.getenv("RESEND_FROM", "Prode Mundial 2026 <noreply@resend.dev>")


def _send_via_resend(to_email: str, subject: str, body_html: str) -> bool:
    data = {
        "from": RESEND_FROM,
        "to": [to_email],
        "subject": subject,
        "html": body_html,
    }
    req = urllib.request.Request(
        "https://api.resend.com/emails",
        data=json.dumps(data).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {RESEND_API_KEY}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            if resp.status == 200:
                logger.info(f"Resend email sent to {to_email}")
                return True
            logger.error(f"Resend returned {resp.status} for {to_email}")
            return False
    except Exception as e:
        logger.error(f"Resend failed for {to_email}: {e}")
        return False


def _send_via_sendgrid(to_email: str, subject: str, body_html: str) -> bool:
    data = {
        "personalizations": [{"to": [{"email": to_email}]}],
        "from": {"email": SMTP_FROM_EMAIL},
        "subject": subject,
        "content": [{"type": "text/html", "value": body_html}],
    }
    req = urllib.request.Request(
        "https://api.sendgrid.com/v3/mail/send",
        data=json.dumps(data).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {SENDGRID_API_KEY}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            if resp.status == 202:
                logger.info(f"SendGrid email sent to {to_email}")
                return True
            logger.error(f"SendGrid returned {resp.status} for {to_email}")
            return False
    except Exception as e:
        logger.error(f"SendGrid failed for {to_email}: {e}")
        return False


def _send_via_smtp(to_email: str, subject: str, body_html: str) -> bool:
    msg = MIMEMultipart("alternative")
    msg["From"] = SMTP_FROM_EMAIL
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.attach(MIMEText(body_html, "html"))

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.starttls()
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.send_message(msg)
    logger.info(f"SMTP email sent to {to_email}")
    return True


def send_email(to_email: str, subject: str, body_html: str) -> bool:
    if RESEND_API_KEY:
        return _send_via_resend(to_email, subject, body_html)
    if SENDGRID_API_KEY:
        return _send_via_sendgrid(to_email, subject, body_html)
    if SMTP_USER and SMTP_PASSWORD:
        try:
            return _send_via_smtp(to_email, subject, body_html)
        except Exception as e:
            logger.error(f"SMTP failed for {to_email}: {e}")
            return False
    logger.warning("No email transport configured (RESEND_API_KEY / SENDGRID_API_KEY / SMTP)")
    return False
