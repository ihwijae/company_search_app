import re


def normalize_name(name: str) -> str:
    if not name:
        return ""
    name = str(name).strip().split("\n")[0]
    name = name.replace("(주)", "").replace("㈜", "").replace("주식회사", "")
    name = re.sub(r"\s*[0-9.,%].*$", "", name)
    return re.sub(r"\s+", " ", name).strip().lower()


def sanitize_company_name(name: str) -> str:
    if not name:
        return ""
    text = str(name).strip().split("\n")[0]
    text = text.replace("(주)", "").replace("㈜", "").replace("주식회사", "")
    return re.sub(r"\s+", " ", text).strip()


def extract_manager_name(notes: str):
    if not notes:
        return None
    text = re.sub(r"\s+", " ", str(notes)).strip()
    if not text:
        return None
    first_token = re.split(r"[ ,\/\|·\-]+", text)
    first_token = next((t for t in first_token if t), "")
    cleaned_first = re.sub(r"^[\[\(（【]([^\]\)）】]+)[\]\)】]?$", r"\1", first_token)
    if re.match(r"^[가-힣]{2,4}$", cleaned_first):
        return cleaned_first
    m = re.search(r"담당자?\s*[:：-]?\s*([가-힣]{2,4})", text)
    if m:
        return m.group(1)
    m = re.search(r"([가-힣]{2,4})\s*(과장|팀장|차장|대리|사원|부장|대표|실장|소장)", text)
    if m:
        return m.group(1)
    m = re.search(r"\b(?!확인서|등록증|증명서|평가|서류)([가-힣]{2,4})\b\s*(?:,|\/|\(|\d|$)", text)
    if m:
        return m.group(1)
    return None
