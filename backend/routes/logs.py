from flask import Blueprint, request, jsonify

from models.auth_log import AuthLog
from models.user import User
from utils.auth import admin_required

logs_bp = Blueprint('logs', __name__)


@logs_bp.route('', methods=['GET'])
@admin_required
def list_logs():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)
    per_page = min(per_page, 200)

    query = AuthLog.query.order_by(AuthLog.created_at.desc())
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)

    logs = []
    for log in pagination.items:
        log_dict = log.to_dict()
        user = User.query.get(log.user_id)
        log_dict['email'] = user.email if user else None
        logs.append(log_dict)

    return jsonify({
        'logs': logs,
        'total': pagination.total,
        'page': pagination.page,
        'pages': pagination.pages,
    })
