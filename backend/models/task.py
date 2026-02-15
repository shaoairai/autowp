from datetime import datetime, timezone
from utils.database import db


class Task(db.Model):
    __tablename__ = 'tasks'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    keyword = db.Column(db.String(255), nullable=False)
    title = db.Column(db.String(255))
    direction = db.Column(db.Text)
    material = db.Column(db.Text)
    status = db.Column(db.String(20), nullable=False, default='pending')
    current_step = db.Column(db.String(50))
    steps_detail = db.Column(db.JSON, default=dict)
    result = db.Column(db.JSON, default=dict)
    error_message = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc),
                           onupdate=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'keyword': self.keyword,
            'title': self.title,
            'direction': self.direction,
            'material': self.material,
            'status': self.status,
            'current_step': self.current_step,
            'steps_detail': self.steps_detail,
            'result': self.result,
            'error_message': self.error_message,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
