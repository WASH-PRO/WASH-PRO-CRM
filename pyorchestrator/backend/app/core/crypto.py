import base64
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.core.config import settings


def _derive_key() -> bytes:
    raw = settings.secret_master_key.encode()
    return raw[:32].ljust(32, b"0")[:32]


def encrypt_secret(plaintext: str) -> tuple[bytes, bytes]:
    nonce = os.urandom(12)
    aesgcm = AESGCM(_derive_key())
    ciphertext = aesgcm.encrypt(nonce, plaintext.encode(), None)
    return ciphertext, nonce


def decrypt_secret(ciphertext: bytes, nonce: bytes) -> str:
    aesgcm = AESGCM(_derive_key())
    return aesgcm.decrypt(nonce, ciphertext, None).decode()
