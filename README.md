# Winter Is Coming?

A six-indicator, data-first public dashboard for monitoring US/Korean macroeconomic and credit risks.

**Live:** https://luckycho.github.io/winter-is-coming/

## Official indicators

| ID | Indicator | Source | Frequency |
| --- | --- | --- | --- |
| us_curve | US Treasury 10-year minus 3-month yield | FRED T10Y3M, fallback: US Treasury CSV | Daily |
| us_cli | US OECD CLI | OECD SDMX public API | Monthly |
| kr_cli | Korea OECD CLI | OECD SDMX public API | Monthly |
| us_gz | Gilchrist-Zakrajšek (GZ) corporate credit spread | Federal Reserve Board ebp_csv.csv | Monthly |
| us_ebp | Excess Bond Premium (EBP) | Federal Reserve Board ebp_csv.csv | Monthly |
| us_recession_prob | 12-month recession model probability | Federal Reserve Board ebp_csv.csv, est_prob converted from ratio to % | Monthly |

The GZ spread is an aggregate of **US nonfinancial corporate bonds**, not a standalone high-yield or CCC-only OAS series. The modeled recession probability is **not an official Federal Reserve forecast**.

The previous ICE BofA HY / CCC FRED embeds have been excluded from the six-indicator dashboard due to third-party rights limitations.

**Federal Reserve file:** https://www.federalreserve.gov/econres/notes/feds-notes/ebp_csv.csv

## Automation

- GitHub Actions workflow: `.github/workflows/daily-publish.yml`, daily at **10:17 KST** (schedule timing is not guaranteed).
- `scripts/build_data.py` collects the three existing indicators.
- `scripts/collect_fed.py` fetches the Fed CSV directly, checks for the expected columns and sufficient historical records, and produces exactly six directly chartable series in `data/indicators.json`.
- `scripts/generate_analysis.py` calls the OpenAI Responses API once **only when all six series have recent observations** and `data/analysis.json` does not already exist. It uses the `OPENAI_API_KEY` GitHub Actions secret; the key must never be stored in repository source. The generated analysis is **not automatically rewritten each day** and is explicitly date-labeled on the dashboard.
- The job commits the public data snapshots then deploys static files through GitHub Pages.
- Python standard library is sufficient; no paid model call is needed for data acquisition.

## Verify locally

```bash
python -m unittest discover -s tests -v
node --check app.js
python scripts/build_data.py
python scripts/collect_fed.py
```

Do not invoke `scripts/generate_analysis.py` unless you intend to make the paid OpenAI API request. AI output is informational and represents a dated synthesis, not personalized investment advice.

## Licensing and caveats

Check the source-specific terms for your intended purpose, especially if commercializing. Original government data and the rights in incorporated third-party content are not always the same. OECD CLI is different from the Conference Board LEI. Original observation dates and collection timestamps differ; revisions may occur. Never mistake collection completion for a simultaneous or current-day release of all monthly series.
