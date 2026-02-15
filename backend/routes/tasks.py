from flask import Blueprint, request, jsonify

from models.task import Task
from utils.auth import jwt_required

tasks_bp = Blueprint('tasks', __name__)


@tasks_bp.route('', methods=['GET'])
@jwt_required
def list_tasks():
    user = request.current_user
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    per_page = min(per_page, 100)

    query = Task.query.filter_by(user_id=user.id).order_by(Task.created_at.desc())
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        'tasks': [t.to_dict() for t in pagination.items],
        'total': pagination.total,
        'page': pagination.page,
        'pages': pagination.pages,
    })


@tasks_bp.route('/<int:task_id>', methods=['GET'])
@jwt_required
def get_task(task_id):
    user = request.current_user
    task = Task.query.filter_by(id=task_id, user_id=user.id).first()
    if not task:
        return jsonify({'error': '找不到此任務'}), 404
    return jsonify({'task': task.to_dict()})
