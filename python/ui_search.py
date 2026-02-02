import os
from pathlib import Path

import xlwings as xw
from PySide6 import QtWidgets, QtCore

from config_store import BASE_DIR, load_config, save_config
from db_loader import load_db_cached, load_db_stats
from mois_under30 import apply_mois_under30
from text_utils import normalize_name, sanitize_company_name


_DIALOG = None


def write_to_active_cell(value):
    book = xw.Book.caller()
    rng = book.app.selection
    rng.value = value


def open_modal():
    global _DIALOG
    app = QtWidgets.QApplication.instance() or QtWidgets.QApplication([])

    if _DIALOG is not None and _DIALOG.isVisible():
        _DIALOG.activateWindow()
        _DIALOG.raise_()
        return

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

    data = load_db_cached(db_path)

    dialog = QtWidgets.QDialog()
    dialog.setWindowTitle("업체 검색")
    dialog.resize(720, 520)
    dialog.setWindowModality(QtCore.Qt.NonModal)
    dialog.setAttribute(QtCore.Qt.WA_DeleteOnClose, True)
    _DIALOG = dialog

    layout = QtWidgets.QVBoxLayout(dialog)
    status_label = QtWidgets.QLabel(f"DB: {db_path} (로드 {len(data)}건)")
    cell_label = QtWidgets.QLabel("셀: -")
    layout.addWidget(status_label)
    layout.addWidget(cell_label)

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

    verify_btn = QtWidgets.QPushButton("DB 경로 확인")
    form.addWidget(verify_btn)

    reload_btn = QtWidgets.QPushButton("DB 재로드")
    form.addWidget(reload_btn)

    diag_btn = QtWidgets.QPushButton("DB 진단")
    form.addWidget(diag_btn)

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
        row_data = next((r for r in data if r["name"] == name_val and r["region"] == region_val), None)
        if not row_data:
            return
        clean_name = sanitize_company_name(name_val) or name_val
        manager_name = row_data.get("managerName", "")
        display_name = f"{clean_name}\n{manager_name}".strip() if manager_name else clean_name
        write_to_active_cell(display_name)

        file_type = {
            "전기": "eung",
            "통신": "tongsin",
            "소방": "sobang",
        }[industry_box.currentText()]
        apply_mois_under30(row_data, file_type)

    def set_db_path():
        nonlocal data, db_path
        path, _ = QtWidgets.QFileDialog.getOpenFileName(dialog, "업체 DB 선택", str(BASE_DIR), "Excel Files (*.xlsx)")
        if not path:
            return
        cfg["dbPath"] = os.path.relpath(path, BASE_DIR)
        save_config(cfg)
        db_path = Path(path)
        data = load_db_cached(db_path, force=True)
        status_label.setText(f"DB: {db_path} (로드 {len(data)}건)")
        QtWidgets.QMessageBox.information(dialog, "DB 경로", f"설정됨:\n{db_path}\n로드 {len(data)}건")

    def verify_db_path():
        exists = db_path.exists()
        mtime = db_path.stat().st_mtime if exists else None
        msg = f"경로: {db_path}\n존재: {'예' if exists else '아니오'}\n로드 {len(data)}건"
        if mtime:
            msg += f"\n수정시간: {QtCore.QDateTime.fromSecsSinceEpoch(int(mtime)).toString('yyyy-MM-dd HH:mm:ss')}"
        QtWidgets.QMessageBox.information(dialog, "DB 경로 확인", msg)

    def reload_db():
        nonlocal data
        if not db_path.exists():
            QtWidgets.QMessageBox.warning(dialog, "DB 재로드", "DB 파일 경로가 유효하지 않습니다.")
            return
        data = load_db_cached(db_path, force=True)
        status_label.setText(f"DB: {db_path} (로드 {len(data)}건)")
        QtWidgets.QMessageBox.information(dialog, "DB 재로드", f"재로드 완료\n로드 {len(data)}건")

    def run_db_diagnosis():
        if not db_path.exists():
            QtWidgets.QMessageBox.warning(dialog, "DB 진단", "DB 파일 경로가 유효하지 않습니다.")
            return
        total, stats = load_db_stats(db_path)
        stats.sort(key=lambda x: x[1], reverse=True)
        lines = [f"총 {total}건"]
        preview = stats[:15]
        for sheet_name, count in preview:
            lines.append(f"- {sheet_name}: {count}건")
        if len(stats) > len(preview):
            lines.append(f"... 그 외 {len(stats) - len(preview)}개 시트")
        msg = "\n".join(lines)
        with open(BASE_DIR / "debug_log.txt", "a", encoding="utf-8") as f:
            f.write(f"[DB 진단] {db_path}\n")
            for sheet_name, count in stats:
                f.write(f"{sheet_name}\t{count}\n")
            f.write("\n")
        QtWidgets.QMessageBox.information(dialog, "DB 진단", msg)

    def auto_reload_if_changed():
        nonlocal data
        if not db_path.exists():
            return
        latest = load_db_cached(db_path)
        if latest is not data:
            data = latest
            status_label.setText(f"DB: {db_path} (로드 {len(data)}건)")

    def update_active_cell_label():
        try:
            book = xw.Book.caller()
            rng = book.app.selection
            address = rng.address.replace("$", "")
            cell_label.setText(f"셀: {address}")
        except Exception:
            cell_label.setText("셀: -")

    search_btn.clicked.connect(do_search)
    query_input.returnPressed.connect(do_search)
    config_btn.clicked.connect(set_db_path)
    verify_btn.clicked.connect(verify_db_path)
    reload_btn.clicked.connect(reload_db)
    diag_btn.clicked.connect(run_db_diagnosis)
    table.itemDoubleClicked.connect(lambda _: apply_selected())

    btns = QtWidgets.QHBoxLayout()
    apply_btn = QtWidgets.QPushButton("선택")
    close_btn = QtWidgets.QPushButton("닫기")
    btns.addStretch(1)
    btns.addWidget(apply_btn)
    btns.addWidget(close_btn)
    layout.addLayout(btns)

    apply_btn.clicked.connect(apply_selected)
    close_btn.clicked.connect(dialog.close)

    timer = QtCore.QTimer(dialog)
    timer.setInterval(2000)
    timer.timeout.connect(auto_reload_if_changed)
    timer.start()

    cell_timer = QtCore.QTimer(dialog)
    cell_timer.setInterval(300)
    cell_timer.timeout.connect(update_active_cell_label)
    cell_timer.start()

    dialog.finished.connect(lambda _: _clear_dialog())
    dialog.show()


def _clear_dialog():
    global _DIALOG
    _DIALOG = None
