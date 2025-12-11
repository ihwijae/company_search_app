import re
import requests
from bs4 import BeautifulSoup

# ==========================
# 1. 여기에 네 계정/사업자번호 입력
# ==========================
USER_ID = "jium2635"          # 예: "jium2635"
USER_PW = "jium2635"      # 예: "abcd1234!"
BIZ_NO  = "212-81-96729"        # 테스트할 사업자등록번호


# 로그인 페이지(폼 있는 곳) & 액션 URL
LOGIN_PAGE_URL   = "https://www.smpp.go.kr/uat/uia/egovLoginUsr.do"
LOGIN_ACTION_URL = "https://www.smpp.go.kr/uat/uia/actionLogin.do"

# 목록 / 상세 URL
LIST_URL    = "https://www.smpp.go.kr/cop/registcorp/selectRegistCorpListVw.do"
SUMMARY_URL = "https://www.smpp.go.kr/cop/registcorp/selectRegistCorpSumryInfoVw.do"


def login(session: requests.Session, user_id: str, password: str) -> None:
    """
    SMPP 로그인
    1) 로그인 페이지 GET → loginForm 파싱
    2) hidden 필드 포함 전체 form 데이터 구성
    3) id/password 덮어쓰고 actionLogin.do 로 POST
    """
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/142.0.0.0 Safari/537.36"
        ),
    }

    # 1) 로그인 페이지 GET
    pre = session.get(LOGIN_PAGE_URL, headers=headers)
    print(f"[+] 로그인 페이지 GET 응답: {pre.status_code}, url={pre.url}")

    with open("login_page_debug.html", "w", encoding="utf-8") as f:
        f.write(pre.text)

    soup = BeautifulSoup(pre.text, "html.parser")

    # loginForm 찾기
    form = soup.find("form", attrs={"name": "loginForm"}) or soup.find(
        "form", attrs={"id": "loginForm"}
    )
    if not form:
        raise RuntimeError("로그인 폼(loginForm)을 찾지 못했습니다.")

    # 2) 폼 안의 input들을 dict로 만들기
    form_data = {}
    for inp in form.find_all("input"):
        name = inp.get("name")
        if not name:
            continue
        value = inp.get("value", "")
        form_data[name] = value

    # 3) id / password 값 덮어쓰기
    form_data["id"] = user_id
    form_data["password"] = password

    # 4) 실제 로그인 POST
    headers_post = {
        "User-Agent": headers["User-Agent"],
        "Origin": "https://www.smpp.go.kr",
        "Referer": LOGIN_PAGE_URL,
    }

    resp = session.post(LOGIN_ACTION_URL, headers=headers_post, data=form_data)
    print(f"[+] 로그인 POST 응답: {resp.status_code}, url={resp.url}")

    with open("login_result_debug.html", "w", encoding="utf-8") as f:
        f.write(resp.text)

    print("[*] 로그인 결과 HTML을 login_result_debug.html 에 저장했습니다.")


def fetch_list_html(session: requests.Session, biz_no: str) -> str:
    """사업자번호로 업체 목록 HTML 조회."""
    data = {
        "chks": "",
        "fileType": "",
        "pageIndex": "1",
        "ctprvnNm": "전체",
        "signguNm": "전체",
        "cntrctEsntlNo": "",
        "entrpsNm": "",
        "searchBsnmNo": biz_no,  # ★ 핵심: 사업자번호
        "chargerNm": "",
        "detailPrdnm": "",
        "detailPrdnmNo": "",
        "ksicNm": "",
        "ksic": "",
        "prductNm": "",
        "ctprvnCode": "",
        "signguCode": "",
        "smbizCode": "",
        "femtrbleCode": "",
        "hitechCode": "",
        "envqualCode": "",
        "entrpsNmMbl": "",
        "searchBsnmNoMbl": "",
        "chargerNmMbl": "",
        "pageUnit": "15",
    }

    resp = session.post(LIST_URL, data=data)
    print(f"[+] 목록 조회 응답: {resp.status_code}, url={resp.url}")
    resp.raise_for_status()

    # 디버그용 저장
    with open("list_debug.html", "w", encoding="utf-8") as f:
        f.write(resp.text)

    return resp.text


def looks_like_login_page(html: str) -> bool:
    """응답 HTML이 다시 로그인 페이지인지 대충 판별."""
    return ('name="loginForm"' in html) and ("로그인" in html or "아이디 입력" in html)


def build_move_form_payload_from_list_html(html: str, biz_no: str) -> dict:
    """
    목록 페이지에서 moveForm hidden 필드들을 파싱해서
    상세 요청에 쓸 payload dict 생성.
    - js: fn_moveDetail(bsnmNo)가 하는 일을 그대로 흉내냄
      -> moveForm.bsnmNo = bsnmNo
      -> action = /cop/registcorp/selectRegistCorpSumryInfoVw.do
    """
    soup = BeautifulSoup(html, "html.parser")

    form = soup.find("form", attrs={"name": "moveForm"})
    if not form:
        raise RuntimeError("moveForm 폼을 찾지 못했습니다.")

    payload = {}
    for inp in form.find_all("input"):
        name = inp.get("name")
        if not name:
            continue
        value = inp.get("value", "")
        payload[name] = value

    # 사업자번호에서 숫자만 추출해서 bsnmNo 에 세팅
    digits = re.sub(r"\D", "", biz_no)
    payload["bsnmNo"] = digits

    # searchBsnmNo 가 비어있으면 같이 채워주기(안 비어있으면 그냥 둠)
    if "searchBsnmNo" in payload and not payload["searchBsnmNo"]:
        payload["searchBsnmNo"] = digits

    return payload


def fetch_summary_html(session: requests.Session, payload: dict) -> str:
    """상세 요약(기업특징) HTML 조회."""
    resp = session.post(SUMMARY_URL, data=payload)
    print(f"[+] 상세 페이지 응답: {resp.status_code}, url={resp.url}")
    resp.raise_for_status()

    with open("summary_debug.html", "w", encoding="utf-8") as f:
        f.write(resp.text)

    return resp.text


def parse_women_feature(summary_html: str):
    """
    상세 요약 HTML에서 '여성기업' 행의 확인일자 / 만료일자를 추출.
    없거나 '해당사항 없음'이면 (None, None) 반환.
    """
    soup = BeautifulSoup(summary_html, "html.parser")

    # '기업특징' 라벨 span 기준으로 table 찾기 (class 조합에 덜 민감하게)
    span = soup.find("span", class_="labelType1", string=lambda t: t and "기업특징" in t)
    if not span:
        return None, None

    table = span.find_next("table")
    if not table:
        return None, None

    tbody = table.find("tbody") or table

    for tr in tbody.find_all("tr"):
        tds = tr.find_all("td")
        if not tds:
            continue

        kind = tds[0].get_text(strip=True)
        if kind != "여성기업":
            continue

        # "해당사항 없음" 케이스
        if any("해당사항 없음" in td.get_text() for td in tds[1:]):
            return None, None

        confirm = tds[2].get_text(strip=True) if len(tds) > 2 else None
        expire = tds[3].get_text(strip=True) if len(tds) > 3 else None

        confirm = confirm or None
        expire = expire or None

        return confirm, expire

    return None, None


def main():
    if "여기에_네_ID" in USER_ID or "여기에_네_비밀번호" in USER_PW:
        print("[!] 먼저 USER_ID / USER_PW / BIZ_NO 를 스크립트 상단에 채워주세요.")
        return

    session = requests.Session()

    # 1) 로그인
    login(session, USER_ID, USER_PW)

    # 2) 목록 조회
    print(f"[+] 사업자번호로 목록 조회: {BIZ_NO}")
    list_html = fetch_list_html(session, BIZ_NO)

    # 목록이 다시 로그인 페이지면 로그인 실패로 간주
    if looks_like_login_page(list_html):
        print("[!] 목록 대신 로그인 페이지가 돌아온 것 같습니다.")
        print("    list_debug.html / login_result_debug.html 을 열어서 실제 내용을 확인해보세요.")
        return

    # 3) moveForm 기반 payload 생성
    payload = build_move_form_payload_from_list_html(list_html, BIZ_NO)
    print("[+] 상세 요청 payload(bsnmNo만 로그로 확인):", {"bsnmNo": payload.get("bsnmNo")})

    # 4) 상세(기업특징) HTML 조회
    summary_html = fetch_summary_html(session, payload)

    # 5) 여성기업 확인일자/만료일자 파싱
    women_confirm, women_expire = parse_women_feature(summary_html)

    print("\n===== 여성기업 정보 =====")
    if not women_confirm and not women_expire:
        print("여성기업 : 해당사항 없음 또는 조회 실패")
    else:
        print("확인일자 :", women_confirm)
        print("만료일자 :", women_expire)


if __name__ == "__main__":
    main()
