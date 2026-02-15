from datetime import datetime, timezone
from utils.database import db


class AuthLog(db.Model):
    __tablename__ = 'auth_logs'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    action = db.Column(db.String(20), nullable=False)  # login, logout, register
    ip_address = db.Column(db.String(45))
    user_agent = db.Column(db.String(512))
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'action': self.action,
            'ip_address': self.ip_address,
            'user_agent': self.user_agent,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
