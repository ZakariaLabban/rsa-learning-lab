import copy
import json

import pytest

from reference.check_ts_outputs import FIXTURES, OUTPUTS, check


def load():
    return (json.loads(OUTPUTS.read_text(encoding="utf-8")),
            json.loads(FIXTURES.read_text(encoding="utf-8")))


def test_typescript_outputs_verify_with_cryptography():
    outputs, fixtures = load()
    check(outputs, fixtures)


@pytest.mark.parametrize("field", ["oaep_ciphertext_hex", "pss_signature_hex"])
def test_altered_typescript_outputs_are_rejected(field):
    outputs, fixtures = load()
    changed = copy.deepcopy(outputs)
    value = bytearray.fromhex(changed["assignment"][0][field])
    value[-1] ^= 1
    changed["assignment"][0][field] = value.hex()
    with pytest.raises(Exception):
        check(changed, fixtures)


def test_wrong_fingerprint_is_rejected():
    outputs, fixtures = load()
    changed = copy.deepcopy(outputs)
    changed["assignment"][1]["fingerprint"] = "0" * 64
    with pytest.raises(AssertionError):
        check(changed, fixtures)
