import os
from pathlib import Path

import xlwings as xw
from PySide6 import QtWidgets, QtCore

from config_store import BASE_DIR, load_config, save_config
from db_loader import load_db_cached, load_db_stats
from mois_under30 import apply_mois_under30
from text_utils import normalize_name, sanitize_company_name


def write_to_active_cell(value):
    book = xw.Book.caller()
    rng = book.app.selection
    rng.value = value


_DIALOG = None
_APP_EXEC_STARTED = False


def open_modal():
    global _DIALOG
    global _APP_EXEC_STARTED
    app = QtWidgets.QApplication.instance() or QtWidgets.QApplication([])

    if _DIALOG is not None and _DIALOG.isVisible():
        _DIALOG.activateWindow()
        _DIALOG.raise_()
        return

    cfg = load_config()
    db_paths = cfg.get("dbPaths") or {}
    legacy_path = cfg.get("dbPath", "")
    if legacy_path and (not db_paths or not any(db_paths.values())):
        db_paths = {"eung": legacy_path, "tongsin": legacy_path, "sobang": legacy_path}
        cfg["dbPaths"] = db_paths
        cfg["lastIndustry"] = cfg.get("lastIndustry", "eung")
        save_config(cfg)

    def resolve_db_path(file_type):
        raw = db_paths.get(file_type, "")
        if not raw:
            return Path("")
        p = Path(raw)
        if not p.is_absolute():
            p = (BASE_DIR / p).resolve()
        return p

    def ensure_db_path(file_type):
        nonlocal db_paths
        p = resolve_db_path(file_type)
        if p.exists():
            return p
        QtWidgets.QMessageBox.warning(None, "DB 경로", "DB 파일 경로를 설정하세요.")
        picked, _ = QtWidgets.QFileDialog.getOpenFileName(
            None,
            "업체 DB 선택",
            str(BASE_DIR),
            "Excel Files (*.xlsx)",
        )
        if not picked:
            return Path("")
        db_paths[file_type] = os.path.relpath(picked, BASE_DIR)
        cfg["dbPaths"] = db_paths
        save_config(cfg)
        return Path(picked)

    file_type_initial = cfg.get("lastIndustry", "eung")
    db_path = ensure_db_path(file_type_initial)
    if not db_path:
        return

    data = load_db_cached(db_path)

    dialog = QtWidgets.QDialog()
    dialog.setWindowTitle("업체 검색")
    dialog.resize(820, 560)
    dialog.setWindowModality(QtCore.Qt.NonModal)
    dialog.setAttribute(QtCore.Qt.WA_DeleteOnClose, True)
    _DIALOG = dialog

    dialog.setStyleSheet(
        """
        QDialog { background: #f7f7f2; color: #1f2937; }
        QLabel#titleLabel { font-size: 18px; font-weight: 700; color: #111827; }
        QLabel#statusLabel { color: #4b5563; }
        QLabel#cellLabel { color: #0f766e; font-weight: 600; }
        QLineEdit, QComboBox {
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 6px 10px;
            min-height: 26px;
        }
        QLineEdit:focus, QComboBox:focus {
            border: 1px solid #0ea5e9;
        }
        QPushButton {
            background: #111827;
            color: #ffffff;
            border: none;
            border-radius: 8px;
            padding: 6px 12px;
            min-height: 28px;
        }
        QPushButton:hover { background: #1f2937; }
        QPushButton#ghostBtn {
            background: #e5e7eb;
            color: #111827;
        }
        QPushButton#ghostBtn:hover { background: #d1d5db; }
        QTableWidget {
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            gridline-color: #f1f5f9;
        }
        QHeaderView::section {
            background: #f1f5f9;
            color: #1f2937;
            border: none;
            padding: 6px;
            font-weight: 600;
        }
        """
    )

    layout = QtWidgets.QVBoxLayout(dialog)
    layout.setContentsMargins(16, 16, 16, 12)
    layout.setSpacing(10)

    header = QtWidgets.QHBoxLayout()
    title_label = QtWidgets.QLabel("업체 검색")
    title_label.setObjectName("titleLabel")
    status_label = QtWidgets.QLabel(f"공종 DB: {db_path} (로드 {len(data)}건)")
    status_label.setObjectName("statusLabel")
    cell_label = QtWidgets.QLabel("셀: -")
    cell_label.setObjectName("cellLabel")
    header.addWidget(title_label)
    header.addStretch(1)
    header.addWidget(cell_label)
    layout.addLayout(header)
    layout.addWidget(status_label)

    form = QtWidgets.QHBoxLayout()
    form.setSpacing(8)
    industry_box = QtWidgets.QComboBox()
    industry_box.addItems(["전기", "통신", "소방"])
    industry_box.setCurrentIndex({"eung": 0, "tongsin": 1, "sobang": 2}.get(file_type_initial, 0))
    form.addWidget(QtWidgets.QLabel("공종"))
    form.addWidget(industry_box)

    query_input = QtWidgets.QLineEdit()
    form.addWidget(QtWidgets.QLabel("업체명"))
    form.addWidget(query_input)

    search_btn = QtWidgets.QPushButton("검색")
    form.addWidget(search_btn)

    config_btn = QtWidgets.QPushButton("DB 경로 설정")
    config_btn.setObjectName("ghostBtn")
    form.addWidget(config_btn)

    verify_btn = QtWidgets.QPushButton("DB 경로 확인")
    verify_btn.setObjectName("ghostBtn")
    form.addWidget(verify_btn)

    reload_btn = QtWidgets.QPushButton("DB 재로드")
    reload_btn.setObjectName("ghostBtn")
    form.addWidget(reload_btn)

    diag_btn = QtWidgets.QPushButton("DB 진단")
    diag_btn.setObjectName("ghostBtn")
    form.addWidget(diag_btn)

    layout.addLayout(form)

    table = QtWidgets.QTableWidget(0, 8)
    table.setHorizontalHeaderLabels(["선택", "공종", "업체명", "담당자", "지역", "사업자번호", "5년실적", "시평액"])
    table.horizontalHeader().setStretchLastSection(False)
    table.verticalHeader().setVisible(False)
    table.setAlternatingRowColors(True)
    table.setColumnWidth(0, 48)
    table.setColumnWidth(1, 60)
    table.setColumnWidth(2, 150)
    table.setColumnWidth(3, 80)
    table.setColumnWidth(4, 90)
    table.setColumnWidth(5, 120)
    table.setColumnWidth(6, 120)
    table.setColumnWidth(7, 120)
    table.horizontalHeader().setStretchLastSection(True)
    layout.addWidget(table)

    def format_amount(value):
        if value is None:
            return ""
        try:
            number = float(value)
        except Exception:
            return str(value)
        if number.is_integer():
            return f"{int(number):,}"
        return f"{number:,.0f}"

    def do_search():
        q = normalize_name(query_input.text())
        table.setRowCount(0)
        if not q:
            return
        current_industry = industry_box.currentText()
        for row in data:
            if q in row["norm"]:
                r = table.rowCount()
                table.insertRow(r)
                check_item = QtWidgets.QTableWidgetItem("")
                check_item.setFlags(QtCore.Qt.ItemIsUserCheckable | QtCore.Qt.ItemIsEnabled | QtCore.Qt.ItemIsSelectable)
                check_item.setCheckState(QtCore.Qt.Unchecked)
                table.setItem(r, 0, check_item)
                table.setItem(r, 1, QtWidgets.QTableWidgetItem(current_industry))
                table.setItem(r, 2, QtWidgets.QTableWidgetItem(row["name"]))
                table.setItem(r, 3, QtWidgets.QTableWidgetItem(row.get("managerName", "")))
                table.setItem(r, 4, QtWidgets.QTableWidgetItem(row["region"]))
                table.setItem(r, 5, QtWidgets.QTableWidgetItem(row.get("bizNo", "")))
                perf_val = row.get("perf5y")
                sipyung_val = row.get("sipyung")
                table.setItem(r, 6, QtWidgets.QTableWidgetItem(format_amount(perf_val)))
                table.setItem(r, 7, QtWidgets.QTableWidgetItem(format_amount(sipyung_val)))

    def resolve_checked_row():
        for r in range(table.rowCount()):
            item = table.item(r, 0)
            if item is not None and item.checkState() == QtCore.Qt.Checked:
                return r
        return -1

    def apply_selected():
        selected = resolve_checked_row()
        if selected < 0:
            selected = table.currentRow()
        if selected < 0:
            return
        name_val = table.item(selected, 2).text()
        region_val = table.item(selected, 4).text()
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
        nonlocal data, db_path, db_paths
        path, _ = QtWidgets.QFileDialog.getOpenFileName(dialog, "업체 DB 선택", str(BASE_DIR), "Excel Files (*.xlsx)")
        if not path:
            return
        file_type = {
            "전기": "eung",
            "통신": "tongsin",
            "소방": "sobang",
        }[industry_box.currentText()]
        db_paths[file_type] = os.path.relpath(path, BASE_DIR)
        cfg["dbPaths"] = db_paths
        cfg["lastIndustry"] = file_type
        save_config(cfg)
        db_path = Path(path)
        data = load_db_cached(db_path, force=True)
        status_label.setText(f"공종 DB: {db_path} (로드 {len(data)}건)")
        QtWidgets.QMessageBox.information(dialog, "DB 경로", f"설정됨:\n{db_path}\n로드 {len(data)}건")

    def verify_db_path():
        exists = db_path.exists()
        mtime = db_path.stat().st_mtime if exists else None
        msg = f"공종: {industry_box.currentText()}\n경로: {db_path}\n존재: {'예' if exists else '아니오'}\n로드 {len(data)}건"
        if mtime:
            msg += f"\n수정시간: {QtCore.QDateTime.fromSecsSinceEpoch(int(mtime)).toString('yyyy-MM-dd HH:mm:ss')}"
        QtWidgets.QMessageBox.information(dialog, "DB 경로 확인", msg)

    def reload_db():
        nonlocal data
        if not db_path.exists():
            QtWidgets.QMessageBox.warning(dialog, "DB 재로드", "DB 파일 경로가 유효하지 않습니다.")
            return
        data = load_db_cached(db_path, force=True)
        status_label.setText(f"공종 DB: {db_path} (로드 {len(data)}건)")
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
        nonlocal data, db_path
        if not db_path.exists():
            return
        latest = load_db_cached(db_path)
        if latest is not data:
            data = latest
            status_label.setText(f"공종 DB: {db_path} (로드 {len(data)}건)")

    def update_active_cell_label():
        try:
            book = xw.Book.caller()
            rng = book.app.selection
            address = rng.address.replace("$", "")
            cell_label.setText(f"셀: {address}")
        except Exception:
            cell_label.setText("셀: -")

    def on_industry_change():
        nonlocal data, db_path
        file_type = {
            "전기": "eung",
            "통신": "tongsin",
            "소방": "sobang",
        }[industry_box.currentText()]
        cfg["lastIndustry"] = file_type
        save_config(cfg)
        next_path = ensure_db_path(file_type)
        if not next_path:
            return
        db_path = next_path
        data = load_db_cached(db_path, force=True)
        status_label.setText(f"공종 DB: {db_path} (로드 {len(data)}건)")

    def enforce_single_check(row):
        table.blockSignals(True)
        try:
            for r in range(table.rowCount()):
                item = table.item(r, 0)
                if item is None:
                    continue
                item.setCheckState(QtCore.Qt.Checked if r == row else QtCore.Qt.Unchecked)
        finally:
            table.blockSignals(False)

    search_btn.clicked.connect(do_search)
    query_input.returnPressed.connect(do_search)
    config_btn.clicked.connect(set_db_path)
    verify_btn.clicked.connect(verify_db_path)
    reload_btn.clicked.connect(reload_db)
    diag_btn.clicked.connect(run_db_diagnosis)
    industry_box.currentIndexChanged.connect(on_industry_change)
    table.itemDoubleClicked.connect(lambda _: apply_selected())
    table.itemChanged.connect(lambda item: enforce_single_check(item.row()) if item.column() == 0 and item.checkState() == QtCore.Qt.Checked else None)

    btns = QtWidgets.QHBoxLayout()
    btns.setSpacing(8)
    apply_btn = QtWidgets.QPushButton("선택")
    close_btn = QtWidgets.QPushButton("닫기")
    close_btn.setObjectName("ghostBtn")
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
    if not _APP_EXEC_STARTED:
        _APP_EXEC_STARTED = True
        app.setQuitOnLastWindowClosed(True)
        app.exec()


def _clear_dialog():
    global _DIALOG
    _DIALOG = None
