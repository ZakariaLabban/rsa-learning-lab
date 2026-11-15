"""Reproduce committed vectors from fixed PUBLIC TEST fixtures.

Run from the repo root: python -m reference.generate_vectors [--check].
Only --init-fixtures creates randomized library fixtures; normal runs reuse
committed keys/ciphertexts/signatures and produce byte-identical JSON.
"""
import argparse
import json
import math
from pathlib import Path

import cryptography
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding, rsa

from .rsa_reference import Key, decrypt_bytes, extended_gcd, probable_prime

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / "reference/fixtures/public-test-keys.json"
OUTPUT = ROOT / "frontend/src/engine/__vectors__/reference-vectors.json"
OAEP = padding.OAEP(mgf=padding.MGF1(hashes.SHA256()), algorithm=hashes.SHA256(), label=None)
PSS = padding.PSS(mgf=padding.MGF1(hashes.SHA256()), salt_length=32)


def initialize():
    if FIXTURES.exists():
        raise SystemExit("Fixtures already exist; refusing to replace committed test keys.")
    fixtures = []
    for bits in (1024, 2048):
        private = rsa.generate_private_key(public_exponent=65537, key_size=bits)
        numbers = private.private_numbers()
        message = "Reference: مرحبا 🔐".encode()
        fixtures.append({
            "bits": bits,
            **{name: str(value) for name, value in {
                "p": numbers.p, "q": numbers.q, "e": numbers.public_numbers.e,
                "d": numbers.d, "n": numbers.public_numbers.n}.items()},
            "message_hex": message.hex(),
            "oaep_ciphertext_hex": private.public_key().encrypt(message, OAEP).hex(),
            "pss_signature_hex": private.sign(message, PSS, hashes.SHA256()).hex(),
        })
    FIXTURES.parent.mkdir(parents=True, exist_ok=True)
    FIXTURES.write_text(json.dumps({"warning": "PUBLIC TEST KEYS: NEVER USE FOR REAL DATA", "library": f"cryptography {cryptography.__version__}", "keys": fixtures}, indent=2) + "\n", encoding="utf-8")


def generate():
    fixture = json.loads(FIXTURES.read_text(encoding="utf-8"))
    vectors = {"schema": "rsa-lab-reference-v1", "provenance": fixture["library"],
               "warning": fixture["warning"], "modexp": [], "inverse": [],
               "euclid": [], "miller_rabin": [], "keys": []}
    for a, b, n in [(7, 560, 561), (0, 0, 1), (-17, 13, 187), (65, 17, 3233),
                    (123456789, 65537, 999999937), (2**127-1, 2**64+1, 2**255-19)]:
        vectors["modexp"].append(dict(base=str(a), exponent=str(b), modulus=str(n), result=str(pow(a, b, n))))
    for a, m in [(7, 160), (17, 3120), (-7, 160), (6, 9), (0, 17), (65537, 999999936)]:
        vectors["inverse"].append(dict(a=str(a), modulus=str(m), result=str(pow(a, -1, m)) if math.gcd(a,m)==1 else None))
        g, x, y = extended_gcd(a, m)
        assert g == math.gcd(a,m) and a*x + m*y == g
        vectors["euclid"].append(dict(a=str(a), b=str(m), gcd=str(g)))
    for n in (29, 221, 561, 1105, 1729, 65537, 3215031751):
        bases = (2, 3, 5, 7, 11)
        vectors["miller_rabin"].append(dict(n=str(n), bases=[str(a) for a in bases], probable_prime=probable_prime(n,bases=bases)))
    for raw in fixture["keys"]:
        p,q,e,d,n = (int(raw[name]) for name in ("p","q","e","d","n"))
        key = Key(p,q,e,d)
        private = rsa.RSAPrivateNumbers(p,q,d,d%(p-1),d%(q-1),pow(q,-1,p),rsa.RSAPublicNumbers(e,n)).private_key()
        message = bytes.fromhex(raw["message_hex"])
        assert private.decrypt(bytes.fromhex(raw["oaep_ciphertext_hex"]), OAEP) == message
        assert decrypt_bytes(bytes.fromhex(raw["oaep_ciphertext_hex"]), key, "oaep") == message
        private.public_key().verify(bytes.fromhex(raw["pss_signature_hex"]),message,PSS,hashes.SHA256())
        phi=(p-1)*(q-1)
        vectors["keys"].append({**raw, "phi": str(phi), "lambda":str(math.lcm(p-1,q-1)),
            "d_phi":str(pow(e,-1,phi)), "textbook": [dict(message=str(m),ciphertext=str(pow(m,e,n))) for m in (0,1,65,p,q,n-1)]})
    return json.dumps(vectors, indent=2, ensure_ascii=False) + "\n"


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--init-fixtures",action="store_true")
    parser.add_argument("--check",action="store_true")
    args=parser.parse_args()
    if args.init_fixtures: initialize()
    expected=generate()
    if args.check:
        if not OUTPUT.exists() or OUTPUT.read_text(encoding="utf-8") != expected:
            raise SystemExit("Reference vectors differ. Run python -m reference.generate_vectors and review the diff.")
        print("Committed vectors are reproducible; library OAEP/PSS fixtures verified.")
    else:
        OUTPUT.parent.mkdir(parents=True,exist_ok=True)
        OUTPUT.write_text(expected,encoding="utf-8")
        print(f"Wrote {OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__": main()
