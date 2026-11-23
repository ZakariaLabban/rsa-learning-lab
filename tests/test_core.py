import base64
import math
import random

import pytest
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding, rsa

from reference.rsa_reference import (Key, decrypt_bytes, decrypt_int, encrypt_bytes, encrypt_int,
                          extended_gcd, generate_key, inverse, modexp, oaep_decode,
                          pack_cipher, probable_prime, unpack_cipher)


@pytest.fixture(scope="session", params=[1024, 2048])
def key(request):
    return generate_key(request.param)


def test_arithmetic():
    rng = random.Random(632)
    for _ in range(100):
        a, b = rng.randrange(1, 10**8), rng.randrange(2, 10**8)
        g, x, y = extended_gcd(a, b)
        assert a*x + b*y == g == math.gcd(a, b)
        assert modexp(a, b, 100000007) == pow(a, b, 100000007)
        if g == 1:
            assert a * inverse(a, b) % b == 1
    with pytest.raises(ValueError):
        inverse(6, 9)
    assert modexp(3, 0, 1) == 0


@pytest.mark.parametrize("n", [-5, 0, 1, 4, 100, 341, 561, 1105, 1729, 3215031751])
def test_composites(n):
    assert not probable_prime(n)


@pytest.mark.parametrize("n", [2, 3, 5, 97, 101, 65537])
def test_primes(n):
    assert probable_prime(n)


def test_known_rsa():
    toy = Key(61, 53, 17, 2753)
    assert encrypt_int(65, toy) == 2790
    assert decrypt_int(2790, toy) == 65


def test_generated_key(key):
    assert key.n.bit_length() in (1024, 2048)
    assert key.p != key.q
    assert key.e * key.d % math.lcm(key.p - 1, key.q - 1) == 1
    for m in [0, 1, key.n - 1, key.p, key.q, 632]:
        c = encrypt_int(m, key)
        assert decrypt_int(c, key) == m
        assert decrypt_int(c, key, crt=True) == m
    for m in [-1, key.n]:
        with pytest.raises(ValueError):
            encrypt_int(m, key)


@pytest.mark.parametrize("mode", ["textbook", "oaep"])
@pytest.mark.parametrize("message", [b"", b"\x00\x00Hello", "مرحبا 🔐\nBob".encode()])
def test_encoding(key, mode, message):
    c = encrypt_bytes(message, key, mode)
    assert len(c) == key.size
    envelope = pack_cipher(c, key, mode, len(message))
    c2, mode2, length = unpack_cipher(envelope, key)
    assert decrypt_bytes(c2, key, mode2, length) == message


def test_boundaries_and_repeatability(key):
    for mode, capacity in [("textbook", key.size - 1), ("oaep", key.size - 66)]:
        message = b"a" * capacity
        c = encrypt_bytes(message, key, mode)
        assert decrypt_bytes(c, key, mode, len(message)) == message
        with pytest.raises(ValueError):
            encrypt_bytes(message + b"a", key, mode)
    assert encrypt_bytes(b"hello", key, "textbook") == encrypt_bytes(b"hello", key, "textbook")
    assert encrypt_bytes(b"hello", key, "oaep") != encrypt_bytes(b"hello", key, "oaep")


def test_independent_oaep_both_directions(key):
    reference = rsa.RSAPrivateNumbers(
        key.p, key.q, key.d, key.d % (key.p-1), key.d % (key.q-1),
        inverse(key.q, key.p), rsa.RSAPublicNumbers(key.e, key.n)
    ).private_key()
    scheme = padding.OAEP(mgf=padding.MGF1(hashes.SHA256()), algorithm=hashes.SHA256(), label=None)
    message = b"Independent interoperability check"
    ours = encrypt_bytes(message, key, "oaep")
    assert reference.decrypt(ours, scheme) == message
    theirs = reference.public_key().encrypt(message, scheme)
    assert decrypt_bytes(theirs, key, "oaep") == message


def test_malformed(key):
    cipher = bytearray(encrypt_bytes(b"hello", key, "oaep"))
    cipher[-1] ^= 1
    with pytest.raises(ValueError):
        decrypt_bytes(bytes(cipher), key, "oaep")
    for envelope in ["bad", "rsa-lab.v1:!!!", "rsa-lab.v1:" + base64.b64encode(b"[]").decode()]:
        with pytest.raises(ValueError):
            unpack_cipher(envelope, key)
    with pytest.raises(ValueError):
        oaep_decode(bytes(key.size))
    with pytest.raises(ValueError):
        decrypt_bytes(b"x", key, "oaep")
