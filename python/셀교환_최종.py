import tkinter as tk
from tkinter import ttk, messagebox, font
from contextlib import contextmanager

import xlwings as xw

import ctypes
import sys

APP_ID = "CompanyName.ExcelSwapApp"
if sys.platform == "win32":
    ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID(APP_ID)

# ------------------------------------------------------------
# 규칙 생성 유틸
# ------------------------------------------------------------
CIPW = (0, 6, 13, 20)
CIPW_WITH_AD = CIPW + (27,)
HANGANG_100_300 = (0, 6, 13, 19, 27, 43)
AO_OFFSET = 38
AP_OFFSET = 39
AR_OFFSET = 41
AT_OFFSET = 43
AV_OFFSET = 45
AW_OFFSET = 46
QUALITY_OFFSET = (1, 6)
QUALITY_OFFSET_P = (1, 13)


def build_rule(base_offsets, *extra_offsets, include_quality=False, quality_offset=None):
    offsets = list(base_offsets)
    offsets.extend(extra_offsets)
    cells = [(0, off) for off in offsets]
    if include_quality:
        cells.append(quality_offset or QUALITY_OFFSET)
    return {"cells": cells}


# ------------------------------------------------------------
# Excel 최적화 컨텍스트: 화면 갱신/이벤트/계산 일시 중지
# ------------------------------------------------------------
@contextmanager
def suspend_excel(app):
    excel = app.api
    old_calc = excel.Calculation
    old_events = excel.EnableEvents
    old_update = excel.ScreenUpdating
    try:
        excel.Calculation = -4135  # xlCalculationManual
        excel.EnableEvents = False
        excel.ScreenUpdating = False
        yield
    finally:
        excel.Calculation = old_calc
        excel.EnableEvents = old_events
        excel.ScreenUpdating = old_update


class SwapApp:
    AGENCY_CONFIG = {
        "행안부": {
            "actions": [
                {
                    "key": "DEFAULT",
                    "style": "General.TButton",
                    "text": "[행안부] 교환 실행",
                },
            ],
        },
        "조달청": {
            "actions": [
                {
                    "key": "DEFAULT",
                    "style": "General.TButton",
                    "text": "[조달청] 교환 실행",
                },
            ],
        },
        "LH": {
            "actions": [
                {
                    "key": "WITH_QUALITY",
                    "style": "LHInclude.TButton",
                    "text": "[LH] 품질 포함",
                },
                {
                    "key": "WITHOUT_QUALITY",
                    "style": "LHExclude.TButton",
                    "text": "[LH] 품질 제외",
                },
            ],
        },
        "국가철도공단": {
            "actions": [
                {
                    "key": "DEFAULT",
                    "style": "Korail.TButton",
                    "text": "[국가철도공단] 교환 실행",
                },
            ],
        },
        "한국도로공사": {
            "actions": [
                {
                    "key": "DEFAULT",
                    "style": "General.TButton",
                    "text": "[한국도로공사] 교환 실행",
                },
            ],
        },
    }

    SWAP_RULES = {
        # 50억 미만
        ("UNDER_50", "행안부", "DEFAULT"): build_rule(CIPW, AO_OFFSET),
        ("UNDER_50", "조달청", "DEFAULT"): build_rule(CIPW, AO_OFFSET),
        ("UNDER_50", "LH", "WITH_QUALITY"): build_rule(CIPW, AR_OFFSET, include_quality=True),
        ("UNDER_50", "LH", "WITHOUT_QUALITY"): build_rule(CIPW, AR_OFFSET),
        ("UNDER_50", "국가철도공단", "DEFAULT"): build_rule(CIPW_WITH_AD, AV_OFFSET),
        ("UNDER_50", "한국도로공사", "DEFAULT"): build_rule(CIPW, AO_OFFSET),
        # 50억~100억
        ("50_100", "행안부", "DEFAULT"): build_rule(CIPW, AO_OFFSET),
        ("50_100", "조달청", "DEFAULT"): build_rule(CIPW, AP_OFFSET),
        ("50_100", "LH", "WITH_QUALITY"): build_rule(CIPW, AT_OFFSET, include_quality=True),
        ("50_100", "LH", "WITHOUT_QUALITY"): build_rule(CIPW, AT_OFFSET),
        ("50_100", "국가철도공단", "DEFAULT"): build_rule(CIPW_WITH_AD, AW_OFFSET),
        ("50_100", "한국도로공사", "DEFAULT"): build_rule(CIPW, AO_OFFSET),
        # 100억~300억
        ("100_300", "행안부", "DEFAULT"): build_rule(HANGANG_100_300),
        ("100_300", "조달청", "DEFAULT"): build_rule(CIPW),
        ("100_300", "LH", "WITH_QUALITY"): build_rule(
            CIPW, include_quality=True, quality_offset=QUALITY_OFFSET_P
        ),
        ("100_300", "국가철도공단", "DEFAULT"): build_rule(CIPW),
        ("100_300", "한국도로공사", "DEFAULT"): build_rule(CIPW),
    }

    ACTION_HINTS = {
        ("UNDER_50", "행안부", "DEFAULT"): "시평액 AO",
        ("UNDER_50", "조달청", "DEFAULT"): "시평액 AO",
        ("UNDER_50", "LH", "WITH_QUALITY"): "시평액 AR",
        ("UNDER_50", "LH", "WITHOUT_QUALITY"): "시평액 AR",
        ("UNDER_50", "국가철도공단", "DEFAULT"): "시평액 AV",
        ("UNDER_50", "한국도로공사", "DEFAULT"): "시평액 AO",
        ("50_100", "행안부", "DEFAULT"): "시평액 AO",
        ("50_100", "조달청", "DEFAULT"): "시평액 AP",
        ("50_100", "LH", "WITH_QUALITY"): "시평액 AT",
        ("50_100", "LH", "WITHOUT_QUALITY"): "시평액 AT",
        ("50_100", "국가철도공단", "DEFAULT"): "시평액 AW",
        ("50_100", "한국도로공사", "DEFAULT"): "시평액 AO",
        ("100_300", "행안부", "DEFAULT"): "기준열 D · 시평액 AU",
        ("100_300", "조달청", "DEFAULT"): "시평액 없음",
        ("100_300", "LH", "WITH_QUALITY"): "시평액 AO · 품질 P",
        ("100_300", "국가철도공단", "DEFAULT"): "시평액 없음",
        ("100_300", "한국도로공사", "DEFAULT"): "시평액 없음",
    }

    def __init__(self, root):
        self.root = root
        self.root.title("업체 교환 프로그램 v6.9 (금액대/발주처, 고속 .api)")
        self.root.geometry("720x900")
        self.root.minsize(720, 900)
        self.root.configure(bg="#eef2f7")
        try:
            self.root.iconbitmap("logo.ico")
        except Exception:
            pass
        self.root.protocol("WM_DELETE_WINDOW", self.on_closing)

        self.cell1, self.cell2 = None, None

        self.style = ttk.Style()
        try:
            self.style.theme_use("clam")
        except Exception:
            pass

        base_font = "맑은 고딕"
        self.default_font = font.Font(family=base_font, size=9)
        self.title_font = font.Font(family=base_font, size=10, weight="bold")
        self.company_font = font.Font(family=base_font, size=9, weight="bold")
        self.action_bold_font = font.Font(family=base_font, size=9, weight="bold")
        self.amount_var = tk.StringVar(value="")
        self.agency_var = tk.StringVar(value="")

        self._setup_styles()
        self._create_widgets()
        self.reset(initial=True)

    # ------------------------------------------------------------
    # Style definition
    # ------------------------------------------------------------
    def _setup_styles(self):
        palette = {
            "bg": "#eef2f7",
            "card_bg": "#ffffff",
            "heading": "#1f2937",
            "body": "#475569",
            "muted": "#94a3b8",
            "selected_bg": "#f1f5f9",
        }
        self.palette = palette

        self.style.configure("App.TFrame", background=palette["bg"])
        self.style.configure("Header.TFrame", background=palette["bg"])
        self.style.configure("HeaderTitle.TLabel", background=palette["bg"], foreground=palette["heading"],
                             font=self.title_font)
        self.style.configure("Info.TLabel", background=palette["bg"], foreground=palette["muted"],
                             font=self.default_font)

        self.style.configure("Card.TFrame", background=palette["card_bg"], relief="flat")
        self.style.configure("CardTitle.TLabel", background=palette["card_bg"], foreground=palette["heading"],
                             font=self.title_font)
        self.style.configure("Body.TLabel", background=palette["card_bg"], foreground=palette["body"],
                             font=self.default_font)
        self.style.configure("Selected.TLabel", background=palette["selected_bg"], foreground=palette["heading"],
                             font=self.company_font, padding=(4, 2))

        self.style.configure("Amount.TButton", font=self.default_font, padding=(16, 8),
                             foreground="#1f2937", background="#edf2fb", borderwidth=0)
        self.style.map("Amount.TButton", background=[("active", "#dbeafe")])
        self.style.configure("AmountSelected.TButton", font=self.default_font, padding=(16, 8),
                             foreground="#1d2440", background="#cbd5ff", borderwidth=0)
        self.style.map("AmountSelected.TButton", background=[("active", "#a5b4fc")])

        self.style.configure("Agency.TButton", font=self.default_font, padding=(16, 8),
                             foreground="#1f2937", background="#edf2fb", borderwidth=0)
        self.style.map("Agency.TButton", background=[("active", "#dbeafe")])
        self.style.configure("AgencySelected.TButton", font=self.default_font, padding=(16, 8),
                             foreground="#1f2a44", background="#d6e2ff", borderwidth=0)
        self.style.map("AgencySelected.TButton", background=[("active", "#b9c8ff")])

        def make_button_style(name, bg, active_bg, fg="#111827"):
            base_opts = {
                "font": self.default_font,
                "padding": (14, 10),
                "foreground": fg,
                "background": bg,
                "borderwidth": 0,
            }
            self.style.configure(name, **base_opts)
            self.style.map(
                name,
                background=[("active", active_bg), ("disabled", bg)],
                foreground=[("disabled", "#a1a1aa")],
            )
            bold_name = self._bold_style_name(name)
            bold_opts = dict(base_opts)
            bold_opts["font"] = self.action_bold_font
            self.style.configure(bold_name, **bold_opts)
            self.style.map(
                bold_name,
                background=[("active", active_bg), ("disabled", bg)],
                foreground=[("disabled", "#a1a1aa")],
            )

        make_button_style("General.TButton", "#e3f2fd", "#cfe8ff")
        make_button_style("Korail.TButton", "#f0e7ff", "#e2d6ff")
        make_button_style("LHInclude.TButton", "#e6fffa", "#c9fdf3", fg="#065f46")
        make_button_style("LHExclude.TButton", "#fff7ed", "#ffedd5", fg="#9a3412")
        make_button_style("Select.TButton", "#f1f5ff", "#e2e8ff")
        make_button_style("Ghost.TButton", "#ffffff", "#f4f6fb")
        make_button_style("Danger.TButton", "#ffe5e5", "#ffcfd1", fg="#7f1d1d")

    @staticmethod
    def _bold_style_name(style_name: str) -> str:
        if ".TButton" in style_name:
            return style_name.replace(".TButton", "Bold.TButton")
        return f"{style_name}.Bold"

    # ------------------------------------------------------------
    # UI 구성
    # ------------------------------------------------------------
    def _create_widgets(self):
        container = ttk.Frame(self.root, style="App.TFrame")
        container.pack(fill="both", expand=True)

        frame_amount = ttk.Frame(container, style="Card.TFrame", padding=(16, 12))
        frame_amount.pack(fill="x", padx=20, pady=(16, 8))
        ttk.Label(frame_amount, text="1단계 · 금액대/발주처 설정", style="CardTitle.TLabel").pack(anchor="w")
        ttk.Label(
            frame_amount,
            text="금액대와 발주처를 모두 선택해야 교환 모드가 활성화됩니다.",
            style="Body.TLabel",
            wraplength=440,
        ).pack(anchor="w", pady=(4, 10))

        amount_row = ttk.Frame(frame_amount, style="Card.TFrame")
        amount_row.pack(fill="x", pady=(0, 6))
        self.amount_buttons = []
        self.amount_label_map = {}
        for text, value in (("50억 미만", "UNDER_50"), ("50억~100억", "50_100"), ("100억~300억", "100_300")):
            btn = ttk.Button(
                amount_row,
                text=text,
                style="Amount.TButton",
                command=lambda v=value: self._select_amount(v),
            )
            btn.pack(side="left", padx=(0, 8))
            self.amount_buttons.append((value, btn))
            self.amount_label_map[value] = text
        self._update_amount_styles()

        ttk.Label(frame_amount, text="발주처 선택", style="CardTitle.TLabel").pack(anchor="w", pady=(8, 4))
        ttk.Label(
            frame_amount,
            text="발주처까지 함께 지정해야 정확한 교환 규칙이 적용됩니다.",
            style="Body.TLabel",
            wraplength=440,
        ).pack(anchor="w", pady=(0, 8))
        agency_row = ttk.Frame(frame_amount, style="Card.TFrame")
        agency_row.pack(fill="x", pady=(0, 6))
        self.agency_buttons = []
        for agency in self.AGENCY_CONFIG.keys():
            btn = ttk.Button(
                agency_row,
                text=agency,
                style="Agency.TButton",
                command=lambda v=agency: self._select_agency(v),
            )
            btn.pack(side="left", padx=(0, 8))
            self.agency_buttons.append((agency, btn))
        self._update_agency_styles()

        ttk.Separator(container, orient="horizontal").pack(fill="x", padx=20, pady=(4, 8))

        frame1 = ttk.Frame(container, style="Card.TFrame", padding=(16, 12))
        frame1.pack(fill="x", padx=20, pady=8)
        ttk.Label(frame1, text="2단계 · 첫 번째 업체 선택", style="CardTitle.TLabel").pack(anchor="w")
        ttk.Label(
            frame1,
            text="엑셀에서 첫 번째 업체(업체명 셀)를 선택한 뒤 [선택 완료] 버튼을 눌러주세요.",
            style="Body.TLabel",
            wraplength=440,
        ).pack(anchor="w", pady=(6, 12))
        select1_row = ttk.Frame(frame1, style="Card.TFrame")
        select1_row.pack(fill="x")
        self.btn_select1 = ttk.Button(select1_row, text="선택 완료", style="Select.TButton",
                                      command=self.select_first_cell)
        self.btn_select1.pack(side="left")
        self.label_c1 = ttk.Label(select1_row, text="", style="Selected.TLabel")
        self.label_c1.pack(side="left", padx=(10, 0), fill="x", expand=True)

        frame2 = ttk.Frame(container, style="Card.TFrame", padding=(16, 12))
        frame2.pack(fill="x", padx=20, pady=8)
        ttk.Label(frame2, text="3단계 · 두 번째 업체 선택", style="CardTitle.TLabel").pack(anchor="w")
        ttk.Label(
            frame2,
            text="엑셀에서 두 번째 업체를 선택한 뒤 [선택 완료] 버튼을 눌러주세요.",
            style="Body.TLabel",
            wraplength=440,
        ).pack(anchor="w", pady=(6, 12))
        select2_row = ttk.Frame(frame2, style="Card.TFrame")
        select2_row.pack(fill="x")
        self.btn_select2 = ttk.Button(select2_row, text="선택 완료", style="Select.TButton",
                                      command=self.select_second_cell)
        self.btn_select2.pack(side="left")
        self.label_c2 = ttk.Label(select2_row, text="", style="Selected.TLabel")
        self.label_c2.pack(side="left", padx=(10, 0), fill="x", expand=True)

        ttk.Separator(container, orient="horizontal").pack(fill="x", padx=20, pady=(4, 8))

        frame3 = ttk.Frame(container, style="Card.TFrame", padding=(16, 12))
        frame3.pack(fill="x", padx=20, pady=10)
        ttk.Label(frame3, text="4단계 · 교환 실행", style="CardTitle.TLabel").pack(anchor="w")
        ttk.Label(
            frame3,
            text="선택한 발주처 규칙만 노출되며, 해당 버튼으로 값/배경색/글자색을 한 번에 교환합니다.",
            style="Body.TLabel",
            wraplength=440,
        ).pack(anchor="w", pady=(6, 12))

        self.run_action_frame = ttk.Frame(frame3, style="Card.TFrame")
        self.run_action_frame.pack(fill="x", pady=(0, 6))
        self.action_buttons = []
        self._action_buttons_placeholder = True

        self.run_info_label = ttk.Label(frame3, text="", style="Body.TLabel", foreground=self.palette["muted"])
        self.run_info_label.pack(anchor="w")
        self._refresh_run_section()

        ttk.Separator(container, orient="horizontal").pack(fill="x", padx=20, pady=(12, 8))

        control_frame = ttk.Frame(container, style="App.TFrame", padding=(20, 0, 20, 24))
        control_frame.pack(fill="x")
        ttk.Button(control_frame, text="초기화", style="Ghost.TButton", command=self.reset).pack(pady=(0, 6))

    # ------------------------------------------------------------
    # 종료 확인
    # ------------------------------------------------------------
    def on_closing(self):
        if messagebox.askyesno("종료 확인", "프로그램을 종료할까요?"):
            self.root.destroy()

    # ------------------------------------------------------------
    # Excel selection helpers
    # ------------------------------------------------------------
    def get_current_selection(self):
        app = xw.apps.active
        if not app:
            raise Exception("열려 있는 Excel 인스턴스를 찾을 수 없습니다.")
        book = app.books.active
        sheet = book.sheets.active
        selection = app.selection
        if selection.api.Areas.Count != 1:
            raise Exception("하나의 영역만 선택해주세요.")
        return sheet.range(selection.api.Areas(1).Address)

    def select_first_cell(self):
        try:
            if not self._ensure_stage_one_ready():
                return
            self.cell1 = self.get_current_selection()
            show = self.cell1.value if self.cell1.value not in (None, "") else self.cell1.get_address(False, False)
            self.label_c1.config(text=f"선택됨 · {show}")
            self.btn_select1.config(state="disabled")
            self.btn_select2.config(state="normal")
            self._refresh_run_section()
        except Exception as e:
            messagebox.showerror("선택 오류", str(e))

    def select_second_cell(self):
        try:
            if not self._ensure_stage_one_ready():
                return
            temp_cell = self.get_current_selection()
            if self.cell1 and temp_cell.address == self.cell1.address:
                raise Exception("첫 번째 선택과 다른 업체를 지정해주세요.")
            self.cell2 = temp_cell
            show = self.cell2.value if self.cell2.value not in (None, "") else self.cell2.get_address(False, False)
            self.label_c2.config(text=f"선택됨 · {show}")
            self.btn_select2.config(state="disabled")
            self._refresh_run_section()
        except Exception as e:
            messagebox.showerror("선택 오류", str(e))

    def _select_amount(self, value):
        if self.amount_var.get() != value:
            self.amount_var.set(value)
            self._update_amount_styles()
            self._refresh_run_section()

    def _select_agency(self, value: str):
        if self.agency_var.get() != value:
            self.agency_var.set(value)
            self._update_agency_styles()
            self._refresh_run_section()

    def _update_amount_styles(self):
        current = self.amount_var.get()
        for value, btn in getattr(self, "amount_buttons", []):
            btn.config(style="AmountSelected.TButton" if current == value else "Amount.TButton")

    def _update_agency_styles(self):
        current = self.agency_var.get()
        for value, btn in getattr(self, "agency_buttons", []):
            btn.config(style="AgencySelected.TButton" if current == value else "Agency.TButton")

    def _stage_one_ready(self) -> bool:
        return bool(self.amount_var.get() and self.agency_var.get())

    def _ensure_stage_one_ready(self) -> bool:
        if self._stage_one_ready():
            return True
        messagebox.showwarning("1단계 설정 필요", "금액대와 발주처를 모두 선택한 뒤 업체를 지정해주세요.")
        return False

    def _get_amount_label(self) -> str:
        return self.amount_label_map.get(self.amount_var.get(), "")

    def _get_selected_agency_config(self):
        return self.AGENCY_CONFIG.get(self.agency_var.get())

    def _filter_actions_for_selection(self, actions):
        amount = self.amount_var.get()
        agency = self.agency_var.get()
        if agency == "LH" and amount == "100_300":
            return [action for action in actions if action.get("key") != "WITHOUT_QUALITY"]
        return actions

    def _rebuild_action_buttons(self, actions):
        for btn in self.action_buttons:
            btn.destroy()
        self.action_buttons = []
        self._action_buttons_placeholder = not actions
        if not actions:
            placeholder = ttk.Button(
                self.run_action_frame,
                text="발주처를 먼저 선택해주세요",
                style="Ghost.TButton",
                state="disabled",
            )
            placeholder.pack(fill="x", pady=4)
            self.action_buttons.append(placeholder)
            return

        amount_label = self._get_amount_label()
        is_bold = bool(amount_label)
        for action in actions:
            text = action["text"]
            hint = self._get_action_hint(action["key"])
            if hint:
                text = f"{text} · {hint}"
            if amount_label:
                text = f"{text} · [{amount_label}]"
            base_style = action.get("style", "Ghost.TButton")
            style_name = self._bold_style_name(base_style) if is_bold else base_style
            btn = ttk.Button(
                self.run_action_frame,
                text=text,
                style=style_name,
                command=lambda key=action["key"], txt=text: self._on_run_clicked(key, txt),
            )
            btn.pack(fill="x", pady=4)
            self.action_buttons.append(btn)

    def _set_action_buttons_state(self, enabled: bool):
        if self._action_buttons_placeholder:
            return
        state = "normal" if enabled else "disabled"
        for btn in self.action_buttons:
            btn.config(state=state)

    def _resolve_rule(self, action_key: str):
        amount = self.amount_var.get()
        agency = self.agency_var.get()
        key = (amount, agency, action_key)
        return self.SWAP_RULES.get(key)

    def _get_action_hint(self, action_key: str) -> str:
        amount = self.amount_var.get()
        agency = self.agency_var.get()
        key = (amount, agency, action_key)
        return self.ACTION_HINTS.get(key, "")

    def _refresh_run_section(self):
        config = self._get_selected_agency_config()
        actions = config.get("actions", []) if config else []
        actions = self._filter_actions_for_selection(actions)
        self._rebuild_action_buttons(actions)

        if not config:
            self.run_info_label.config(text="")
            return

        amount_label = self._get_amount_label()
        info_bits = []
        if amount_label:
            info_bits.append(f"금액대: {amount_label}")
        info_bits.append(f"발주처: {self.agency_var.get()}")
        self.run_info_label.config(text=" · ".join(info_bits))

        enabled = bool(self.cell1 and self.cell2 and self._stage_one_ready())
        self._set_action_buttons_state(enabled)

    def _on_run_clicked(self, action_key: str, action_text: str):
        if not self._stage_one_ready():
            messagebox.showwarning("1단계 설정 필요", "금액대와 발주처를 모두 선택해주세요.")
            return
        if not (self.cell1 and self.cell2):
            messagebox.showwarning("업체 선택 필요", "두 업체를 모두 선택한 뒤 실행해주세요.")
            return
        rule = self._resolve_rule(action_key)
        if not rule:
            messagebox.showerror("규칙 없음", "선택한 금액대·발주처 조합에 대한 교환 규칙이 정의되지 않았습니다.")
            return
        self.run_swap(rule, action_text)

    # ------------------------------------------------------------
    # 고속 교환 실행 (값+배경색+글자색)
    # ------------------------------------------------------------
    def run_swap(self, rule: dict, action_text: str):
        try:
            if not self.amount_var.get():
                raise Exception("금액대 구간을 먼저 선택해주세요.")
            if not self.agency_var.get():
                raise Exception("발주처를 먼저 선택해주세요.")
            if not (self.cell1 and self.cell2):
                raise Exception("두 업체를 모두 선택한 뒤 실행해주세요.")

            cells = list(rule.get("cells", []))
            if not cells:
                raise Exception("교환할 셀 정보가 정의되지 않았습니다.")

            unique_offsets = []
            seen = set()
            for offset in cells:
                if offset not in seen:
                    seen.add(offset)
                    unique_offsets.append(offset)

            app = xw.apps.active
            if not app:
                raise Exception("Excel을 찾을 수 없습니다.")

            pairs = []
            for row_offset, col_offset in unique_offsets:
                a = self.cell1.offset(row_offset, col_offset)
                b = self.cell2.offset(row_offset, col_offset)
                if a.sheet.name == b.sheet.name and a.address == b.address:
                    continue
                pairs.append((a, b))

            if not pairs:
                raise Exception("교환할 셀을 찾을 수 없습니다.")

            with suspend_excel(app):
                snaps = []
                for a, b in pairs:
                    snaps.append(
                        (
                            (a.api.Value2, a.api.Interior.Color, a.api.Font.Color),
                            (b.api.Value2, b.api.Interior.Color, b.api.Font.Color),
                        )
                    )

                for (a, b), ((v1, bg1, fc1), (v2, bg2, fc2)) in zip(pairs, snaps):
                    a.api.Value2 = v2
                    b.api.Value2 = v1
                    a.api.Interior.Color = bg2
                    b.api.Interior.Color = bg1
                    a.api.Font.Color = fc2
                    b.api.Font.Color = fc1

            messagebox.showinfo("완료", f"{action_text} 완료되었습니다.")
            self.reset()

        except Exception as e:
            messagebox.showerror("처리 오류", f"작업 중 문제가 발생했습니다:\n{e}")

    # ------------------------------------------------------------
    # 초기화
    # ------------------------------------------------------------
    def reset(self, initial: bool = False):
        self.cell1, self.cell2 = None, None
        if initial:
            self.amount_var.set("")
            self.agency_var.set("")
        self.label_c1.config(text="")
        self.label_c2.config(text="")
        self.btn_select1.config(state="normal")
        self.btn_select2.config(state="disabled")
        self._update_amount_styles()
        self._update_agency_styles()
        self._refresh_run_section()


if __name__ == "__main__":
    root = tk.Tk()
    app = SwapApp(root)
    root.mainloop()
