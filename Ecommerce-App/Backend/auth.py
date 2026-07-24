import jwt
import os
from functools import wraps
from flask import request, jsonify
from model import User
from datetime import datetime, timedelta, timezone
from jwt import ExpiredSignatureError, InvalidTokenError

# Secret key for JWT encoding/decoding
SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'fallback_secret_key_for_development')


# ═══════════════════════════════════════════════════════════════
# JWT CORE
# ═══════════════════════════════════════════════════════════════

def generate_token(user_id):
    now = datetime.now(timezone.utc)

    payload = {
        "user_id": user_id,
        "iat": now,
        "exp": now + timedelta(hours=24),
    }

    token = jwt.encode(payload, SECRET_KEY, algorithm="HS256")

    if isinstance(token, bytes):
        token = token.decode("utf-8")

    return token


def decode_token(token):
    if not token:
        return None

    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=["HS256"],
            options={"require": ["exp", "iat"]},
        )

        if "user_id" not in payload:
            return None

        return payload

    except ExpiredSignatureError:
        return None

    except InvalidTokenError:
        return None


def get_current_user():
    auth_header = request.headers.get('Authorization')
    if not auth_header:
        return None

    try:
        token = auth_header.split(' ')[1]
    except IndexError:
        return None

    payload = decode_token(token)
    if not payload:
        return None

    return User.query.get(payload.get("user_id"))


# ═══════════════════════════════════════════════════════════════
# BASE AUTH DECORATORS (EXISTING)
# ═══════════════════════════════════════════════════════════════

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        user = get_current_user()
        if not user:
            return jsonify({'error': 'Authentication required'}), 401
        return f(*args, **kwargs)
    return decorated


def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        user = get_current_user()
        if not user:
            return jsonify({'error': 'Authentication required'}), 401
        if not user.is_admin:
            return jsonify({'error': 'Admin privileges required'}), 403
        return f(*args, **kwargs)
    return decorated


# ═══════════════════════════════════════════════════════════════
# DELIVERY ROLE DECORATORS (NEW)
# ═══════════════════════════════════════════════════════════════

def delivery_man_required(f):
    """Only delivery men can access"""
    @wraps(f)
    def decorated(*args, **kwargs):
        user = get_current_user()
        if not user:
            return jsonify({"error": "Authentication required"}), 401
        if user.role != "delivery_man":
            return jsonify({"error": "Delivery man access required"}), 403
        return f(*args, **kwargs)
    return decorated


def delivery_or_admin_required(f):
    """Admin + delivery man allowed"""
    @wraps(f)
    def decorated(*args, **kwargs):
        user = get_current_user()
        if not user:
            return jsonify({"error": "Authentication required"}), 401
        if user.role not in ("delivery_man", "admin"):
            return jsonify({"error": "Access restricted"}), 403
        return f(*args, **kwargs)
    return decorated


# ═══════════════════════════════════════════════════════════════
# ROLE HELPERS (FOR REGISTER LOGIC)
# ═══════════════════════════════════════════════════════════════

ALLOWED_ROLES = {"customer", "delivery_man"}


def pick_role(data: dict) -> str:
    """
    Validate role during registration.
    NOTE: admin cannot self-register.
    """
    role = data.get("role", "customer")

    if isinstance(role, str):
        role = role.strip().lower()
    else:
        role = "customer"

    if role not in ALLOWED_ROLES:
        role = "customer"

    return role