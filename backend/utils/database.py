from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


def init_db(app):
    """Initialize database and create tables."""
    # Dispose any pre-fork connections so each worker creates fresh ones
    app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
        'pool_pre_ping': True,
    }
    db.init_app(app)
    with app.app_context():
        from models import User, AuthLog, Task, Setting  # noqa: F401
        db.create_all()
        _seed_admin(app)
        # Dispose connections created during init so workers start fresh
        db.engine.dispose()


def _seed_admin(app):
    """Create admin user if not exists."""
    from models import User
    admin_email = app.config.get('ADMIN_EMAIL', 'pig543879@gmail.com')
    admin_password = app.config.get('ADMIN_PASSWORD')
    if not admin_password:
        return

    existing = User.query.filter_by(email=admin_email).first()
    if not existing:
        admin = User(email=admin_email, role='admin')
        admin.set_password(admin_password)
        db.session.add(admin)
        db.session.commit()
