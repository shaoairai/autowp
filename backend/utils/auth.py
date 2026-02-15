import functools
from datetime import datetime, timezone

import jwt
from flask import request, jsonify, current_app

from models.user import User


def create_token(user_id):
    """Create a JWT access token valid for 1 day."""
    payload = {
        'user_id': user_id,
        'exp': datetime.now(timezone.utc).timestamp() + current_app.config['JWT_ACCESS_TOKEN_EXPIRES'].total_seconds(),
        'iat': datetime.now(timezone.utc).timestamp(),
    }
    return jwt.encode(payload, current_app.config['SECRET_KEY'], algorithm='HS256')


def decode_token(token):
    """Decode and validate a JWT token. Returns payload dict or None."""
    try:
        payload = jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=['HS256'])
        return payload
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None


def get_current_user():
    """Extract current user from Authorization header."""
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        return None
    token = auth_header[7:]
    payload = decode_token(token)
    if not payload:
        return None
    return User.query.get(payload['user_id'])


def jwt_required(f):
    """Decorator that requires a valid JWT token."""
    @functools.wraps(f)
    def decorated(*args, **kwargs):
        user = get_current_user()
        if not user:
            return jsonify({'error': '未授權，請先登入'}), 401
        request.current_user = user
        return f(*args, **kwargs)
    return decorated


def admin_required(f):
    """Decorator that requires admin role."""
    @functools.wraps(f)
    def decorated(*args, **kwargs):
        user = get_current_user()
        if not user:
            return jsonify({'error': '未授權，請先登入'}), 401
        if user.role != 'admin':
            return jsonify({'error': '需要管理員權限'}), 403
        request.current_user = user
        return f(*args, **kwargs)
    return decorated
