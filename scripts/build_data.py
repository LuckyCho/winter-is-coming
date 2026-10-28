"""Build public economic-indicator snapshot for Winter Is Coming?"""
from __future__ import annotations
import csv
import io
import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "indicators.json"
FRED = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=T10Y3M"
OECD = ("https://sdmx.oecd.org/public/rest/data/"
        "OECD.SDD.STES,DSD_STES@DF_CLI/USA+KOR.M.LI...AA...H"
        "?startPeriod=2015-01&dimensionAtObservation=AllDimensions&format=csvfilewithlabels")


def download_csv(url: str) -> str:
    req = Request(url, headers={"User-Agent": "WinterIsComing/0.1",
                                "Accept": "text/csv, */*"})
    with urlopen(req, timeout=45) as response:
        return response.read().decode("utf-8-sig")


def parse_fred_csv(text: str) -> list[dict]:
    reader = csv.DictReader(io.StringIO(text))
    if "T10Y3M" not in (reader.fieldnames or []):
        raise ValueError("T10Y3M column missing")
    result = {}
    for row in reader:
        day = (row.get("observation_date") or row.get("DATE") or "").strip()
        raw = (row.get("T10Y3M") or "").strip()
        if not day or raw in ("", ".", "NaN"):
            continue
        try:
            value = float(raw)
        except ValueError:
            continue
        if math.isfinite(value):
            result[day] = round(value, 5)
    if not result:
        raise ValueError("FRED returned no observations")
    return [{"date": day, "value": v} for day, v in sorted(result.items())]


def parse_oecd_csv(text: str) -> dict[str, list[dict]]:
    reader = csv.DictReader(io.StringIO(text))
    required = {"REF_AREA", "TIME_PERIOD", "OBS_VALUE"}
    if not required.issubset(reader.fieldnames or []):
        raise ValueError("OECD CSV columns missing")
    by_country = {"USA": {}, "KOR": {}}
    for row in reader:
        country = (row.get("REF_AREA") or "").strip()
        if country not in by_country:
            continue
        period = (row.get("TIME_PERIOD") or "").strip()
        raw = (row.get("OBS_VALUE") or "").strip()
        if len(period) != 7 or period[4] != "-" or not period[:4].isdigit() or not period[5:].isdigit():
            continue
        try:
            value = float(raw)
        except ValueError:
            continue
        if not math.isfinite(value):
            continue
        day = period + "-01"
        previous = by_country[country].get(day)
        if previous is not None and abs(previous - value) > 0.00001:
            raise ValueError("Multiple OECD series match this date; narrow query")
        by_country[country][day] = round(value, 5)
    if any(not values for values in by_country.values()):
        raise ValueError("OECD response missing USA or KOR")
    return {c: [{"date": day, "value": v} for day, v in sorted(values.items())]
            for c, values in by_country.items()}


def parse_treasury_csv(text: str) -> list[dict]:
    """Read official US Treasury yield curve CSV and compute 10Y minus 3M."""
    from datetime import datetime
    reader = csv.DictReader(io.StringIO(text))
    fields = {name.strip(): name for name in (reader.fieldnames or [])}
    if not {"Date", "3 Mo", "10 Yr"}.issubset(fields):
        raise ValueError("Treasury CSV missing Date / 3 Mo / 10 Yr columns")
    result = {}
    for row in reader:
        try:
            day = datetime.strptime(row[fields["Date"]].strip(), "%m/%d/%Y").date().isoformat()
            short = float(row[fields["3 Mo"]].strip())
            long = float(row[fields["10 Yr"]].strip())
            if math.isfinite(short) and math.isfinite(long):
                result[day] = round(long - short, 5)
        except (ValueError, TypeError, AttributeError, KeyError):
            continue
    if not result:
        raise ValueError("Treasury CSV has no valid yield-curve observations")
    return [{"date": day, "value": v} for day, v in sorted(result.items())]


def collect_treasury_fallback() -> list[dict]:
    """Use official Treasury files if FRED's public CSV endpoint is unavailable."""
    year = datetime.now(timezone.utc).year
    values = {}
    for y in range(year - 10, year + 1):
        url = (
            f"https://home.treasury.gov/resource-center/data-chart-center/"
            f"interest-rates/daily-treasury-rates.csv/{y}/all"
            f"?type=daily_treasury_yield_curve&field_tdr_date_value={y}&page&_format=csv"
        )
        try:
            for item in parse_treasury_csv(download_csv(url)):
                values[item["date"]] = item["value"]
        except Exception as exc:
            print(f"WARNING: Treasury year {y}: {exc}", file=sys.stderr)
    if not values:
        raise ValueError("Treasury fallback has no valid observations")
    return [{"date": day, "value": v} for day, v in sorted(values.items())]


def update_snapshot(data: dict, sources: dict, generated: str) -> dict:
    for indicator in data["indicators"]:
        if indicator.get("kind") == "external":
            indicator["series"] = []  # proprietary ICE BofA data are not redistributed
        elif indicator["id"] in sources:
            indicator["series"] = sources[indicator["id"]]
    if sources:
        data["generated_at"] = generated
    return data


def main() -> int:
    existing = json.loads(OUTPUT.read_text(encoding="utf-8"))
    sources = {}
    errors = []
    try:
        sources["us_curve"] = parse_fred_csv(download_csv(FRED))
        print("FRED observations:", len(sources["us_curve"]))
    except Exception as e:
        print("WARNING: FRED unavailable, trying US Treasury: " + str(e), file=sys.stderr)
        try:
            sources["us_curve"] = collect_treasury_fallback()
            print("Treasury observations:", len(sources["us_curve"]))
        except Exception as fallback_error:
            errors.append("FRED + Treasury: " + str(e) + " / " + str(fallback_error))
    try:
        oecd = parse_oecd_csv(download_csv(OECD))
        sources["us_cli"], sources["kr_cli"] = oecd["USA"], oecd["KOR"]
        print("OECD USA/KOR:", len(oecd["USA"]), len(oecd["KOR"]))
    except Exception as e:
        errors.append("OECD: " + str(e))
    for error in errors:
        print("WARNING:", error, file=sys.stderr)
    if not sources:
        print("ERROR: all data sources failed; existing file preserved", file=sys.stderr)
        return 1
    now = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    data = update_snapshot(existing, sources, now)
    OUTPUT.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
