from flask import Blueprint, request, jsonify

from models.user import User
from models.auth_log import AuthLog
from utils.database import db
from utils.auth import create_token, jwt_required, get_current_user

auth_bp = Blueprint('auth', __name__)


def _log_action(user_id, action):
    log = AuthLog(
        user_id=user_id,
        action=action,
        ip_address=request.headers.get('X-Real-IP', request.remote_addr),
        user_agent=request.headers.get('User-Agent', '')[:512],
    )
    db.session.add(log)
    db.session.commit()


@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    if not data or not data.get('email') or not data.get('password'):
        return jsonify({'error': '請提供 email 和密碼'}), 400

    email = data['email'].strip().lower()
    password = data['password']

    if len(password) < 8:
        return jsonify({'error': '密碼至少需要 8 個字元'}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({'error': '此 Email 已被註冊'}), 409

    user = User(email=email, role='user')
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    _log_action(user.id, 'register')

    token = create_token(user.id)
    return jsonify({
        'access_token': token,
        'user': user.to_dict(),
    }), 201


@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data or not data.get('email') or not data.get('password'):
        return jsonify({'error': '請提供 email 和密碼'}), 400

    email = data['email'].strip().lower()
    user = User.query.filter_by(email=email).first()

    if not user or not user.check_password(data['password']):
        return jsonify({'error': 'Email 或密碼錯誤'}), 401

    _log_action(user.id, 'login')

    token = create_token(user.id)
    return jsonify({
        'access_token': token,
        'user': user.to_dict(),
    })


@auth_bp.route('/logout', methods=['POST'])
@jwt_required
def logout():
    user = request.current_user
    _log_action(user.id, 'logout')
    return jsonify({'message': '已登出'})


@auth_bp.route('/me', methods=['GET'])
@jwt_required
def me():
    return jsonify({'user': request.current_user.to_dict()})
