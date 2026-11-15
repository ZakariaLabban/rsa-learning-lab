"""Compatibility imports for the local API until browser parity (#45)."""
from reference.rsa_reference import (  # noqa: F401
    Key, SMALL_PRIMES, decrypt_bytes, decrypt_int, encrypt_bytes, encrypt_int,
    extended_gcd, generate_key, generate_prime, inverse, mgf1, modexp,
    oaep_decode, oaep_encode, pack_cipher, probable_prime, unpack_cipher, xor,
)
