import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from collect_fed import parse_fed_csv

class FedCollectorTests(unittest.TestCase):
    def test_fed_csv_and_probability_unit(self):
        rows = ["date,gz_spread,ebp,est_prob"]
        for i in range(1, 13):
            for year in range(2000, 2011):
                rows.append(f"{year}-{i:02d}-01,1.5,-0.2,0.125")
        result = parse_fed_csv("\n".join(rows))
        self.assertEqual(len(result["gz_spread"]), 132)
        self.assertEqual(result["est_prob"][0]["value"], 12.5)
        self.assertEqual(result["ebp"][-1]["value"], -0.2)
    def test_missing_column_rejected(self):
        with self.assertRaises(ValueError):
            parse_fed_csv("date,gz_spread,ebp\n2026-09-01,1.1,0.3\n")

if __name__ == "__main__":
    unittest.main()
