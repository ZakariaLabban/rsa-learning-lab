"""Generate PUBLIC educational fixtures; --check validates the committed fixture file."""
import argparse
import json
from math import gcd, isqrt
from pathlib import Path

from cryptography.hazmat.primitives.asymmetric import rsa

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'frontend/src/features/attacks/fixtures.json'
SIZES = (16, 20, 24, 28, 32, 40, 48, 52)


def next_prime(start):
    value = start | 1
    while any(value % d == 0 for d in range(3, isqrt(value) + 1, 2)) or gcd(value - 1, 17) != 1:
        value += 2
    return value


def tiny_fixture(bits):
    half = bits // 2
    p = next_prime((1 << half) - (1 << (half - 3)) - 11)
    q = next_prime((1 << half) - (1 << (half - 2)) + 13)
    n, e, message = p * q, 17, b'HI'
    assert p != q and n.bit_length() == bits
    return {'bits': bits, 'n': str(n), 'e': str(e), 'ciphertext': str(pow(int.from_bytes(message, 'big'), e, n)), 'message': message.decode(), 'byteLength': len(message)}


def parts(key):
    values = key.private_numbers()
    return {'p': str(values.p), 'q': str(values.q), 'e': str(values.public_numbers.e)}


def validate(value):
    assert value['factoring'] == [tiny_fixture(bits) for bits in SIZES]
    moduli = []
    for item in value['broadcast']:
        p, q, e = (int(item[name]) for name in ('p', 'q', 'e'))
        assert e == 3 and p != q and (p * q).bit_length() == 1024
        assert gcd(e, (p - 1) * (q - 1)) == 1
        # OpenSSL validates the private key, including primality and its relationships.
        d = pow(e, -1, (p - 1) * (q - 1))
        rsa.RSAPrivateNumbers(p, q, d, d % (p - 1), d % (q - 1), pow(q, -1, p), rsa.RSAPublicNumbers(e, p * q)).private_key()
        assert all(gcd(p * q, n) == 1 for n in moduli)
        moduli.append(p * q)
    assert len(moduli) == 3
    for bits, item in value['guessing'].items():
        p, q, e = (int(item[name]) for name in ('p', 'q', 'e'))
        assert (p * q).bit_length() == int(bits) and e == 65537
        d = pow(e, -1, (p - 1) * (q - 1))
        rsa.RSAPrivateNumbers(p, q, d, d % (p - 1), d % (q - 1), pow(q, -1, p), rsa.RSAPublicNumbers(e, p * q)).private_key()
    return value


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    if args.check:
        validate(json.loads(OUTPUT.read_text(encoding='utf-8')))
        print('Attack fixtures validated with the independent Python/OpenSSL reference.')
        return
    existing = json.loads((ROOT / 'reference/fixtures/public-test-keys.json').read_text(encoding='utf-8'))['keys'][0]
    demo = json.loads((ROOT / 'frontend/src/keyring/demo-keys.json').read_text(encoding='utf-8'))['keys'][0]
    value = {
        'warning': 'PUBLIC DEMONSTRATION KEYS. Private values are public; never use for real data.',
        'provenance': 'cryptography/OpenSSL generated 1024-bit e=3 keys; existing independent reference/demo keys for guessing; deterministic tiny semiprimes for factoring.',
        'factoring': [tiny_fixture(bits) for bits in SIZES],
        'broadcast': [parts(rsa.generate_private_key(public_exponent=3, key_size=1024)) for _ in range(3)],
        'guessing': {'1024': {name: existing[name] for name in ('p', 'q', 'e')}, '2048': {name: demo[name] for name in ('p', 'q', 'e')}},
    }
    validate(value)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(value, indent=2) + '\n', encoding='utf-8')
    print(OUTPUT)


if __name__ == '__main__':
    main()
