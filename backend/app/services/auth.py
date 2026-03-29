"""
Local auth service — SQLite database + JWT tokens.
No external API. Database file: users.db (auto-created next to run.py)
"""

from __future__ import annotations

import os
import secrets
import sqlite3
from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext

SECRET_KEY = os.getenv("JWT_SECRET_KEY", secrets.token_hex(32))
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24 * 7  # 7 days

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "users.db")
# Prefer PBKDF2 for reliable local hashing on Windows/Python 3.12 while still
# allowing verification of any legacy bcrypt hashes that may already exist.
pwd_context = CryptContext(schemes=["pbkdf2_sha256", "bcrypt"], deprecated="auto")


def init_db():
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                display_name TEXT NOT NULL,
                hashed_password TEXT NOT NULL,
                created_at TEXT DEFAULT (datetime('now')),
                last_login TEXT
            )
            """
        )
        conn.commit()


init_db()


def get_user_by_email(email: str) -> Optional[dict]:
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        row = conn.execute(
            "SELECT * FROM users WHERE email = ?",
            (email.lower(),),
        ).fetchone()
        return dict(row) if row else None


def create_user(email: str, display_name: str, password: str) -> dict:
    hashed = pwd_context.hash(password)
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.execute(
            "INSERT INTO users (email, display_name, hashed_password) VALUES (?, ?, ?)",
            (email.lower(), display_name.strip(), hashed),
        )
        conn.commit()
        return {
            "id": cursor.lastrowid,
            "email": email.lower(),
            "display_name": display_name.strip(),
        }


def update_last_login(user_id: int):
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            "UPDATE users SET last_login = datetime('now') WHERE id = ?",
            (user_id,),
        )
        conn.commit()


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(user_id: int, email: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    payload = {"sub": str(user_id), "email": email, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None
