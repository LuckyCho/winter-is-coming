# Winter Is Coming?

*A personal, explainable dashboard for economic early-warning indicators.*

## Status

**Source code / first working prototype.** This archive is **not a deployed website**. The first data snapshot contains no fabricated data. Once a GitHub Actions workflow runs successfully, daily data ingestion and GitHub Pages publishing begin. The dashboard is designed to be readable on phone and desktop.

## Initial indicators

| Indicator | Source | In the first public release |
|---|---|---|
| US 10-year Treasury minus 3-month Treasury | FRED `T10Y3M` | Automated CSV collection, 1/3/5/10-year chart |
| US HY credit spread | ICE BofA via FRED `BAMLH0A0HYM2` | External source link; **no data redistribution** |
| US CCC-and-below credit spread | ICE BofA via FRED `BAMLH0A3HYC` | External source link; **no data redistribution** |
| US OECD composite leading indicator | OECD SDMX | Automated collection, chart |
| Korea OECD composite leading indicator | OECD SDMX | Automated collection, chart |

The OECD CLI is **not** the Conference Board's US LEI. A separate Conference Board series can be integrated later only if its terms allow publication. ICE BofA observations are copyrighted by ICE; the site purposely does not copy their values onto GitHub Pages. To get full charts now, follow the relevant source links.

## Publish with GitHub Pages

1. Create a **new public GitHub repository** named `winter-is-coming` (or any name you choose). Upload all project files, including hidden `.github/workflows/daily-publish.yml`, into its root. Commit to the **main** branch.
2. Open **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Open **Actions → Daily economic indicators and Pages → Run workflow**. This first run populates the data JSON and deploys the page. Subsequent runs are scheduled for **10:17 KST daily**, subject to GitHub scheduler delays.
4. Open `https://YOUR-USERNAME.github.io/winter-is-coming/` once the action finishes successfully. The exact URL depends on your repository name and Pages settings.
5. If Pages is not enabled or Actions is disallowed by organization settings, follow the error in the Actions log and GitHub repository permissions.

This workflow commits the updated `data/indicators.json` to the same repository, **then publishes a static `dist` directory**. Visitors only fetch the JSON and do not call FRED/OECD APIs. Source and observation dates are distinct.

## Test locally

```bash
python -m unittest discover -s tests -v
python scripts/build_data.py          # Requires outbound internet connectivity.
python -m http.server 8000
```

Then open http://localhost:8000/ . If collection has not run, the UI clearly displays "갱신 대기" rather than invented numbers. No Node.js, React build, Docker, or database is required.

## Add an indicator

- Add an entry to `data/indicators.json` with `id`, `title`, `section`, `unit`, `source`, `kind` and `series`.
- Extend `scripts/build_data.py` with a lawful public source API parser and map it to the new `id`. In `app.js`, charts and rows render automatically for `kind: series`.
- Define explicit, justified signal interpretations before using the indicator in risk commentary.

### Caveats

- Public data availability is uneven; some series release monthly or are later revised. Site timestamp is *collection time*, **not** the observation date.
- If one provider fails, existing observations for that provider remain; if both providers fail, workflow exits before new publication.
- The sample risk status is descriptive, is **not** a calibrated recession probability, and deliberately excludes proprietary credit spreads.
- Market direction may change before macro data, and the US 10y–3m curve alone does not establish an impending stock bear market.
- Ensure FRED/OECD source terms fit your specific use before any commercial release.

Sources: https://fred.stlouisfed.org/legal/terms/ ; https://www.oecd.org/en/data/insights/data-explainers/2024/09/api.html ; https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site