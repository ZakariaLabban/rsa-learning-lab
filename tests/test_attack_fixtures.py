import json

from reference.generate_attack_fixtures import OUTPUT, validate


def test_attack_fixtures_match_independent_reference():
    validate(json.loads(OUTPUT.read_text(encoding='utf-8')))
