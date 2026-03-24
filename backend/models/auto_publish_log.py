from datetime import datetime, timezone
from utils.database import db


class AutoPublishLog(db.Model):
    __tablename__ = 'auto_publish_logs'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    check_date = db.Column(db.String(10), nullable=False)  # 'YYYY-MM-DD' in UTC+8
    status = db.Column(db.String(20), nullable=False)  # 'skipped'/'no_keyword'/'success'/'failed'
    keyword = db.Column(db.String(255), nullable=True)
    task_id = db.Column(db.Integer, db.ForeignKey('tasks.id'), nullable=True)
    note = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'check_date': self.check_date,
            'status': self.status,
            'keyword': self.keyword,
            'task_id': self.task_id,
            'note': self.note,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
