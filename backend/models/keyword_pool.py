from datetime import datetime, timezone
from utils.database import db


class KeywordPool(db.Model):
    __tablename__ = 'keyword_pool'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    keyword = db.Column(db.String(500), nullable=False)
    source = db.Column(db.String(20), nullable=False, default='manual')  # 'wp', 'research', 'manual'
    is_used = db.Column(db.Boolean, nullable=False, default=False)
    used_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'keyword': self.keyword,
            'source': self.source,
            'is_used': self.is_used,
            'used_at': self.used_at.isoformat() if self.used_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
