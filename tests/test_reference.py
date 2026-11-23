import pytest
from reference import rsa_reference as reference
from reference.generate_vectors import generate, OUTPUT


def test_reference_supports_lecture_phi_and_crt():
    key = reference.generate_key(1024, inverse_modulus="phi")
    assert key.e * key.d % ((key.p-1)*(key.q-1)) == 1
    assert reference.decrypt_int(reference.encrypt_int(key.p, key), key, crt=True) == key.p
    with pytest.raises(ValueError):
        reference.generate_key(1024, inverse_modulus="invalid")


def test_reference_vectors_are_current_and_deterministic():
    assert generate() == generate() == OUTPUT.read_text(encoding="utf-8")


def test_fixed_bases_expose_strong_liars():
    liars = [a for a in range(2, 220) if reference.probable_prime(221, bases=(a,))]
    assert liars == [21, 47, 174, 200]
    assert not reference.probable_prime(561, bases=(2,))
