import json
import os
import re
from pathlib import Path

import pandas as pd
import xlwings as xw
from PySide6 import QtWidgets, QtCore

BASE_DIR = Path(__file__).resolve().parent
CONFIG_PATH = BASE_DIR / "config.json"


def load_config():
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def save_config(cfg):
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)


def normalize_name(name: str) -> str:
    if not name:
        return ""
    name = str(name).strip().split("\n")[0]
    name = name.replace("(주)", "").replace("㈜", "").replace("주식회사", "")
    name = re.sub(r"\s*[0-9.,%].*$", "", name)
    return re.sub(r"\s+", " ", name).strip().lower()


def _to_number(val):
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return None
    s = str(val).replace(",", "").strip()
    if s == "":
        return None
    try:
        return float(s)
    except Exception:
        return None


def load_db(db_path: Path):
    wb = pd.ExcelFile(db_path)
    data = []
    relative_offsets = {
        "대표자": 1,
        "사업자번호": 2,
        "지역": 3,
        "시평": 4,
        "3년 실적": 5,
        "5년 실적": 6,
        "부채비율": 7,
        "유동비율": 8,
        "영업기간": 9,
        "신용평가": 10,
        "여성기업": 11,
        "중소기업": 12,
        "일자리창출": 13,
        "품질평가": 14,
        "비고": 15,
    }
    for sheet_name in wb.sheet_names:
        df = wb.parse(sheet_name, header=None)
        header_row = None
        for i in range(len(df)):
            val = str(df.iat[i, 0]) if pd.notna(df.iat[i, 0]) else ""
            if "회사명" in val:
                header_row = i
                break
        if header_row is None:
            continue

        for col in range(1, df.shape[1]):
            raw_name = df.iat[header_row, col]
            if pd.isna(raw_name):
                continue
            raw_name = str(raw_name).strip()
            if not raw_name:
                continue
            name = raw_name.split("\n")[0].strip()
            if not name:
                continue
            entry = {
                "name": name,
                "norm": normalize_name(name),
                "region": sheet_name.strip(),
                "bizNo": "",
                "debtRatio": None,
                "currentRatio": None,
                "perf5y": None,
                "creditGrade": "",
            }
            for key, offset in relative_offsets.items():
                r = header_row + offset
                if r >= df.shape[0]:
                    continue
                val = df.iat[r, col]
                if key in {"부채비율", "유동비율"} and isinstance(val, (int, float)) and not pd.isna(val):
                    val = val * 100
                if key == "사업자번호":
                    entry["bizNo"] = "" if pd.isna(val) else str(val).strip()
                elif key == "부채비율":
                    entry["debtRatio"] = _to_number(val)
                elif key == "유동비율":
                    entry["currentRatio"] = _to_number(val)
                elif key == "5년 실적":
                    entry["perf5y"] = _to_number(val)
                elif key == "신용평가":
                    entry["creditGrade"] = "" if pd.isna(val) else str(val).strip()
            data.append(entry)
    return data


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


def write_to_active_cell(value):
    book = xw.Book.caller()
    rng = book.app.selection
    rng.value = value


def apply_mois_under30(name_value, row_data, file_type):
    cfg = load_config()
    industry_avg = cfg["industryAverages"]

    book = xw.Book.caller()
    sht = book.sheets.active

    # Determine slot based on active cell column
    settings = cfg["mois_under30"]
    name_cols = settings["nameCols"]
    mgmt_cols = settings["managementCols"]
    perf_cols = settings["performanceCols"]

    active = book.app.selection
    col_letter = re.sub(r"\d", "", active.address.split("$")[-1])
    row_num = active.row

    if col_letter not in name_cols:
        return
    idx = name_cols.index(col_letter)

    mgmt = compute_management_mois_under30(row_data, file_type, industry_avg)
    if mgmt is not None:
        sht.range(f"{mgmt_cols[idx]}{row_num}").value = mgmt
    perf = row_data.get("perf5y")
    if perf is not None:
        sht.range(f"{perf_cols[idx]}{row_num}").value = perf


def open_modal():
    app = QtWidgets.QApplication.instance() or QtWidgets.QApplication([])

    cfg = load_config()
    db_path = Path(cfg.get("dbPath", ""))
    if not db_path.is_absolute():
        db_path = (BASE_DIR / db_path).resolve()

    if not db_path.exists():
        QtWidgets.QMessageBox.warning(None, "DB 경로", "DB 파일 경로를 설정하세요.")
        picked, _ = QtWidgets.QFileDialog.getOpenFileName(
            None,
            "업체 DB 선택",
            str(BASE_DIR),
            "Excel Files (*.xlsx)",
        )
        if not picked:
            return
        cfg["dbPath"] = os.path.relpath(picked, BASE_DIR)
        save_config(cfg)
        db_path = Path(picked)

    data = load_db(db_path)

    dialog = QtWidgets.QDialog()
    dialog.setWindowTitle("업체 검색")
    dialog.resize(720, 520)

    layout = QtWidgets.QVBoxLayout(dialog)
    status_label = QtWidgets.QLabel(f"DB: {db_path} (로드 {len(data)}건)")
    layout.addWidget(status_label)

    form = QtWidgets.QHBoxLayout()
    industry_box = QtWidgets.QComboBox()
    industry_box.addItems(["전기", "통신", "소방"])
    form.addWidget(QtWidgets.QLabel("공종"))
    form.addWidget(industry_box)

    query_input = QtWidgets.QLineEdit()
    form.addWidget(QtWidgets.QLabel("업체명"))
    form.addWidget(query_input)

    search_btn = QtWidgets.QPushButton("검색")
    form.addWidget(search_btn)

    config_btn = QtWidgets.QPushButton("DB 경로 설정")
    form.addWidget(config_btn)

    layout.addLayout(form)

    table = QtWidgets.QTableWidget(0, 3)
    table.setHorizontalHeaderLabels(["업체명", "지역", "사업자번호"])
    table.horizontalHeader().setStretchLastSection(True)
    layout.addWidget(table)

    def do_search():
        q = normalize_name(query_input.text())
        table.setRowCount(0)
        if not q:
            return
        for row in data:
            if q in row["norm"]:
                r = table.rowCount()
                table.insertRow(r)
                table.setItem(r, 0, QtWidgets.QTableWidgetItem(row["name"]))
                table.setItem(r, 1, QtWidgets.QTableWidgetItem(row["region"]))
                table.setItem(r, 2, QtWidgets.QTableWidgetItem(row.get("bizNo", "")))

    def apply_selected():
        selected = table.currentRow()
        if selected < 0:
            return
        name_val = table.item(selected, 0).text()
        region_val = table.item(selected, 1).text()
        biz_val = table.item(selected, 2).text()
        row_data = next((r for r in data if r["name"] == name_val and r["region"] == region_val), None)
        if not row_data:
            return
        # write name to active cell
        write_to_active_cell(name_val)

        file_type = {
            "전기": "eung",
            "통신": "tongsin",
            "소방": "sobang",
        }[industry_box.currentText()]
        apply_mois_under30(name_val, row_data, file_type)
        dialog.accept()

    def set_db_path():
        nonlocal data, db_path
        path, _ = QtWidgets.QFileDialog.getOpenFileName(dialog, "업체 DB 선택", str(BASE_DIR), "Excel Files (*.xlsx)")
        if not path:
            return
        cfg["dbPath"] = os.path.relpath(path, BASE_DIR)
        save_config(cfg)
        db_path = Path(path)
        data = load_db(db_path)
        status_label.setText(f"DB: {db_path} (로드 {len(data)}건)")

    search_btn.clicked.connect(do_search)
    query_input.returnPressed.connect(do_search)
    config_btn.clicked.connect(set_db_path)
    table.itemDoubleClicked.connect(lambda _: apply_selected())

    btns = QtWidgets.QHBoxLayout()
    apply_btn = QtWidgets.QPushButton("선택")
    close_btn = QtWidgets.QPushButton("닫기")
    btns.addStretch(1)
    btns.addWidget(apply_btn)
    btns.addWidget(close_btn)
    layout.addLayout(btns)

    apply_btn.clicked.connect(apply_selected)
    close_btn.clicked.connect(dialog.reject)

    dialog.exec()
