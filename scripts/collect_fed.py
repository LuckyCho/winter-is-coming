"""Import monthly Fed GZ spread, excess bond premium and modeled recession probability."""
import csv
import io
import json
import math
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "data" / "indicators.json"
URL = "https://www.federalreserve.gov/econres/notes/feds-notes/ebp_csv.csv"
SPECS = [
    ("us_gz", "미국 회사채 신용스프레드 (GZ)", "US CREDIT", "%p", "gz_spread",
     "미국 비금융기업 회사채의 전반적인 신용위험. 확대될수록 기업 자금조달 부담이 커질 수 있습니다."),
    ("us_ebp", "초과채권프리미엄 (EBP)", "US CREDIT", "%p", "ebp",
     "기업 부도위험 외에 투자자가 요구하는 추가 프리미엄. 상승하면 신용시장의 위험회피 심리가 강해질 수 있습니다."),
    ("us_recession_prob", "향후 12개월 경기침체 모형 확률", "US RECESSION", "%", "est_prob",
     "연준 연구모형이 계산한 확률이며 공식적인 연준 경제전망이나 확정적 경기침체 예측은 아닙니다."),
]

def parse_fed_csv(raw: str) -> dict[str, list[dict]]:
    reader = csv.DictReader(io.StringIO(raw.lstrip("\ufeff")))
    fields = {"date", "gz_spread", "ebp", "est_prob"}
    if not fields.issubset(reader.fieldnames or []):
        raise ValueError("Fed CSV missing required columns")
    result = {name: {} for name in fields - {"date"}}
    for row in reader:
        date = (row.get("date") or "").strip()
        try:
            datetime.strptime(date, "%Y-%m-%d")
        except ValueError:
            continue
        for name in result:
            try:
                value = float(row[name])
            except (ValueError, TypeError, KeyError):
                continue
            if math.isfinite(value):
                result[name][date] = round(value * (100 if name == "est_prob" else 1), 6)
    if any(len(values) < 120 for values in result.values()):
        raise ValueError("Fed CSV returned insufficient history")
    return {
        name: [{"date": date, "value": value} for date, value in sorted(series.items())]
        for name, series in result.items()
    }

def main():
    req = Request(URL, headers={"User-Agent": "WinterIsComing/1.0", "Accept": "text/csv,*/*"})
    with urlopen(req, timeout=45) as response:
        payload = response.read(10_000_000)
        if response.status != 200 or not payload or len(payload) >= 10_000_000:
            raise RuntimeError("Fed CSV download failed or too large")
    series = parse_fed_csv(payload.decode("utf-8-sig"))
    current = json.loads(TARGET.read_text(encoding="utf-8"))
    old = {item["id"]: item for item in current["indicators"]}
    entries = []
    for name in ("us_curve", "us_cli", "kr_cli"):
        item = old.get(name)
        if not item or len(item.get("series", [])) < 12:
            raise RuntimeError("Existing indicator missing observations: " + name)
        entries.append(item)
    for id_, title, section, unit, source_field, desc in SPECS:
        points = series[source_field]
        entries.append({
            "id": id_, "title": title, "section": section, "unit": unit,
            "kind": "series", "source": URL, "frequency": "monthly",
            "description": desc, "series": points
        })
        print(id_, "observations:", len(points), "latest:", points[-1], flush=True)
    current["indicators"] = entries
    current["generated_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    TARGET.write_text(json.dumps(current, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("SUCCESS: six indicators collected, ICE series removed", flush=True)

if __name__ == "__main__":
    main()
