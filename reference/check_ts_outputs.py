"""Verify TypeScript engine outputs with the independent `cryptography` library.

Run from the repo root: python -m reference.check_ts_outputs
Reads frontend/src/engine/__vectors__/ts-outputs.json (written by `npm run vectors:ts`)
and checks, for every PUBLIC TEST key:
- the public-key fingerprint matches docs/envelope-v2.md,
- OAEP ciphertexts (raw and inside v2 envelopes) decrypt with cryptography's RSA-OAEP,
- multi-block textbook envelopes decrypt with plain pow() and the documented chunking,
- PSS signatures verify with cryptography's RSA-PSS (SHA-256, MGF1-SHA256, salt 32),
- the lecture teaching key's textbook number and hash-mod-n signature.
"""
import base64
import hashlib
import json
import sys
from pathlib import Path

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding, rsa

ROOT = Path(__file__).resolve().parents[1]
OUTPUTS = ROOT / "frontend/src/engine/__vectors__/ts-outputs.json"
FIXTURES = ROOT / "reference/fixtures/public-test-keys.json"
OAEP = padding.OAEP(mgf=padding.MGF1(hashes.SHA256()), algorithm=hashes.SHA256(), label=None)
PSS = padding.PSS(mgf=padding.MGF1(hashes.SHA256()), salt_length=32)
PREFIX = "rsa-lab.v2:"


def minimal(value):
    return value.to_bytes((value.bit_length() + 7) // 8, "big")


def fingerprint(n, e):
    n_bytes, e_bytes = minimal(n), minimal(e)
    data = (b"rsa-lab.key.v2\0" + len(n_bytes).to_bytes(4, "big") + n_bytes
            + len(e_bytes).to_bytes(4, "big") + e_bytes)
    return hashlib.sha256(data).hexdigest()


def envelope(text):
    assert text.startswith(PREFIX), "missing v2 prefix"
    raw = base64.b64decode(text[len(PREFIX):], validate=True).decode("utf-8")
    value = json.loads(raw)
    assert json.dumps(value, separators=(",", ":"), ensure_ascii=False) == raw, "noncanonical JSON"
    assert value["v"] == 2
    return value


def private_key(raw):
    p, q, e, d, n = (int(raw[name]) for name in ("p", "q", "e", "d", "n"))
    public = rsa.RSAPublicNumbers(e, n)
    numbers = rsa.RSAPrivateNumbers(p, q, d, d % (p - 1), d % (q - 1), pow(q, -1, p), public)
    return numbers.private_key(), (p, q, e, d, n)


def check(outputs, fixtures):
    keys = {int(raw["bits"]): raw for raw in fixtures["keys"]}
    assert outputs["schema"] == "rsa-lab-ts-outputs-v1"
    assert {item["bits"] for item in outputs["assignment"]} == {1024, 2048}
    for item in outputs["assignment"]:
        private, (p, q, e, d, n) = private_key(keys[item["bits"]])
        width = (n.bit_length() + 7) // 8
        assert (int(item["n"]), int(item["e"])) == (n, e), "TS used a different key"
        assert item["fingerprint"] == fingerprint(n, e), "fingerprint differs from the spec"
        message = bytes.fromhex(item["message_hex"])

        assert private.decrypt(bytes.fromhex(item["oaep_ciphertext_hex"]), OAEP) == message
        oaep = envelope(item["oaep_envelope"])
        assert (oaep["kind"], oaep["recipient"], oaep["bits"]) == ("oaep", item["fingerprint"], item["bits"])
        assert private.decrypt(base64.b64decode(oaep["ciphertext"]), OAEP) == message

        textbook = envelope(item["textbook_envelope"])
        assert textbook["kind"] == "textbook-blocks" and textbook["recipient"] == item["fingerprint"]
        chunk, length = width - 1, textbook["byteLength"]
        assert len(textbook["blocks"]) == max(1, -(-length // chunk)) > 1, "expected several blocks"
        recovered = b""
        for i, block in enumerate(textbook["blocks"]):
            cipher = base64.b64decode(block)
            assert len(cipher) == width
            size = min(chunk, length - i * chunk)
            recovered += pow(int.from_bytes(cipher, "big"), d, n).to_bytes(size, "big")
        assert recovered == bytes.fromhex(item["textbook_message_hex"])

        private.public_key().verify(bytes.fromhex(item["pss_signature_hex"]), message, PSS, hashes.SHA256())

    t = outputs["teaching"]
    p, q, e = int(t["p"]), int(t["q"]), int(t["e"])
    n, phi = p * q, (p - 1) * (q - 1)
    d = pow(e, -1, phi)
    assert (n, d) == (187, 23), "lecture key changed"
    assert pow(int(t["number"]["message"]), e, n) == int(t["number"]["ciphertext"]) == 11
    s = t["signature"]
    digest = int.from_bytes(hashlib.sha256(bytes.fromhex(s["message_hex"])).digest(), "big") % n
    assert int(s["digest"]) == digest
    assert pow(digest, d, n) == int(s["signature"]) and pow(int(s["signature"]), e, n) == digest


def main():
    outputs = json.loads(OUTPUTS.read_text(encoding="utf-8"))
    fixtures = json.loads(FIXTURES.read_text(encoding="utf-8"))
    try:
        check(outputs, fixtures)
    except Exception as error:  # report any mismatch as a failing check
        print(f"TypeScript outputs FAILED independent verification: {error!r}", file=sys.stderr)
        raise SystemExit(1)
    print("TypeScript OAEP, PSS, textbook, fingerprint and teaching outputs verified by cryptography.")


if __name__ == "__main__":
    main()
