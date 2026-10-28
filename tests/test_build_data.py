import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from build_data import parse_fred_csv, parse_oecd_csv, update_snapshot

class CollectorTest(unittest.TestCase):
    def test_fred_csv(self):
        s = "observation_date,T10Y3M\n2026-01-05,-0.30\n2026-01-06,.\n2026-01-07,0.25\n"
        self.assertEqual(parse_fred_csv(s), [
            {"date": "2026-01-05", "value": -0.3},
            {"date": "2026-01-07", "value": 0.25}])
    def test_oecd_csv(self):
        s = "REF_AREA,TIME_PERIOD,OBS_VALUE,FREQ\nUSA,2026-01,100.12,M\nUSA,2026-02,100.17,M\nKOR,2026-01,101.24,M\nKOR,2026-02,101.20,M\n"
        self.assertEqual(parse_oecd_csv(s)["KOR"][-1], {"date": "2026-02-01", "value": 101.2})
    def test_ice_is_not_redistributed(self):
        obj = {"generated_at": None, "indicators": [
          {"id": "us_curve", "kind": "series", "series": []},
          {"id": "us_ccc", "kind": "external", "series": [{"date":"2026-01-01","value":3}]}]}
        out=update_snapshot(obj, {"us_curve":[{"date":"2026-01-01","value":0.2}]}, "now")
        self.assertEqual(out["indicators"][1]["series"], [])
        self.assertEqual(out["indicators"][0]["series"][0]["value"], 0.2)
    def test_treasury_yield_fallback(self):
        from build_data import parse_treasury_csv
        s = "Date,1 Mo,3 Mo,1 Yr,10 Yr\n10/27/2026,3.2,3.1,3.0,3.87\n"
        self.assertEqual(parse_treasury_csv(s), [
            {"date": "2026-10-27", "value": 0.77}])

    def test_invalid_oecd_csv(self):
        with self.assertRaises(ValueError):
            parse_oecd_csv("REF_AREA,OBS_VALUE\nUSA,102\n")

if __name__ == "__main__":
    unittest.main()
