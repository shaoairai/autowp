from cryptography.fernet import Fernet
from flask import current_app


def _get_fernet():
    key = current_app.config['ENCRYPTION_KEY']
    return Fernet(key.encode() if isinstance(key, str) else key)


def encrypt_value(plaintext):
    """Encrypt a string value using Fernet symmetric encryption."""
    if not plaintext:
        return None
    f = _get_fernet()
    return f.encrypt(plaintext.encode('utf-8')).decode('utf-8')


def decrypt_value(ciphertext):
    """Decrypt a Fernet-encrypted string."""
    if not ciphertext:
        return None
    f = _get_fernet()
    return f.decrypt(ciphertext.encode('utf-8')).decode('utf-8')
