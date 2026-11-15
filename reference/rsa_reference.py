"""Educational RSA, written here rather than delegated to a crypto library.

Not constant time. Use only with demonstration data. OAEP follows RFC 8017,
SHA-256, MGF1-SHA-256, empty label. The library in requirements is a test oracle.
"""
from dataclasses import dataclass
import base64
import hashlib
import json
import math
import secrets
import time


def extended_gcd(a: int, b: int) -> tuple[int, int, int]:
    old_r, r, old_s, s, old_t, t = a, b, 1, 0, 0, 1
    while r:
        q = old_r // r
        old_r, r = r, old_r - q * r
        old_s, s = s, old_s - q * s
        old_t, t = t, old_t - q * t
    return old_r, old_s, old_t


def inverse(a: int, modulus: int) -> int:
    if modulus <= 1:
        raise ValueError("Modulus must be greater than one.")
    g, x, _ = extended_gcd(a, modulus)
    if g != 1:
        raise ValueError("These values have no modular inverse.")
    return x % modulus


def modexp(base: int, exponent: int, modulus: int) -> int:
    if exponent < 0 or modulus < 1:
        raise ValueError("Invalid exponent or modulus.")
    result, base = 1 % modulus, base % modulus
    while exponent:
        if exponent & 1:
            result = result * base % modulus
        base = base * base % modulus
        exponent >>= 1
    return result


SMALL_PRIMES = (2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47,
                53, 59, 61, 67, 71, 73, 79, 83, 89, 97)


def probable_prime(n: int, rounds: int = 64, *, bases: tuple[int, ...] | None = None) -> bool:
    if not 1 <= rounds <= 256 or (bases is not None and not bases):
        raise ValueError("Use 1..256 rounds or a nonempty tuple of bases.")
    if bases is not None and any(not 2 <= a <= n - 2 for a in bases):
        raise ValueError("Bases must lie between 2 and n-2.")
    if n < 2:
        return False
    # Explicit bases are the teaching Miller-Rabin test itself; bypass the sieve
    # so students can observe strong liars even for numbers with small factors.
    if bases is None:
        for p in SMALL_PRIMES:
            if n % p == 0:
                return n == p
    s, d = 0, n - 1
    while d % 2 == 0:
        s, d = s + 1, d // 2
    for index in range(len(bases) if bases is not None else rounds):
        a = bases[index] if bases is not None else secrets.randbelow(n - 3) + 2
        x = modexp(a, d, n)
        if x in (1, n - 1):
            continue
        for _ in range(s - 1):
            x = x * x % n
            if x == n - 1:
                break
        else:
            return False
    return True


def generate_prime(bits: int) -> tuple[int, int]:
    candidates = 0
    while True:
        candidates += 1
        n = secrets.randbits(bits) | (1 << (bits - 1)) | 1
        if math.gcd(65537, n - 1) == 1 and probable_prime(n):
            return n, candidates


@dataclass
class Key:
    p: int
    q: int
    e: int
    d: int
    candidates: int = 0
    elapsed_ms: float = 0

    @property
    def n(self):
        return self.p * self.q

    @property
    def size(self):
        return (self.n.bit_length() + 7) // 8

    @property
    def fingerprint(self):
        return hashlib.sha256(self.n.to_bytes(self.size, "big")).hexdigest()[:16]

    def public(self):
        return {"n": str(self.n), "e": str(self.e), "bits": self.n.bit_length(),
                "fingerprint": self.fingerprint, "candidates": self.candidates,
                "elapsed_ms": round(self.elapsed_ms, 2)}

    def private(self):
        return {"p": str(self.p), "q": str(self.q), "d": str(self.d),
                "phi": str((self.p - 1) * (self.q - 1)),
                "lambda": str(math.lcm(self.p - 1, self.q - 1))}


def generate_key(bits: int, *, inverse_modulus: str = "lambda") -> Key:
    if bits not in (1024, 2048):
        raise ValueError("Choose a 1024-bit or 2048-bit key.")
    if inverse_modulus not in ("lambda", "phi"):
        raise ValueError("Choose phi or lambda for the inverse modulus.")
    started, candidates = time.perf_counter(), 0
    while True:
        p, pc = generate_prime(bits // 2)
        q, qc = generate_prime(bits // 2)
        candidates += pc + qc
        if p == q or (p * q).bit_length() != bits:
            continue
        modulus = (p - 1) * (q - 1) if inverse_modulus == "phi" else math.lcm(p - 1, q - 1)
        d = inverse(65537, modulus)
        key = Key(p, q, 65537, d, candidates, (time.perf_counter() - started) * 1000)
        assert modexp(modexp(42, key.e, key.n), key.d, key.n) == 42
        return key


def encrypt_int(m: int, key: Key) -> int:
    if not 0 <= m < key.n:
        raise ValueError("Message integer must be between 0 and n - 1.")
    return modexp(m, key.e, key.n)


def decrypt_int(c: int, key: Key, crt: bool = False) -> int:
    if not 0 <= c < key.n:
        raise ValueError("Ciphertext integer must be between 0 and n - 1.")
    if not crt:
        return modexp(c, key.d, key.n)
    mp = modexp(c, key.d % (key.p - 1), key.p)
    mq = modexp(c, key.d % (key.q - 1), key.q)
    return mq + key.q * (inverse(key.q, key.p) * (mp - mq) % key.p)


def mgf1(seed: bytes, length: int) -> bytes:
    return b"".join(hashlib.sha256(seed + i.to_bytes(4, "big")).digest()
                    for i in range((length + 31) // 32))[:length]


def xor(a: bytes, b: bytes) -> bytes:
    return bytes(x ^ y for x, y in zip(a, b, strict=True))


def oaep_encode(message: bytes, size: int) -> bytes:
    if len(message) > size - 66:
        raise ValueError(f"OAEP-SHA256 accepts at most {size - 66} bytes with this key.")
    db = hashlib.sha256(b"").digest() + bytes(size - len(message) - 66) + b"\x01" + message
    seed = secrets.token_bytes(32)
    masked_db = xor(db, mgf1(seed, size - 33))
    return b"\x00" + xor(seed, mgf1(masked_db, 32)) + masked_db


def oaep_decode(encoded: bytes) -> bytes:
    failed = "Decryption failed. Check the key and ciphertext."
    if len(encoded) < 66:
        raise ValueError(failed)
    seed = xor(encoded[1:33], mgf1(encoded[33:], 32))
    db = xor(encoded[33:], mgf1(seed, len(encoded) - 33))
    if encoded[0] != 0 or not secrets.compare_digest(db[:32], hashlib.sha256(b"").digest()):
        raise ValueError(failed)
    remaining = db[32:]
    separator = remaining.find(b"\x01")
    if separator < 0 or any(remaining[:separator]):
        raise ValueError(failed)
    return remaining[separator + 1:]


def encrypt_bytes(message: bytes, key: Key, mode: str) -> bytes:
    if mode not in ("oaep", "textbook"):
        raise ValueError("Unknown encryption mode.")
    if mode == "oaep":
        encoded = oaep_encode(message, key.size)
    else:
        if len(message) > key.size - 1:
            raise ValueError(f"Textbook text mode accepts at most {key.size - 1} bytes.")
        encoded = message
    return encrypt_int(int.from_bytes(encoded, "big"), key).to_bytes(key.size, "big")


def decrypt_bytes(ciphertext: bytes, key: Key, mode: str, length: int = 0) -> bytes:
    if len(ciphertext) != key.size:
        raise ValueError("Ciphertext length does not match the key.")
    m = decrypt_int(int.from_bytes(ciphertext, "big"), key)
    if mode == "oaep":
        return oaep_decode(m.to_bytes(key.size, "big"))
    if mode != "textbook" or type(length) is not int or not 0 <= length < key.size:
        raise ValueError("Invalid textbook message length.")
    try:
        return m.to_bytes(length, "big")
    except OverflowError:
        raise ValueError("Message length or key does not match the ciphertext.") from None


def pack_cipher(ciphertext: bytes, key: Key, mode: str, length: int) -> str:
    body = {"v": 1, "mode": mode, "key": key.fingerprint,
            "ciphertext": base64.b64encode(ciphertext).decode()}
    if mode == "textbook":
        body["length"] = length
    return "rsa-lab.v1:" + base64.b64encode(json.dumps(body, separators=(",", ":")).encode()).decode()


def unpack_cipher(envelope: str, key: Key) -> tuple[bytes, str, int]:
    try:
        if not envelope.startswith("rsa-lab.v1:") or len(envelope) > 8192:
            raise ValueError()
        body = json.loads(base64.b64decode(envelope[11:], validate=True))
        if body.get("v") != 1 or body.get("key") != key.fingerprint:
            raise ValueError()
        mode = body["mode"]
        if mode not in ("oaep", "textbook"):
            raise ValueError()
        length = body.get("length", 0)
        if type(length) is not int or not 0 <= length < key.size:
            raise ValueError()
        cipher = base64.b64decode(body["ciphertext"], validate=True)
        if len(cipher) != key.size or int.from_bytes(cipher, "big") >= key.n:
            raise ValueError()
        return cipher, mode, length
    except (ValueError, TypeError, KeyError, AttributeError):
        raise ValueError("Invalid ciphertext envelope or a different key is selected.") from None
