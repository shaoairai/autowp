from .auth import auth_bp
from .settings import settings_bp
from .generate import generate_bp
from .tasks import tasks_bp
from .logs import logs_bp


def register_blueprints(app):
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(settings_bp, url_prefix='/api/settings')
    app.register_blueprint(generate_bp, url_prefix='/api/generate')
    app.register_blueprint(tasks_bp, url_prefix='/api/tasks')
    app.register_blueprint(logs_bp, url_prefix='/api/logs')
