import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()


class Config:
    SECRET_KEY = os.getenv('SECRET_KEY', 'change-me')
    SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_SECRET_KEY = os.getenv('SECRET_KEY', 'change-me')
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(days=1)
    ADMIN_EMAIL = os.getenv('ADMIN_EMAIL', 'pig543879@gmail.com')
    ADMIN_PASSWORD = os.getenv('ADMIN_PASSWORD')
    ENCRYPTION_KEY = os.getenv('ENCRYPTION_KEY')
