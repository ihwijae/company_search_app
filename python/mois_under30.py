import re

import xlwings as xw

from config_store import load_config
from formulas_store import get_management_rules


def _truncate(value, digits=2):
    factor = 10 ** digits
    return int(value * factor) / factor


def score_credit_from_table(grade: str, grade_table):
    g = str(grade).strip().upper()
    match = re.match(r"^([A-Z]{1,3}[0-9]?(?:[+-])?)", g)
    if match:
        g = match.group(1)
    for row in grade_table or []:
        if str(row.get("grade", "")).strip().upper() == g:
            return row.get("score")
    return None


def score_by_thresholds(value, thresholds, scale):
    if value is None:
        return None
    try:
        value = float(value)
    except Exception:
        return None
    for rule in thresholds or []:
        if "lt" in rule and value < rule["lt"]:
            return rule["score"]
        if "lte" in rule and value <= rule["lte"]:
            return rule["score"]
        if "gt" in rule and value > rule["gt"]:
            return rule["score"]
        if "gte" in rule and value >= rule["gte"]:
            return rule["score"]
        if "ltYears" in rule and value < rule["ltYears"]:
            return rule["score"]
        if "gteYears" in rule and value >= rule["gteYears"]:
            return rule["score"]
    return None


def compute_management_mois_under30(row, file_type, industry_avg):
    rules = get_management_rules("mois", 0)
    if not rules:
        return None
    method_selection = rules.get("methodSelection", "max")
    rounding = rules.get("rounding", {}) or {}
    methods = rules.get("methods", [])

    composite_score = None
    credit_score = None

    for method in methods:
        if method.get("id") == "composite":
            components = (method.get("components") or {})
            total = 0.0
            has_any = False
            for key, spec in components.items():
                if key == "debtRatio":
                    val = row.get("debtRatio")
                    avg = industry_avg[file_type]["debtRatio"]
                    base = (val / avg) if (val is not None and avg) else None
                    score = score_by_thresholds(base, spec.get("thresholds"), spec.get("scale"))
                elif key == "currentRatio":
                    val = row.get("currentRatio")
                    avg = industry_avg[file_type]["currentRatio"]
                    base = (val / avg) if (val is not None and avg) else None
                    score = score_by_thresholds(base, spec.get("thresholds"), spec.get("scale"))
                elif key == "bizYears":
                    score = score_by_thresholds(row.get("bizYears"), spec.get("thresholds"), spec.get("scale"))
                else:
                    score = None
                if score is not None:
                    total += float(score)
                    has_any = True
            if has_any:
                composite_score = total
        elif method.get("id") == "credit":
            grade_table = method.get("gradeTable", [])
            credit_score = score_credit_from_table(row.get("creditGrade", ""), grade_table)

    candidates = []
    if composite_score is not None:
        candidates.append(composite_score)
    if credit_score is not None:
        candidates.append(credit_score)
    if not candidates:
        return None
    if method_selection == "max":
        best = max(candidates)
    else:
        best = sum(candidates)
    best = min(15.0, max(0.0, best))
    digits = rounding.get("digits", 2)
    if rounding.get("method") == "truncate":
        return _truncate(best, digits)
    return round(best, digits)


def column_index_to_letter(index):
    result = ""
    while index > 0:
        index, rem = divmod(index - 1, 26)
        result = chr(65 + rem) + result
    return result


def apply_mois_under30(row_data, file_type):
    cfg = load_config()
    industry_avg = cfg["industryAverages"]

    book = xw.Book.caller()
    sht = book.sheets.active

    settings = cfg["mois_under30"]
    name_cols = settings["nameCols"]
    mgmt_cols = settings["managementCols"]
    perf_cols = settings["performanceCols"]
    sipyung_cols = settings.get("sipyungCols", [])

    active = book.app.selection
    col_letter = column_index_to_letter(active.column)
    row_num = active.row

    if col_letter not in name_cols:
        return False
    idx = name_cols.index(col_letter)

    mgmt = compute_management_mois_under30(row_data, file_type, industry_avg)
    if mgmt is not None:
        sht.range(f"{mgmt_cols[idx]}{row_num}").value = mgmt
    perf = row_data.get("perf5y")
    if perf is not None:
        sht.range(f"{perf_cols[idx]}{row_num}").value = perf
    sipyung = row_data.get("sipyung")
    if sipyung is not None and idx < len(sipyung_cols):
        sht.range(f"{sipyung_cols[idx]}{row_num}").value = sipyung
    return True
