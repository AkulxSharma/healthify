import json
from functools import lru_cache
from pathlib import Path
from typing import Any


def _config_path() -> Path:
    return Path(__file__).resolve().parents[1] / "config" / "scoring_rules.json"


@lru_cache(maxsize=1)
def get_scoring_rules() -> dict[str, Any]:
    path = _config_path()
    if not path.exists():
        return {}
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def update_scoring_rules(payload: dict[str, Any]) -> dict[str, Any]:
    path = _config_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as file:
        json.dump(payload, file, indent=2, sort_keys=True)
    get_scoring_rules.cache_clear()
    return payload
