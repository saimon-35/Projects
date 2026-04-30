import jwt
import os
from functools import wraps
from flask import request, jsonify
from model import User
from datetime import datetime, timedelta, timezone
from jwt import ExpiredSignatureError, InvalidTokenError

# Secret key for JWT encoding/decoding
SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'fallback_secret_key_for_development')

def generate_token(user_id):
    """Generate a JWT token for a user"""

    now = datetime.now(timezone.utc)

    payload = {
        "user_id": user_id,
        "iat": now,
        "exp": now + timedelta(hours=24),
    }

    token = jwt.encode(payload, SECRET_KEY, algorithm="HS256")

    # PyJWT may return bytes in some versions
    if isinstance(token, bytes):
        token = token.decode("utf-8")

    return token


def decode_token(token):
    """Decode a JWT token and return the payload"""

    if not token:
        return None

    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=["HS256"],
            options={"require": ["exp", "iat"]},
        )

        # Validate required fields
        if "user_id" not in payload:
            return None

        return payload

    except ExpiredSignatureError:
        return None  # Token expired

    except InvalidTokenError:
        return None  # Invalid token
    
    
def get_current_user():
    """Get the current user from the request authorization header"""
    auth_header = request.headers.get('Authorization')
    if not auth_header:
        return None
    
    try:
        # Expected format: "Bearer <token>"
        token = auth_header.split(' ')[1]
    except IndexError:
        return None
    
    payload = decode_token(token)
    if not payload:
        return None
    
    user_id = payload.get('user_id')
    if not user_id:
        return None
    
    return User.query.get(user_id)

def token_required(f):
    """Decorator to require a valid JWT token for a route"""
    @wraps(f)
    def decorated(*args, **kwargs):
        user = get_current_user()
        if not user:
            return jsonify({'error': 'Authentication required'}), 401
        return f(*args, **kwargs)
    return decorated

def admin_required(f):
    """Decorator to require admin privileges"""
    @wraps(f)
    def decorated(*args, **kwargs):
        user = get_current_user()
        if not user:
            return jsonify({'error': 'Authentication required'}), 401
        if not user.is_admin:
            return jsonify({'error': 'Admin privileges required'}), 403
        return f(*args, **kwargs)
    return decorated