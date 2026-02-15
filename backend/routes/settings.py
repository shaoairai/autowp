from flask import Blueprint, request, jsonify

from models.setting import Setting
from utils.database import db
from utils.auth import jwt_required
from utils.crypto import encrypt_value

settings_bp = Blueprint('settings', __name__)

# Fields that should be encrypted when stored
ENCRYPTED_FIELDS = {
    'anthropic_api_key': 'anthropic_api_key_enc',
    'hf_api_key': 'hf_api_key_enc',
    'wp_app_password': 'wp_app_password_enc',
    'resend_api_key': 'resend_api_key_enc',
    'smtp_password': 'smtp_password_enc',
}

# Fields stored in plain text
PLAIN_FIELDS = [
    'wp_url', 'wp_username',
    'notify_email',
    'smtp_host', 'smtp_port', 'smtp_email',
    'custom_prompt',
]


@settings_bp.route('', methods=['GET'])
@jwt_required
def get_settings():
    user = request.current_user
    setting = Setting.query.filter_by(user_id=user.id).first()
    if not setting:
        return jsonify({'settings': None})
    return jsonify({'settings': setting.to_dict()})


@settings_bp.route('', methods=['PUT'])
@jwt_required
def update_settings():
    user = request.current_user
    data = request.get_json()
    if not data:
        return jsonify({'error': '請提供設定資料'}), 400

    setting = Setting.query.filter_by(user_id=user.id).first()
    if not setting:
        setting = Setting(user_id=user.id)
        db.session.add(setting)

    # Handle encrypted fields
    for input_key, db_field in ENCRYPTED_FIELDS.items():
        if input_key in data:
            value = data[input_key]
            if value:
                setattr(setting, db_field, encrypt_value(value))
            else:
                setattr(setting, db_field, None)

    # Handle plain text fields
    for field in PLAIN_FIELDS:
        if field in data:
            setattr(setting, field, data[field])

    db.session.commit()
    return jsonify({'settings': setting.to_dict()})
