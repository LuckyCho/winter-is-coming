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
        "아래 6개 미국·한국 경제위험 지표를 분석해 한국어 사용자용 짧은 구조화된 의견을 만드세요. "
        "headline은 1문장으로 결론을 먼저 적습니다. "
        "positives(긍정 신호), cautions(주의 신호)에 각 2~4개 지표를 배분해 전체 6개 지표를 중복 없이 모두 다룹니다. "
        "각 항목은 주어진 id, 명료한 지표명(label), 1문장과 실제 수치를 사용한 설명(detail)을 갖습니다. "
        "watchpoints는 앞으로 확인할 구체적인 항목 2~3개, caveat는 발표시점 차이와 모형의 한계를 담은 짧은 문장입니다. "
        "상승이나 하락을 무조건 긍정/부정으로 판단하지 마세요. "
        "GZ를 HY/CCC 전용 지표로 오인하지 말고, EBP가 음수여도 위험이 없다고 단정하지 마세요. "
        "경기침체 추정 확률은 연준 공식 전망이 아닙니다. "
        "지표 간 상충 신호와 불확실성을 명시하고, 개별 주식 매매를 지시하지 마세요. "
        "제공되지 않은 뉴스나 외부 수치를 만들어내지 마세요. "
        "필요 이상으로 장황하게 쓰지 말고 출처별 관측일이 다른 점을 분명히 하세요.\n"
        + json.dumps(facts, ensure_ascii=False)
    )
    signal_schema = {
        "type": "object",
        "properties": {
            "id": {"type": "string", "enum": list(IDS)},
            "label": {"type": "string"},
            "detail": {"type": "string"}
        },
        "required": ["id", "label", "detail"],
        "additionalProperties": False
    }
    review_schema = {
        "type": "object",
        "properties": {
            "headline": {"type": "string"},
            "positives": {"type": "array", "items": signal_schema},
            "cautions": {"type": "array", "items": signal_schema},
            "watchpoints": {"type": "array", "items": {"type": "string"}},
            "caveat": {"type": "string"}
        },
        "required": ["headline", "positives", "cautions", "watchpoints", "caveat"],
        "additionalProperties": False
    }
    request_body = json.dumps({
        "model": "gpt-4.1-mini", "instructions": "You are a careful macroeconomic analyst. Explain uncertainty; do not invent facts.",
        "input": prompt, "max_output_tokens": 1600, "store": False,
        "text": {"format": {"type": "json_schema", "name": "macro_review",
                            "strict": True, "schema": review_schema}}
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
    text_output = "\n".join(p for p in paragraphs if p)
    if not text_output:
        raise RuntimeError("OpenAI returned no usable analysis")
    review = json.loads(text_output)
    if not review.get("headline") or len(review.get("positives", [])) < 2 or len(review.get("cautions", [])) < 2:
        raise RuntimeError("Review sections are incomplete")
    all_ids = [item.get("id") for item in review["positives"] + review["cautions"]]
    if len(all_ids) != len(IDS) or set(all_ids) != set(IDS):
        raise RuntimeError("Review must describe all six indicator IDs once")
    summary = " ".join(
        [review["headline"]]
        + [p["label"] + ": " + p["detail"] for p in review["positives"] + review["cautions"]]
        + review["watchpoints"] + [review["caveat"]]
    )
    result = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "source_data_generated_at": snapshot["generated_at"],
        "model": answer.get("model", "gpt-4.1-mini"),
        "summary": summary,
        "review": review,
        "review_format_version": 1,
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
