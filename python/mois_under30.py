import re

import xlwings as xw

from config_store import load_config


def _truncate(value, digits=2):
    factor = 10 ** digits
    return int(value * factor) / factor


def score_debt_mois_under30(ratio: float):
    if ratio < 0.5:
        return 8.0
    if ratio < 0.75:
        return 7.2
    if ratio < 1.0:
        return 6.4
    if ratio < 1.25:
        return 5.6
    return 4.8


def score_current_mois_under30(ratio: float):
    if ratio >= 1.5:
        return 7.0
    if ratio >= 1.2:
        return 6.3
    if ratio >= 1.0:
        return 5.6
    if ratio >= 0.7:
        return 4.9
    return 4.2


def score_credit_mois_under30(grade: str):
    g = str(grade).strip().upper()
    if g in {"AAA", "AA+", "AA0", "AA-", "A+", "A0", "A-", "BBB+", "BBB0", "BBB-", "BB+", "BB0"}:
        return 15
    if g == "BB-":
        return 14
    if g in {"B+", "B0", "B-"}:
        return 13
    if g in {"CCC+", "CCC0", "CCC-", "CC", "C", "D"}:
        return 10
    return None


def compute_management_mois_under30(row, file_type, industry_avg):
    debt = row.get("debtRatio")
    current = row.get("currentRatio")
    debt_avg = industry_avg[file_type]["debtRatio"]
    current_avg = industry_avg[file_type]["currentRatio"]

    composite = 0.0
    if debt is not None and debt_avg:
        composite += score_debt_mois_under30(debt / debt_avg)
    if current is not None and current_avg:
        composite += score_current_mois_under30(current / current_avg)

    credit = score_credit_mois_under30(row.get("creditGrade", ""))
    best = max(composite, credit or 0)
    best = min(15.0, max(0.0, best))
    return _truncate(best, 2)


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
