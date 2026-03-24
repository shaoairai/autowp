from .auth import auth_bp
from .settings import settings_bp
from .generate import generate_bp
from .tasks import tasks_bp
from .logs import logs_bp
from .schedule import schedule_bp
from .keywords import keywords_bp
from .keyword_pool import keyword_pool_bp


def register_blueprints(app):
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(settings_bp, url_prefix='/api/settings')
    app.register_blueprint(generate_bp, url_prefix='/api/generate')
    app.register_blueprint(tasks_bp, url_prefix='/api/tasks')
    app.register_blueprint(logs_bp, url_prefix='/api/logs')
    app.register_blueprint(schedule_bp, url_prefix='/api/schedule')
    app.register_blueprint(keywords_bp, url_prefix='/api/keywords')
    app.register_blueprint(keyword_pool_bp, url_prefix='/api/keyword-pool')
