"""Generate a one-time, source-dated synthesis when all six collected indicators are present."""
import json
import math
import os
import sys
from datetime import date, datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "indicators.json"
OUT = ROOT / "data" / "analysis.json"
IDS = ("us_curve", "us_cli", "kr_cli", "us_gz", "us_ebp", "us_recession_prob")

def collect_facts(data):
    indicators = {item["id"]: item for item in data["indicators"]}
    if set(IDS) - indicators.keys():
        raise RuntimeError("Not all six indicators are configured")
    today = date.today()
    facts = []
    for name in IDS:
        item = indicators[name]
        series = item.get("series") or []
        if len(series) < 12:
            raise RuntimeError("Insufficient data: " + name)
        latest = series[-1]
        age = (today - date.fromisoformat(latest["date"])).days
        max_age = 12 if name == "us_curve" else 80
        if age < -2 or age > max_age:
            raise RuntimeError("Indicator not fresh enough: %s (%s, %d days)" % (name, latest["date"], age))
        past = {}
        for months in (1, 3, 6, 12):
            target = date.fromisoformat(latest["date"])
            y, m = target.year, target.month - months
            while m <= 0:
                y -= 1
                m += 12
            cutoff = "%04d-%02d-%02d" % (y, m, min(target.day, 28))
            previous = next((p for p in reversed(series) if p["date"] <= cutoff), None)
            if previous:
                past[str(months) + "m"] = {
                    "value": previous["value"],
                    "change": round(latest["value"] - previous["value"], 5)
                }
        facts.append({
            "id": name, "title": item["title"], "unit": item["unit"],
            "latest_date": latest["date"], "latest_value": latest["value"], "history": past
        })
    return facts

def main():
    if OUT.exists():
        print("AI review exists: skip; no second paid call.")
        return
    snapshot = json.loads(DATA.read_text(encoding="utf-8"))
    facts = collect_facts(snapshot)
    key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not key:
        raise RuntimeError("OPENAI_API_KEY is missing; synthesis not generated")
    prompt = (
        "다음은 미국·한국의 경제위험 지표 6개 최신 관측치와 과거 대비 변화입니다. "
        "한국어로 객관적이고 신중한 종합의견을 5~8문장, 최대 850자 분량의 문단으로 작성하세요. "
        "반드시 장단기 금리차, 미국/한국 CLI, GZ 회사채 스프레드, EBP, 모형 경기침체 확률을 모두 해석하세요. "
        "위험이 커진 증거와 완화된 증거를 구분하고 서로 상충하면 명시하세요. "
        "기업 전체 GZ를 하이일드/CCC 전용 수치로 오인하지 마세요. "
        "모형 경기침체 확률을 공식 연준 전망이나 확정 예측으로 표현하지 마세요. "
        "발표 날짜가 서로 다르다는 점을 밝히고, 자산 비중의 급격한 변경이나 단정적인 매매 지시는 피하세요. "
        "제공된 자료 이외의 실시간 경제지표, 외부 뉴스, 수치를 추측하지 마세요. "
        "제목, 마크다운, 목록 없이 본문만 쓰세요.\n"
        + json.dumps(facts, ensure_ascii=False)
    )
    request_body = json.dumps({
        "model": "gpt-4.1-mini", "instructions": "You are a careful macroeconomic analyst. Explain uncertainty; do not invent facts.",
        "input": prompt, "max_output_tokens": 1100, "store": False
    }, ensure_ascii=False).encode("utf-8")
    req = Request("https://api.openai.com/v1/responses", data=request_body, headers={
        "Authorization": "Bearer " + key,
        "Content-Type": "application/json"
    }, method="POST")
    with urlopen(req, timeout=100) as resp:
        answer = json.load(resp)
    paragraphs = []
    for item in answer.get("output", []):
        for content in item.get("content", []):
            if content.get("type") == "output_text":
                paragraphs.append(content.get("text", "").strip())
    summary = "\n".join(p for p in paragraphs if p)
    if not summary or len(summary) < 80:
        raise RuntimeError("OpenAI returned no usable analysis")
    result = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "source_data_generated_at": snapshot["generated_at"],
        "model": answer.get("model", "gpt-4.1-mini"),
        "summary": summary,
        "indicators": [{"id": f["id"], "latest_date": f["latest_date"]} for f in facts]
    }
    OUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("SUCCESS: AI review generated once using all six data sources; chars=", len(summary), flush=True)

if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print("AI REVIEW FAILED: " + str(exc), file=sys.stderr)
        raise
