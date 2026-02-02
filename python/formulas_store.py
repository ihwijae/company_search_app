import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
FORMULAS_PATH = BASE_DIR / "formulas.defaults.json"

_CACHE = {"data": None}


def load_formulas():
    if _CACHE["data"] is None:
        _CACHE["data"] = json.loads(FORMULAS_PATH.read_text(encoding="utf-8"))
    return _CACHE["data"]


def get_agency(agency_id):
    data = load_formulas()
    token = str(agency_id or "").strip().lower()
    for agency in data.get("agencies", []):
        if str(agency.get("id", "")).strip().lower() == token:
            return agency
    return None


def get_tier_by_amount(agency_id, amount):
    agency = get_agency(agency_id)
    if not agency:
        return None
    tiers = agency.get("tiers", [])
    if not tiers:
        return None
    try:
        amount = float(amount)
    except Exception:
        amount = 0
    for tier in tiers:
        min_amount = tier.get("minAmount", 0) or 0
        max_amount = tier.get("maxAmount", None)
        if max_amount is None:
            if amount >= min_amount:
                return tier
        else:
            if amount >= min_amount and amount < max_amount:
                return tier
    return tiers[0]


def get_management_rules(agency_id, amount):
    tier = get_tier_by_amount(agency_id, amount)
    if not tier:
        return None
    return (tier.get("rules") or {}).get("management")
