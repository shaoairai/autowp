from datetime import datetime, timezone
from utils.database import db


class Setting(db.Model):
    __tablename__ = 'settings'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), unique=True, nullable=False)
    anthropic_api_key_enc = db.Column(db.Text)
    hf_api_key_enc = db.Column(db.Text)
    wp_url = db.Column(db.String(255))
    wp_username = db.Column(db.String(100))
    wp_app_password_enc = db.Column(db.Text)
    resend_api_key_enc = db.Column(db.Text)
    notify_email = db.Column(db.String(255))
    smtp_host = db.Column(db.String(255))
    smtp_port = db.Column(db.Integer, default=587)
    smtp_email = db.Column(db.String(255))
    smtp_password_enc = db.Column(db.Text)
    custom_prompt = db.Column(db.Text)
    website_topic = db.Column(db.Text, nullable=True)
    auto_publish_author_bg = db.Column(db.Text, nullable=True)
    auto_publish_article_inst = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc),
                           onupdate=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'anthropic_api_key_enc': '********' if self.anthropic_api_key_enc else None,
            'hf_api_key_enc': '********' if self.hf_api_key_enc else None,
            'wp_url': self.wp_url,
            'wp_username': self.wp_username,
            'wp_app_password_enc': '********' if self.wp_app_password_enc else None,
            'resend_api_key_enc': '********' if self.resend_api_key_enc else None,
            'notify_email': self.notify_email,
            'smtp_host': self.smtp_host,
            'smtp_port': self.smtp_port,
            'smtp_email': self.smtp_email,
            'smtp_password_enc': '********' if self.smtp_password_enc else None,
            'custom_prompt': self.custom_prompt,
            'website_topic': self.website_topic,
            'auto_publish_author_bg': self.auto_publish_author_bg,
            'auto_publish_article_inst': self.auto_publish_article_inst,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
